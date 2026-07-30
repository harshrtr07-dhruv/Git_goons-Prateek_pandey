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
# For the hackathon, we use a high-quality curated dataset of academic structures.
# In a production environment, this would be loaded from a massive CSV like SciFact.
# ==========================================

# CLAIMS DATASET
# Label 1: Sentences that are scientific claims or findings
claims_positive = [
    "We propose a novel architecture for neural networks.",
    "Our results demonstrate a significant improvement over the baseline.",
    "The experiments show that our method outperforms existing approaches by 15%.",
    "We conclude that the proposed algorithm is highly efficient.",
    "This paper introduces a new framework for data analysis.",
    "Our findings indicate a strong correlation between these two variables.",
    "We argue that previous models failed to capture this phenomenon.",
    "The data suggests that the mutation causes the disease.",
    "We hypothesized that increasing the temperature would speed up the reaction.",
    "Our key contribution is a highly scalable distributed database."
] * 50  # Multiply to simulate a larger dataset for the SVM

# Label 0: Sentences that are NOT claims (background info, generic text, noise)
claims_negative = [
    "The sky is blue today.",
    "Neural networks are a type of machine learning model.",
    "In Section 2, we review the related work.",
    "Table 1 shows the summary statistics.",
    "Please refer to the appendix for more details.",
    "Data was collected in 2021.",
    "The system requires 8GB of RAM.",
    "He walked to the store to buy some milk.",
    "Equation 5 describes the loss function.",
    "This work was supported by a grant from the NSF."
] * 50

claims_X = claims_positive + claims_negative
claims_y = [1] * len(claims_positive) + [0] * len(claims_negative)

# FLASHCARDS/DEFINITIONS DATASET
# Label 1: Sentences that define a concept (good for flashcards)
defs_positive = [
    "Machine learning is defined as the study of computer algorithms that improve automatically.",
    "Photosynthesis refers to the process by which plants make their own food.",
    "A black hole is known as a region of spacetime where gravity is so strong that nothing can escape.",
    "By deep learning, we mean artificial neural networks with multiple layers.",
    "An algorithm can be described as a step-by-step procedure for calculations.",
    "DNA stands for Deoxyribonucleic acid.",
    "A binary tree is a data structure in which each node has at most two children.",
    "Entropy characterizes the amount of uncertainty in a system.",
    "The placebo effect is a psychological phenomenon.",
    "In chemistry, a catalyst is a substance that speeds up a reaction."
] * 50

# Label 0: Sentences that are NOT definitions
defs_negative = [
    "We tested the model on the validation set.",
    "The results are shown in Figure 3.",
    "It is raining outside today.",
    "We propose a new method for image classification.",
    "The authors of the paper are researchers at MIT.",
    "Thank you for reading this abstract.",
    "The server crashed yesterday.",
    "This is a very interesting topic.",
    "We can see a clear trend in the graph.",
    "I like to eat pizza."
] * 50

defs_X = defs_positive + defs_negative
defs_y = [1] * len(defs_positive) + [0] * len(defs_negative)

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

# ==========================================
# 3. Save Models to Disk (.pkl files)
# ==========================================

print("Saving trained models to disk...")
with open('models_claims.pkl', 'wb') as f:
    pickle.dump(claims_pipeline, f)

with open('models_defs.pkl', 'wb') as f:
    pickle.dump(defs_pipeline, f)

print("Training complete! The models are saved as .pkl files and ready for inference.")
