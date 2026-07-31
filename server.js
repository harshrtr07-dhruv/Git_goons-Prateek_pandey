require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/auth/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// Middleware to verify Supabase JWT
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
};

app.post('/api/upload', requireAuth, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded.' });
        }

        console.log(`Received PDF: ${req.file.originalname}`);
        
        // 1. Upload to Cloudinary
        console.log('Uploading raw PDF to Cloudinary...');
        const cloudinaryUpload = new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { resource_type: 'raw', format: 'pdf' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        const cloudinaryResult = await cloudinaryUpload;
        const pdfUrl = cloudinaryResult.secure_url;
        console.log(`Cloudinary Upload Success: ${pdfUrl}`);
        
        // 2. Pass the raw PDF buffer to Python NLP server
        console.log('Sending raw PDF to Python NLP server for analysis...');
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const defaultVercelUrl = `${protocol}://${host}/api/analyze`;
        const nlpServerUrl = process.env.NLP_SERVER_URL || (process.env.VERCEL ? defaultVercelUrl : 'http://127.0.0.1:5000/analyze');
        const nlpResponse = await fetch(nlpServerUrl, {
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

        // 3. Save History to Supabase
        console.log('Saving to Document History...');
        const userToken = req.headers.authorization.replace('Bearer ', '');
        const scopedSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${userToken}` } }
        });

        const { data: historyData, error: dbError } = await scopedSupabase
            .from('document_history')
            .insert([{
                user_id: req.user.id,
                filename: req.file.originalname,
                cloudinary_url: pdfUrl,
                analysis_json: analysis
            }]);

        if (dbError) {
            console.error('Supabase Error:', dbError);
            throw new Error('Failed to save document history');
        }

        res.json({
            message: 'Successfully processed PDF and saved history',
            extractedLength: analysis.extractedLength || 0,
            analysis: analysis,
            history_saved: true
        });

    } catch (error) {
        console.error('Error processing PDF:', error.message || error);
        res.status(500).json({ 
            error: 'Failed to process PDF file.', 
            details: error.message || error.toString() 
        });
    }
});

app.get('/api/history', requireAuth, async (req, res) => {
    try {
        const userToken = req.headers.authorization.replace('Bearer ', '');
        const scopedSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${userToken}` } }
        });

        const { data, error } = await scopedSupabase
            .from('document_history')
            .select('id, filename, cloudinary_url, created_at, analysis_json')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase fetch error:', error);
            throw new Error('Failed to fetch history');
        }

        res.json({ history: data });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
