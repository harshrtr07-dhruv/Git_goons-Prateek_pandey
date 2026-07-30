# ArXiv Accelerator: Developer Setup Guide 🛠️

Welcome to the team! Follow these instructions to get the **ArXiv Accelerator** running on your local machine.

## Prerequisites
* Ensure you have [Node.js](https://nodejs.org/) installed on your machine.
* Ensure you have Git installed.

---

## Step 1: Clone the Repository
Open your terminal and pull down the code from GitHub.

```bash
# Clone the repository
git clone https://github.com/harshrtr07-dhruv/NightOut.git

# Navigate into the project folder
cd NightOut
```

---

## Step 2: Install Dependencies
The project relies on a few key packages (Express for the server, Multer for uploads, and PDF-Parse for extraction). Install them using npm.

```bash
npm install
```

---

## Step 3: Configure Environment Variables
To keep our API keys secure, we use a `.env` file that is ignored by Git. You must create this file locally for the AI features to work.

Create a file named `.env` in the root of the `NightOut` directory and add your Google Gemini API key:

```env
GEMINI_API_KEY=your_api_key_here
```
> [!IMPORTANT]  
> Ask the lead developer for the current API key if you don't have your own. Never commit this file to GitHub!

---

## Step 4: Start the Server
Once your dependencies are installed and your `.env` file is ready, you can boot up the local development server.

```bash
node server.js
```

You should see `Server is running on http://localhost:3000` in your terminal.

## Step 5: Test the Application
1. Open your browser and go to [http://localhost:3000](http://localhost:3000).
2. Upload a sample PDF (like an ArXiv research paper).
3. Verify that the PDF renders on the left and the AI generates the Dashboard (TL;DR, Claims, and Flashcards) on the right.

> [!TIP]  
> If you encounter a `404 Not Found` error when analyzing the PDF, double check that your API key in the `.env` file has access to the `gemini-3.6-flash` model.
