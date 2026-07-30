require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
// We now use PyMuPDF in the Python server instead of pdf-parse here

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

        console.log(`Received PDF: ${req.file.originalname}`);
        
        // Pass the raw PDF buffer directly to the Python NLP Microservice for superior PyMuPDF parsing
        console.log('Sending raw PDF to Python NLP server for analysis...');
        
        const nlpResponse = await fetch('http://127.0.0.1:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/pdf'
            },
            body: req.file.buffer
        });
        
        if (!nlpResponse.ok) {
            throw new Error(`NLP server returned ${nlpResponse.status}`);
        }
        
        const analysis = await nlpResponse.json();

        console.log('Analysis complete!');
        res.json({
            message: 'Successfully processed PDF',
            extractedLength: analysis.extractedLength || 0,
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
