# ArXiv Accelerator: Research Paper Briefing Agent 🚀

## 🎯 The Problem
Students, researchers, and hackathon teams often face a daunting task: reading 20-page, jargon-heavy academic PDFs to find a single methodology or claim. 

While generic AI tools can "summarize" these PDFs, they produce unverified walls of text. If you can't trust the summary, it doesn't actually save you time. You need a tool that **dissects** the paper, helps you **learn** it, and **proves** its accuracy.

## 🚀 The Solution
We are building a highly visual, interactive web app called **ArXiv Accelerator**. 

Instead of just chatting with a PDF, users upload a paper and are instantly presented with a sleek, split-screen command center:
1. **The Source:** The original PDF rendered on the left.
2. **The Dashboard:** The AI's structured analysis on the right.

### Core Features
*   **Clarity (The TL;DR):** The AI extracts a punchy, 3-point summary: *What did they do? How did they do it? Why does it matter?*
*   **Genuine Learning Aid (Study Mode):** The agent automatically generates interactive, flippable Q&A flashcards based on the paper's core concepts so students can test their knowledge.
*   **Factual Grounding (The "Killer Feature"):** The AI extracts a table of "Claims vs. Evidence". Clicking an AI-generated claim will visually highlight the exact sentence in the PDF on the left. **This proves the AI isn't hallucinating.**

## 🛠️ The Architecture & Tech Stack
1. **Frontend (Vanilla HTML/CSS/JS):** Custom glassmorphism UI, tabbed navigation, and `pdf.js` for rendering.
2. **Backend (Node.js & Express):** Fast server using `multer` for uploads and `pdf-parse` for text extraction.
3. **The LLM Brains (Google Gemini 3.6 Flash):** Uses Structured Outputs (JSON Schema) to guarantee perfect extraction format.
