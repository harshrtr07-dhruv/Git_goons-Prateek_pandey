import urllib.request
import xml.etree.ElementTree as ET
import pickle
import nltk
from nltk.tokenize import sent_tokenize
import random

# Ensure tokenizer is available
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

print("--- Real-World Overfitting Test ---")
print("Loading models...")
try:
    with open('models_claims.pkl', 'rb') as f:
        claims_model = pickle.load(f)
    with open('models_defs.pkl', 'rb') as f:
        defs_model = pickle.load(f)
except Exception as e:
    print(f"Error loading models: {e}")
    exit(1)

# Fetch entirely unseen data from a different domain (Quantum Computing)
print("Fetching unseen real-world data (Quantum Computing papers) from ArXiv...")
url = 'http://export.arxiv.org/api/query?search_query=all:quantum+computing&start=0&max_results=30'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
response = urllib.request.urlopen(req)
xml_data = response.read()
root = ET.fromstring(xml_data)

unseen_sentences = []
for entry in root.findall('{http://www.w3.org/2005/Atom}entry'):
    summary = entry.find('{http://www.w3.org/2005/Atom}summary').text
    if summary:
        unseen_sentences.extend(sent_tokenize(summary.replace('\n', ' ')))

# Let's pick 15 random sentences to evaluate
random.seed(42) # fixed seed for reproducibility
sample = random.sample(unseen_sentences, min(15, len(unseen_sentences)))

print("\n--- Model Predictions on Unseen Quantum Computing Text ---")
claims_found = 0
defs_found = 0

for text in sample:
    claim_pred = claims_model.predict([text])[0]
    def_pred = defs_model.predict([text])[0]
    
    tags = []
    if claim_pred == 1: 
        tags.append("CLAIM")
        claims_found += 1
    if def_pred == 1: 
        tags.append("DEFINITION")
        defs_found += 1
        
    if not tags: tags.append("NEUTRAL")
    
    print(f"[{', '.join(tags)}] {text}")

print("\n--- Summary ---")
print(f"Total Sentences Evaluated: {len(sample)}")
print(f"Predicted as Claims: {claims_found}")
print(f"Predicted as Definitions: {defs_found}")
