require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define the JSON Schema for the structured output
const responseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        tldr: {
            type: SchemaType.ARRAY,
            description: "A 3-point summary of the paper. What did they do, how did they do it, and why does it matter?",
            items: { type: SchemaType.STRING }
        },
        claims: {
            type: SchemaType.ARRAY,
            description: "Key claims made in the paper and the evidence quote from the text.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    claim: { type: SchemaType.STRING },
                    evidence_quote: { type: SchemaType.STRING }
                },
                required: ["claim", "evidence_quote"]
            }
        },
        flashcards: {
            type: SchemaType.ARRAY,
            description: "Study flashcards based on key concepts in the paper.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    question: { type: SchemaType.STRING },
                    answer: { type: SchemaType.STRING }
                },
                required: ["question", "answer"]
            }
        }
    },
    required: ["tldr", "claims", "flashcards"]
};

// Configure multer
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded.' });
        }

        console.log(`Extracting text from: ${req.file.originalname}`);
        const data = await pdfParse(req.file.buffer);
        console.log(`Extracted ${data.text.length} characters.`);
        
        // Pass the extracted text to Gemini
        console.log('Sending to Gemini for analysis...');
        
        // Using Gemini 3.6 Flash
        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const prompt = `You are an expert research assistant. Read the following academic paper and extract the key insights according to the requested JSON schema. \n\nPaper Text:\n${data.text}`;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Parse the JSON returned by Gemini
        const parsedAnalysis = JSON.parse(responseText);
        
        console.log('Analysis complete!');
        res.json({
            success: true,
            analysis: parsedAnalysis
        });

    } catch (error) {
        console.error('Error processing PDF:', error.message || error);
        res.status(500).json({ 
            error: 'Failed to process PDF file.', 
            details: error.message || error.toString() 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
