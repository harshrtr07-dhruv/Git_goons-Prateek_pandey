require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

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
        
        // Pass the extracted text to Python NLP Microservice
        console.log('Sending to Python NLP server for analysis...');
        
        const nlpResponse = await fetch('http://127.0.0.1:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: data.text })
        });
        
        if (!nlpResponse.ok) {
            throw new Error(`NLP server returned ${nlpResponse.status}`);
        }
        
        const analysis = await nlpResponse.json();

        console.log('Analysis complete!');
        res.json({
            message: 'Successfully processed PDF',
            extractedLength: data.text.length,
            analysis: analysis
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
