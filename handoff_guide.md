# Project Handoff & Production Roadmap 🚀

Welcome to the **ArXiv Accelerator**! If you are reading this, you are taking over the project to push it across the finish line for the hackathon and into production. 

This document outlines exactly where the architecture currently stands, and provides a step-by-step roadmap for what you need to do next.

---

## 🏛️ Current Architecture Status

We recently executed a massive pivot. To comply with hackathon rules (No API Keys / No Commercial Pretrained Models), we ripped out the Google Gemini API and built our own Machine Learning engine from scratch.

The app now uses a **Two-Tier Architecture**:
1. **The Node.js Server (`server.js`):** Handles the frontend UI, receives the PDF upload, and extracts the raw text using `pdf-parse`. It then sends that text via HTTP to the Python microservice.
2. **The Python ML Microservice (`nlp_server.py`):** A local Flask API running on port `5000`. It receives the text, uses NLTK to split it into sentences, and runs those sentences through our custom-trained **Scikit-Learn Support Vector Machine (SVM)** models to extract claims and definitions.

---

## 🎯 Immediate Priority: Authentic ML Data Training

Currently, `train_model.py` uses a "synthetic" dataset built directly into the file. Your first task is to swap this out to download a real academic dataset from the internet. This will massively boost the model's accuracy and impress the judges.

### Step 1: Update `train_model.py`
You need to install `pandas` (`pip install pandas`) and rewrite the dataset loading section of `train_model.py`. 

Instead of hardcoded arrays, pull a real dataset like **SciFact**:
```python
import pandas as pd

# Example: Loading a public dataset from a URL
print("Downloading SciFact dataset...")
df = pd.read_csv("https://raw.githubusercontent.com/allenai/scifact/master/data/claims.csv")

# Assuming the CSV has columns 'text' and 'is_claim'
claims_X = df['text'].tolist()
claims_y = df['is_claim'].tolist()
```
*Note: You will need to find a direct URL to a raw CSV/JSON of SciFact (for claims) and SQuAD (for definitions/flashcards) and parse it accordingly.*

### Step 2: Retrain the Models
Once the script is updated to use pandas, run:
```bash
python train_model.py
```
This will download the data, train the SVMs using TF-IDF, and overwrite the `models_claims.pkl` and `models_defs.pkl` files with your highly accurate, real-world models.

---

## 🚀 Steps to Production

Once the data training is complete, follow these steps to make the app production-ready.

### 1. Secure the Python Microservice
Currently, `nlp_server.py` uses Flask's built-in development server. This is not suitable for production.
> [!WARNING]
> Do not deploy Flask using `app.run()`.

*   **Action:** Install a production WSGI server. If deploying to Linux, use `gunicorn`. If deploying to Windows, use `waitress`.
*   **Command:** `pip install gunicorn`
*   **Run:** `gunicorn -w 4 -b 127.0.0.1:5000 nlp_server:app`

### 2. Containerization (Docker)
To avoid "it works on my machine" issues, you need to bundle the Node.js app and the Python app together.
*   **Action:** Write a `docker-compose.yml` file that spins up two containers: one for the Node server, and one for the Python Flask server. Ensure the Node server communicates with the Python container via Docker's internal networking instead of `localhost`.

### 3. Improve PDF Parsing
`pdf-parse` is fast, but it struggles with multi-column academic layouts and math formulas.
*   **Action:** Research swapping `pdf-parse` in `server.js` with a more robust layout-aware parser, or send the raw PDF to the Python server and use a library like `PyMuPDF` (fitz) which is much better at reading academic layouts.

### 4. Edge Cases in the UI
*   **Action:** In `app.js`, add loading spinners specifically for the Python API call (which may take a few seconds if the paper is long). Ensure graceful error handling if the Python microservice crashes or is unreachable.

---

## 💻 How to Run the Project Locally (Right Now)

To get up to speed immediately, run these commands in two separate terminal windows:

**Terminal 1 (The ML Brains):**
```bash
# Install dependencies
pip install flask nltk scikit-learn networkx pandas

# Train the models (generates .pkl files)
python train_model.py

# Start the Flask microservice
python nlp_server.py
```

**Terminal 2 (The Web App):**
```bash
# Install node packages
npm install

# Start the web server
node server.js
```
Then navigate to `http://localhost:3000` to see the app!
