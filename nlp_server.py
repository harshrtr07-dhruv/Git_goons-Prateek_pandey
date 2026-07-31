import os
import re
import pickle
from flask import Flask, request, jsonify
import nltk
try:
    nltk_data_dir = os.path.join('/tmp', 'nltk_data')
    if not os.path.exists(nltk_data_dir):
        os.makedirs(nltk_data_dir, exist_ok=True)
    nltk.data.path.append(nltk_data_dir)
    nltk.download('punkt', download_dir=nltk_data_dir, quiet=True)
    nltk.download('punkt_tab', download_dir=nltk_data_dir, quiet=True)
except Exception as e:
    pass
from nltk.tokenize import sent_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx
import fitz  # PyMuPDF for advanced parsing

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

print("Loading Trained Machine Learning Models...")
try:
    with open(os.path.join(BASE_DIR, 'models_claims.pkl'), 'rb') as f:
        claims_model = pickle.load(f)
    with open(os.path.join(BASE_DIR, 'models_defs.pkl'), 'rb') as f:
        defs_model = pickle.load(f)
    with open(os.path.join(BASE_DIR, 'models_limitations.pkl'), 'rb') as f:
        lims_model = pickle.load(f)
    print("Models loaded successfully!")
except Exception as e:
    print("WARNING: Could not load .pkl models. Run train_model.py first.", e)
    claims_model = None
    defs_model = None
    lims_model = None

def generate_tldr(sentences, num_sentences=3):
    if len(sentences) <= num_sentences:
        return sentences
    
    # TextRank Algorithm
    vectorizer = TfidfVectorizer(stop_words='english')
    X = vectorizer.fit_transform(sentences)
    similarity_matrix = cosine_similarity(X, X)
    
    nx_graph = nx.from_numpy_array(similarity_matrix)
    try:
        scores = nx.pagerank(nx_graph)
        
        # Boost scores for sentences containing important summarizing keywords
        tldr_boost_words = ["in this paper", "we propose", "we introduce", "in summary", "to conclude", "our approach"]
        for i, sentence in enumerate(sentences):
            lower_s = sentence.lower()
            if any(kw in lower_s for kw in tldr_boost_words):
                scores[i] *= 1.5
            
            # Filter out citations and references from being selected as the TLDR
            if re.search(r'\[\d+\]', sentence) or "arxiv:" in lower_s or "et al." in lower_s:
                scores[i] *= 0.01
                
        ranked_sentences = sorted(((scores[i], s) for i,s in enumerate(sentences)), reverse=True)
        tldr = [s for score, s in ranked_sentences[:num_sentences]]
        return tldr
    except Exception as e:
        print("PageRank error:", e)
        return sentences[:num_sentences]

def clean_sentences(sentences):
    """Filter out noisy sentences extracted from academic PDF formatting."""
    cleaned = []
    for s in sentences:
        s = s.strip()
        # Skip section headers like "A. Introduction", "IV. Results", "C. Pre-Training..."
        if re.match(r'^[A-Z]{1,3}[\.\)]\s+[A-Z]', s):
            continue
        # Skip standalone single/double uppercase letters (e.g. "V", "P", "C")
        if re.match(r'^[A-Z]{1,3}\.?$', s.strip()):
            continue
        # Skip table/figure references like "Table V." or "Fig. 3."
        if re.match(r'^(Table|Fig|Figure|Eq|Algorithm)\s+[IVXLCDM\d]+', s, re.IGNORECASE):
            continue
        # Skip citation strings like "[1] Smith et al..." or "9, 15 [97] S. Wu..."
        if re.search(r'^\[?\d+\]?\s+[A-Z]\.', s):
            continue
        # Skip very short sentences (likely garbage or page numbers)
        if len(s.split()) < 6:
            continue
            
        # --- NEW TABULAR / MATH FILTERING ---
        alpha_count = sum(c.isalpha() for c in s)
        num_count = sum(c.isdigit() for c in s)
        
        # Must have a minimum number of letters to be a real sentence
        if alpha_count < 15:
            continue
            
        # If the ratio of numbers to letters is unusually high, it's a table or math array
        if alpha_count == 0 or (num_count / alpha_count) > 0.25:
            continue
            
        # If there are too many math symbols relative to words
        sym_count = sum(s.count(c) for c in '+-=/·<>±%*^')
        if (sym_count / alpha_count) > 0.1:
            continue
            
        # Require at least one common stopword to prove it's prose and not a list of nouns/numbers
        lower_s = " " + s.lower() + " "
        stopwords = [' the ', ' a ', ' an ', ' is ', ' are ', ' in ', ' of ', ' to ', ' for ', ' with ', ' on ', ' by ', ' this ', ' that ', ' we ', ' as ']
        if not any(sw in lower_s for sw in stopwords):
            continue

        cleaned.append(s)
    return cleaned

