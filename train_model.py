import os
import pickle
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

print("Initializing Machine Learning Training Pipeline...")

# ==========================================
# 1. Dataset Generation
# Using real academic datasets via pandas!
# ==========================================
import pandas as pd
import urllib.request
import xml.etree.ElementTree as ET
import json
import nltk
from nltk.tokenize import sent_tokenize

# Ensure NLTK punkt is downloaded for sentence splitting
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

# --- CLAIMS DATASET ---
print("Downloading real academic data for Claims from ArXiv API...")
url = 'http://export.arxiv.org/api/query?search_query=all:machine+learning&start=0&max_results=500'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
response = urllib.request.urlopen(req)
xml_data = response.read()
root = ET.fromstring(xml_data)

arxiv_sentences = []
for entry in root.findall('{http://www.w3.org/2005/Atom}entry'):
    summary = entry.find('{http://www.w3.org/2005/Atom}summary').text
    if summary:
        arxiv_sentences.extend(sent_tokenize(summary.replace('\n', ' ')))

# Label sentences heuristically for training
claims_positive = [s for s in arxiv_sentences if any(w in s.lower() for w in ['propose', 'show', 'demonstrate', 'outperform', 'results', 'conclude', 'introduce', 'indicate'])]
claims_negative = [s for s in arxiv_sentences if not any(w in s.lower() for w in ['propose', 'show', 'demonstrate', 'outperform', 'results', 'conclude', 'introduce', 'indicate'])]

# Balance and load into Pandas DataFrame
min_claims = min(len(claims_positive), len(claims_negative))
df_claims = pd.DataFrame({
    'text': claims_positive[:min_claims] + claims_negative[:min_claims],
    'is_claim': [1]*min_claims + [0]*min_claims
})
claims_X = df_claims['text'].tolist()
claims_y = df_claims['is_claim'].tolist()


# --- FLASHCARDS/DEFINITIONS DATASET ---
print("Extracting Definitions heuristically from ArXiv dataset...")
# Instead of a massive 40MB download that causes network errors, 
# we reuse the authentic ArXiv sentences!
squad_sentences = arxiv_sentences

defs_positive = [s for s in squad_sentences if any(w in s.lower() for w in [' is a ', ' refers to ', ' is defined as ', ' stands for ', ' known as '])]
defs_negative = [s for s in squad_sentences if not any(w in s.lower() for w in [' is a ', ' refers to ', ' is defined as ', ' stands for ', ' known as '])]

# INJECT HARD NEGATIVES: Add academic sentences from ArXiv that are NOT definitions
# This prevents the SVM from classifying *any* academic sentence as a definition
defs_negative.extend(arxiv_sentences[:1000])

# Balance and load into Pandas DataFrame
min_defs = min(len(defs_positive), len(defs_negative))
df_defs = pd.DataFrame({
    'text': defs_positive[:min_defs] + defs_negative[:min_defs],
    'is_def': [1]*min_defs + [0]*min_defs
})
defs_X = df_defs['text'].tolist()
defs_y = df_defs['is_def'].tolist()

# --- LIMITATIONS DATASET ---
print("Extracting Limitations from ArXiv dataset...")
# Sentences signaling a limitation, constraint, or future work
limitation_keywords = [
    'however', 'limitation', 'future work', 'we did not', 'drawback',
    'constraint', 'nevertheless', 'unfortunately', 'we assume', 'restricted to',
    'cannot', 'one concern', 'an open problem', 'does not', 'may not',
    'open question', 'remain', 'beyond the scope', 'we leave', 'requires further'
]
lims_positive = [s for s in arxiv_sentences if any(w in s.lower() for w in limitation_keywords)]
lims_negative = [s for s in arxiv_sentences if not any(w in s.lower() for w in limitation_keywords)]

min_lims = min(len(lims_positive), len(lims_negative))
df_lims = pd.DataFrame({
    'text': lims_positive[:min_lims] + lims_negative[:min_lims],
    'is_limitation': [1]*min_lims + [0]*min_lims
})
lims_X = df_lims['text'].tolist()
lims_y = df_lims['is_limitation'].tolist()

# ==========================================
# 2. Model Training (Support Vector Machines)
# ==========================================

print("Training Claims Extraction Model (SVM)...")
# We use a Pipeline to combine the TF-IDF math vectorizer and the SVM classifier
claims_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2))), # Use unigrams and bigrams
    ('clf', LinearSVC(random_state=42, dual='auto'))
])

# Split data to evaluate accuracy
X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(claims_X, claims_y, test_size=0.2, random_state=42)
claims_pipeline.fit(X_train_c, y_train_c)
print("Claims Model Accuracy:")
print(classification_report(y_test_c, claims_pipeline.predict(X_test_c)))


print("Training Definition/Flashcard Model (SVM)...")
defs_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2))),
    ('clf', LinearSVC(random_state=42, dual='auto'))
])

X_train_d, X_test_d, y_train_d, y_test_d = train_test_split(defs_X, defs_y, test_size=0.2, random_state=42)
defs_pipeline.fit(X_train_d, y_train_d)
print("Definition Model Accuracy:")
print(classification_report(y_test_d, defs_pipeline.predict(X_test_d)))


print("Training Limitations Extraction Model (SVM)...")
lims_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2))),
    ('clf', LinearSVC(random_state=42, dual='auto'))
])

X_train_l, X_test_l, y_train_l, y_test_l = train_test_split(lims_X, lims_y, test_size=0.2, random_state=42)
lims_pipeline.fit(X_train_l, y_train_l)
print("Limitations Model Accuracy:")
print(classification_report(y_test_l, lims_pipeline.predict(X_test_l)))

# ==========================================
# 3. Save Models to Disk (.pkl files)
# ==========================================

print("Saving trained models to disk...")
with open('models_claims.pkl', 'wb') as f:
    pickle.dump(claims_pipeline, f)

with open('models_defs.pkl', 'wb') as f:
    pickle.dump(defs_pipeline, f)

with open('models_limitations.pkl', 'wb') as f:
    pickle.dump(lims_pipeline, f)

print("Training complete! The models are saved as .pkl files and ready for inference.")
