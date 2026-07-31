# Copy documentation from artifacts to project directory
Copy-Item "C:\Users\harshrtr_07\.gemini\antigravity-ide\brain\d2355366-4dd7-4bfc-9409-a4d179e1c535\developer_setup.md" -Destination ".\developer_setup.md" -ErrorAction SilentlyContinue
Copy-Item "C:\Users\harshrtr_07\.gemini\antigravity-ide\brain\d2355366-4dd7-4bfc-9409-a4d179e1c535\handoff_guide.md" -Destination ".\handoff_guide.md" -ErrorAction SilentlyContinue

# Commit 1
git add train_model.py
git commit -m "Phase 5.1: Custom Machine Learning Training Pipeline`n`nSignificance: Introduced train_model.py to programmatically generate an academic dataset and train Scikit-Learn SVM classifiers. This ensures we are 100% compliant with the hackathon rules by building our own intelligence engine."

# Commit 2
git add nlp_server.py
git commit -m "Phase 5.2: Python NLP Microservice`n`nSignificance: Created a Flask API (nlp_server.py) that loads the trained .pkl models. It replaces hardcoded heuristics with genuine ML predictions to extract claims and definitions using NLTK and TF-IDF."

# Commit 3
git add server.js models_claims.pkl models_defs.pkl
git commit -m "Phase 5.3: Node.js API Pivot & Model Weights`n`nSignificance: Completely removed the third-party Gemini API from server.js. The Node backend now acts as a proxy, sending the extracted PDF text directly to our local Python microservice for processing."

# Commit 4
git add developer_setup.md handoff_guide.md
git commit -m "Phase 6.1: Production Roadmap and Developer Handoff`n`nSignificance: Added comprehensive documentation including developer setup instructions and a clear roadmap for pulling internet datasets and containerizing the app for production."

git push origin main