def extract_claims(sentences):
    claims = []
    for sentence in sentences:
        if claims_model and claims_model.predict([sentence])[0] == 1:
            claim_text = sentence.strip()
            if len(claim_text) > 150:
                claim_text = claim_text[:147] + "..."
            claims.append({
                "claim": claim_text,
                "evidence_quote": sentence.strip()
            })
            if len(claims) >= 5:
                break
    return claims

def extract_limitations(sentences):
    limitations = []
    # 1. Try ML model
    for sentence in sentences:
        if lims_model and lims_model.predict([sentence])[0] == 1:
            limitations.append(sentence.strip())
            if len(limitations) >= 4:
                break

    # 2. Fallback: Keyword search if ML model yields fewer than 2 results
    if len(limitations) < 2:
        lim_keywords = [
            'limit', 'limitation', 'drawback', 'constraint', 'restrict',
            'challenge', 'bottleneck', 'fails to', 'unable to', 'future work',
            'trade-off', 'tradeoff', 'computational cost', 'expensive', 'remains'
        ]
        for sentence in sentences:
            s_lower = sentence.lower()
            if any(kw in s_lower for kw in lim_keywords) and sentence.strip() not in limitations:
                limitations.append(sentence.strip())
                if len(limitations) >= 4:
                    break
    return limitations

def build_concept_map(sentences, top_n=6):
    """Extract top keywords and their co-occurrence links for concept map visualization."""
    if not sentences:
        return {"nodes": [], "links": []}

    # Generic academic/paper meta-words that carry no conceptual value
    META_WORDS = {
        'et al', 'arxiv', 'preprint', 'lims', 'llm', 'llms',
        'paper', 'work', 'method', 'approach', 'result', 'results', 'show', 'propose',
        'recent', 'previous', 'existing', 'new', 'different', 'various', 'several',
        'general', 'specific', 'used', 'using', 'use', 'pre', 'post',
        'number', 'type', 'ability', 'section', 'figure', 'table'
    }

    # Extract a large candidate pool and filter
    vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2), max_features=100)
    try:
        vectorizer.fit(sentences)
        all_terms = vectorizer.get_feature_names_out().tolist()
    except Exception:
        return {"nodes": [], "links": []}

    def is_valid_term(t):
        if re.match(r'^\d+', t): return False           # starts with number
        if len(t) <= 3: return False                     # too short
        if t in META_WORDS: return False                 # generic meta-word
        words = t.split()
        if all(w in META_WORDS for w in words): return False # all words are meta-words
        if re.match(r'^[a-z]\s', t): return False        # single-letter bigram
        return True

    top_terms = [t for t in all_terms if is_valid_term(t)][:top_n]

    # Fallback if top_terms is empty
    if not top_terms:
        top_terms = [t for t in all_terms if len(t) > 3 and not re.match(r'^\d+', t)][:top_n]

    def score_description(sentence, term):
        """Score how well a sentence describes a term. Higher is better."""
        s = sentence.lower()
        score = 0
        # Bonus for definition language
        def_words = [' is ', ' are ', ' refers to ', ' defined as ', ' means ', ' consists of ',
                     ' using ', ' called ', ' known as ', ' such as ', ' including ']
        for dw in def_words:
            if dw in s:
                score += 10
        # Bonus for term appearing early in the sentence (likely the subject)
        idx = s.find(term)
        if idx != -1:
            score += max(0, 20 - idx)  # Earlier = more score
        # Prefer medium-length sentences (not too short or too long)
        word_count = len(sentence.split())
        if 10 <= word_count <= 40:
            score += 5
        elif word_count > 40:
            score -= 3
        return score

    # Build nodes: pick the most descriptive sentence for each concept
    nodes = []
    for term in top_terms:
        candidates = [(s, score_description(s, term)) for s in sentences if term in s.lower()]
        if candidates:
            best_sentence = max(candidates, key=lambda x: x[1])[0]
        else:
            best_sentence = f"A key concept discussed in this paper: '{term.title()}'."
        nodes.append({
            "id": term,
            "label": term.title(),
            "description": best_sentence.strip()
        })

    # Build edges: two terms are linked if they co-occur in the same sentence
    links = []
    seen = set()
    for sentence in sentences:
        s_lower = sentence.lower()
        present = [t for t in top_terms if t in s_lower]
        for i in range(len(present)):
            for j in range(i + 1, len(present)):
                key = tuple(sorted([present[i], present[j]]))
                if key not in seen:
                    seen.add(key)
                    links.append({"source": present[i], "target": present[j]})

    return {"nodes": nodes, "links": links}

