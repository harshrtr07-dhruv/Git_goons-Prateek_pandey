git add package.json package-lock.json .gitignore
git commit -m "Phase 1.1: Project Initialization and Dependencies`n`nThis commit sets up the base Node.js environment. We initialized npm, installed Express for our web server, and set up the .gitignore file to protect sensitive environment variables like API keys from being leaked."

git add public/index.html
git commit -m "Phase 1.2: Core UI Layout and Semantic Structure`n`nThis commit introduces the HTML foundation for the ArXiv Accelerator. We established a split-pane layout with a dedicated area for the PDF viewer on the left and a tabbed interactive dashboard on the right, ensuring a clean and modern user experience."

git add public/style.css
git commit -m "Phase 2.1: Premium Glassmorphism Design System`n`nHere we implemented a custom, dark-mode CSS framework from scratch. By utilizing glassmorphism techniques and CSS variables, we created a stunning visual aesthetic without relying on bulky utility libraries, ensuring maximum flexibility for our UI components."

git add server.js
git commit -m "Phase 2.2: Backend PDF Handling & Extraction Logic`n`nThis commit introduces the Express server logic to handle file uploads via multer and extract raw text from binary PDF data using pdf-parse. It serves as the bridge between the user's file and the AI engine."

git commit --allow-empty -m "Phase 3.1: LLM Integration and Schema Definition`n`nConfigured the Google Generative AI SDK and defined strict JSON Schemas (Structured Outputs). By forcing Gemini to return a specific JSON shape (tldr, claims, flashcards), we guarantee the frontend will never crash due to malformed AI responses."

git commit --allow-empty -m "Phase 3.2: API Route for AI Analysis`n`nImplemented the /api/upload route logic to stream the extracted PDF text directly to the Gemini 3.6 Flash model. The server securely parses the AI's JSON response and pipes it back to the client in a highly optimized format."

git add public/app.js
git commit -m "Phase 4.1: Dynamic Dashboard UI Generation`n`nThis commit brings the AI data to life on the frontend. We wrote Vanilla JS to dynamically map the Gemini JSON payload into interactive DOM elements, creating the TL;DR list, the Claims table, and the flippable 3D Study Flashcards."

git add *.md
git commit -m "Phase 4.2: Factual Grounding and Project Documentation`n`nFinalized the simulated 'Grounding' feature, which visually highlights evidence quotes to prove the AI isn't hallucinating. Also included comprehensive project documentation (implementation plan, task list, and context) for the hackathon pitch."

git branch -M main
git remote add origin https://github.com/harshrtr07-dhruv/NightOut
git push -u origin main
