import os
import re
import pickle
from flask import Flask, request, jsonify
import nltk
from nltk.tokenize import sent_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx

app = Flask(__name__)

print("Loading Trained Machine Learning Models...")
try:
    with open('models_claims.pkl', 'rb') as f:
        claims_model = pickle.load(f)
    with open('models_defs.pkl', 'rb') as f:
        defs_model = pickle.load(f)
    print("Models loaded successfully!")
except Exception as e:
    print("WARNING: Could not load .pkl models. Run train_model.py first.")
    claims_model = None
    defs_model = None

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
                
        ranked_sentences = sorted(((scores[i], s) for i,s in enumerate(sentences)), reverse=True)
        tldr = [s for score, s in ranked_sentences[:num_sentences]]
        return tldr
    except Exception as e:
        print("PageRank error:", e)
        return sentences[:num_sentences]

def extract_claims(sentences):
    claims = []
    
    for sentence in sentences:
        if claims_model and claims_model.predict([sentence])[0] == 1:
            claim_text = sentence.strip()
            if len(claim_text) > 100:
                claim_text = claim_text[:97] + "..."
                
            claims.append({
                "claim": f"ML Extracted Finding: {claim_text}",
                "evidence_quote": sentence.strip()
            })
            
            if len(claims) >= 5:
                break
    return claims

def generate_flashcards(sentences):
    flashcards = []
    
    for sentence in sentences:
        if defs_model and defs_model.predict([sentence])[0] == 1:
            # We know it's a definition according to the ML model.
            # We use a quick split to make a Question/Answer pair
            split_words = [" is defined as ", " refers to ", " is known as ", " stands for ", " is a ", " means "]
            
            term = "Concept"
            definition = sentence
            
            for word in split_words:
                if word in sentence:
                    parts = sentence.split(word, 1)
                    term = parts[0].strip()
                    definition = parts[1].strip()
                    break
                    
            flashcards.append({
                "question": f"What is {term}?",
                "answer": f"It is {definition.strip('. ')}."
            })
                
        if len(flashcards) >= 6:
            break
            
    # Fallback if no definitions found
    if len(flashcards) == 0 and len(sentences) > 5:
        for i in range(min(3, len(sentences))):
            sent = sentences[i+2] 
            words = sent.split()
            if len(words) > 10:
                q_words = " ".join(words[:5])
                a_words = " ".join(words[5:])
                flashcards.append({
                    "question": f"Complete the thought: {q_words}...",
                    "answer": a_words
                })
                
    return flashcards

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    text = data.get('text', '')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
        
    text = text.replace('\n', ' ')
    
    try:
        sentences = sent_tokenize(text)
    except LookupError:
        sentences = text.split('. ')
    
    sentences = [s.strip() for s in sentences if len(s.split()) > 5]
    
    tldr = generate_tldr(sentences, 3)
    claims = extract_claims(sentences)
    flashcards = generate_flashcards(sentences)
    
    if not claims:
         claims.append({
             "claim": "No explicit claims found by the ML model.",
             "evidence_quote": sentences[0] if sentences else "N/A"
         })
         
    if not flashcards:
         flashcards.append({
             "question": "What is the primary topic?",
             "answer": "The text discusses complex concepts that couldn't be auto-extracted."
         })
    
    return jsonify({
        "tldr": tldr,
        "claims": claims,
        "flashcards": flashcards
    })

if __name__ == '__main__':
    print("Starting ML-Powered Python Microservice on Port 5000...")
    app.run(port=5000, debug=True)