def generate_flashcards(sentences):
    flashcards = []
    
    split_words = [' is a ', ' are a ', ' refers to ', ' is defined as ', ' means ', ' consists of ', ' is known as ']
    
    for sentence in sentences:
        if len(flashcards) >= 6:
            break
            
        if defs_model and defs_model.predict([sentence])[0] == 1:
            term = "Concept"
            definition = sentence
            
            lower_sentence = sentence.lower()
            for word in split_words:
                if word in lower_sentence:
                    # Find the actual index to preserve original casing
                    idx = lower_sentence.index(word)
                    term = sentence[:idx].strip()
                    definition = sentence[idx + len(word):].strip()
                    break
                    
            # Only include the concepts we successfully split
            if term == "Concept" or len(term) > 50:
                continue
                
            # Clean up the term if it has weird starting characters or figure caption artifacts like "right)"
            term = re.sub(r'^\s*\(.*?\)\s*', '', term) # Remove leading (anything)
            term = re.sub(r'^\s*(?:left|right|top|bottom|[a-z])\)\s*', '', term, flags=re.IGNORECASE)
            term = re.sub(r'^[^a-zA-Z0-9]+', '', term)
            term = term.strip()
            
            flashcards.append({
                "question": f"What is {term}?",
                "answer": f"It is {definition.strip('. ')}."
            })
            
    # Fallback: if we didn't find enough explicit definitions, use TF-IDF concept map extraction
    if len(flashcards) < 4:
        concept_data = build_concept_map(sentences, top_n=6)
        existing_questions = set(f["question"] for f in flashcards)
        
        for node in concept_data.get("nodes", []):
            if len(flashcards) >= 6:
                break
                
            question = f"What is {node['label']}?"
            if question not in existing_questions:
                flashcards.append({
                    "question": question,
                    "answer": node['description']
                })
                existing_questions.add(question)
                
    return flashcards

@app.route('/analyze', methods=['POST'])
def analyze():
    text = ""
    
    # 1. Try reading raw PDF bytes from request body
    try:
        pdf_bytes = request.get_data()
        if pdf_bytes and len(pdf_bytes) > 50:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text() + " "
            doc.close()
    except Exception as e:
        print("PyMuPDF stream parse notice:", e)

    # 2. Fallback to JSON payload if PyMuPDF didn't extract text
    if not text.strip():
        data = request.get_json(silent=True) or {}
        text = data.get('text', '')
    
    if not text.strip():
        return jsonify({"error": "No text could be extracted from the uploaded PDF"}), 400
        
    text = text.replace('\n', ' ')
    
    # Replace common bullet point characters with periods so they are tokenized as separate sentences
    text = re.sub(r'[\•\▪\⁃\u2022]', '. ', text)
    
    try:
        sentences = sent_tokenize(text)
    except LookupError:
        sentences = text.split('. ')
    
    sentences = [s.strip() for s in sentences if len(s.split()) > 5]
    sentences = clean_sentences(sentences)
    
    tldr = generate_tldr(sentences, 3)
    claims = extract_claims(sentences)
    limitations = extract_limitations(sentences)
    flashcards = generate_flashcards(sentences)
    concept_map = build_concept_map(sentences)
    
    if not claims:
        claims.append({
            "claim": "No explicit claims found by the ML model.",
            "evidence_quote": sentences[0] if sentences else "N/A"
        })
    
    if not limitations:
        limitations.append("No explicit limitations or constraints were detected in this paper.")
         
    if not flashcards:
        flashcards.append({
            "question": "What is the primary topic?",
            "answer": "The text discusses complex concepts that couldn't be auto-extracted."
        })
    
    return jsonify({
        "tldr": tldr,
        "claims": claims,
        "limitations": limitations,
        "flashcards": flashcards,
        "concept_map": concept_map,
        "extractedLength": len(text)
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting ML-Powered Python Microservice on Port {port}...")
    app.run(host='0.0.0.0', port=port)
