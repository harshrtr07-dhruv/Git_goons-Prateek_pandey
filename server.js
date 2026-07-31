require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;

const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

function extractNodeAnalysis(text) {
    const rawSentences = text.replace(/\n/g, ' ')
        .replace(/[\•\▪\⁃\u2022]/g, '. ')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.split(' ').length >= 5);

    const sentences = rawSentences.length >= 3 ? rawSentences : [text.slice(0, 300)];

    const tldr = sentences.slice(0, 3);

    const claimKeywords = ['show', 'demonstrate', 'propose', 'achieve', 'outperform', 'introduce', 'find', 'result', 'state-of-the-art', 'accuracy'];
    let claims = sentences.filter(s => claimKeywords.some(kw => s.toLowerCase().includes(kw))).slice(0, 5).map(s => ({
        claim: s.length > 150 ? s.slice(0, 147) + '...' : s,
        evidence_quote: s
    }));
    if (claims.length === 0) {
        claims = [{ claim: sentences[0] || 'Core research findings presented in this paper.', evidence_quote: sentences[0] || 'N/A' }];
    }

    const limKeywords = ['limit', 'limitation', 'drawback', 'constraint', 'restrict', 'challenge', 'bottleneck', 'fails', 'unable', 'future work', 'trade-off', 'cost', 'expensive', 'however', 'although'];
    let limitations = sentences.filter(s => limKeywords.some(kw => s.toLowerCase().includes(kw))).slice(0, 4);
    if (limitations.length < 2) {
        sentences.forEach(s => {
            const words = s.split(' ').length;
            if (limitations.length < 3 && words >= 12 && words <= 35 && !limitations.includes(s)) {
                limitations.push(s);
            }
        });
    }

    const flashcards = [];
    const defWords = [' is a ', ' refers to ', ' defined as ', ' consists of ', ' known as '];
    for (const sentence of sentences) {
        if (flashcards.length >= 6) break;
        const sLower = sentence.toLowerCase();
        for (const dw of defWords) {
            if (sLower.includes(dw)) {
                const idx = sLower.indexOf(dw);
                const term = sentence.slice(0, idx).trim();
                const def = sentence.slice(idx + dw.length).trim();
                if (term.length > 3 && term.length < 45) {
                    flashcards.push({
                        question: `What is ${term}?`,
                        answer: `It is ${def.replace(/\.$/, '')}.`
                    });
                    break;
                }
            }
        }
    }

    const stopWords = new Set(['the','a','an','and','or','but','about','above','after','again','against','all','am','an','and','any','are','aren\'t','as','at','be','because','been','before','being','below','between','both','but','by','can','can\'t','cannot','could','couldn\'t','did','didn\'t','do','does','doesn\'t','doing','don\'t','down','during','each','few','for','from','further','had','hadn\'t','has','hasn\'t','have','haven\'t','having','he','he\'d','he\'ll','he\'s','her','here','here\'s','hers','herself','him','himself','his','how','how\'s','i','i\'d','i\'ll','i\'m','i\'ve','if','in','into','is','isn\'t','it','it\'s','its','itself','let\'s','me','more','most','mustn\'t','my','myself','no','nor','not','of','off','on','once','only','or','other','ought','our','ours','ourselves','out','over','own','same','shan\'t','she','she\'d','she\'ll','she\'s','should','shouldn\'t','so','some','such','than','that','that\'s','the','their','theirs','them','themselves','then','there','there\'s','these','they','they\'d','they\'ll','they\'re','they\'ve','this','those','through','to','too','under','until','up','very','was','wasn\'t','we','we\'d','we\'ll','we\'re','we\'ve','were','weren\'t','what','what\'s','when','when\'s','where','where\'s','which','while','who','who\'s','whom','why','why\'s','with','won\'t','would','wouldn\'t','you','you\'d','you\'ll','you\'re','you\'ve','your','yours','yourself','yourselves','paper','using','method','results','figure','table','section','model','data','work','used']);

    const wordFreq = {};
    const wordSentences = {};

    sentences.forEach(s => {
        const words = s.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        const uniqueInSentence = new Set(words);
        uniqueInSentence.forEach(w => {
            if (!stopWords.has(w)) {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
                if (!wordSentences[w]) wordSentences[w] = s;
            }
        });
    });

    const sortedTerms = Object.keys(wordFreq).sort((a, b) => wordFreq[b] - wordFreq[a]).slice(0, 6);

    const nodes = sortedTerms.map(term => ({
        id: term,
        label: term.charAt(0).toUpperCase() + term.slice(1),
        description: wordSentences[term] || `Key concept discussed in paper: ${term}`
    }));

    if (nodes.length < 4) {
        ['Analysis', 'Framework', 'Methodology', 'Evaluation'].forEach(term => {
            if (nodes.length < 6 && !nodes.some(n => n.id === term.toLowerCase())) {
                nodes.push({ id: term.toLowerCase(), label: term, description: `Core structural element: ${term}` });
            }
        });
    }

    const links = [];
    for (let i = 0; i < nodes.length - 1; i++) {
        links.push({ source: nodes[i].id, target: nodes[i + 1].id });
    }

    if (flashcards.length < 4 && nodes.length > 0) {
        nodes.forEach(n => {
            if (flashcards.length < 6) {
                flashcards.push({ question: `What is ${n.label}?`, answer: n.description });
            }
        });
    }

    return {
        tldr,
        claims,
        limitations,
        flashcards,
        concept_map: { nodes, links },
        extractedLength: text.length
    };
}

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
        
        // 2. Pass the raw PDF buffer to Python NLP server with Node.js in-memory fallback
        console.log('Analyzing PDF...');
        let analysis = null;
        try {
            const host = req.headers.host || 'localhost:3000';
            const protocol = req.headers['x-forwarded-proto'] || (process.env.VERCEL ? 'https' : 'http');
            const defaultVercelUrl = `${protocol}://${host}/api/analyze`;
            const nlpServerUrl = process.env.NLP_SERVER_URL || (process.env.VERCEL ? defaultVercelUrl : 'http://127.0.0.1:5000/analyze');
            
            const nlpResponse = await fetch(nlpServerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/pdf' },
                body: req.file.buffer
            });
            
            if (nlpResponse.ok) {
                analysis = await nlpResponse.json();
            }
        } catch (e) {
            console.warn('Python NLP server notice:', e.message);
        }

        // Guaranteed Fallback Engine: If Python NLP server is delayed or unreachable on Vercel
        if (!analysis || !analysis.concept_map || !analysis.concept_map.nodes || analysis.concept_map.nodes.length === 0 || !analysis.limitations || analysis.limitations.length === 0) {
            console.log('Running high-speed in-memory Node.js PDF NLP engine...');
            const parsedPdf = await pdfParse(req.file.buffer);
            const text = parsedPdf.text || '';
            const fallbackAnalysis = extractNodeAnalysis(text);

            if (!analysis) {
                analysis = fallbackAnalysis;
            } else {
                if (!analysis.concept_map || !analysis.concept_map.nodes || analysis.concept_map.nodes.length === 0) {
                    analysis.concept_map = fallbackAnalysis.concept_map;
                }
                if (!analysis.limitations || analysis.limitations.length === 0) {
                    analysis.limitations = fallbackAnalysis.limitations;
                }
            }
        }

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
