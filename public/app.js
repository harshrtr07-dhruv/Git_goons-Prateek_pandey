document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // UI Elements
    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const fileInput = document.getElementById('pdfUpload');
    const uploadCard = document.querySelector('.upload-card');
    const pdfViewerContainer = document.getElementById('pdfViewerContainer');
    const pdfTitle = document.getElementById('pdfTitle');
    const closePdfBtn = document.getElementById('closePdfBtn');

    // 2. Tab Switching Logic (Right Panel Dashboard)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            
            const targetId = btn.getAttribute('data-tab');
            const targetPane = document.getElementById(targetId);
            if(targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    // 3. Close PDF Logic
    if (closePdfBtn) {
        closePdfBtn.addEventListener('click', () => {
            workspaceState.classList.add('hidden');
            uploadState.classList.add('active');
            uploadState.style.display = 'flex';
            fileInput.value = '';
            pdfViewerContainer.innerHTML = '';
        });
    }

    // 4. File Upload Drag and Drop
    if (uploadCard) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadCard.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadCard.addEventListener(eventName, () => {
                uploadCard.style.borderColor = '#000';
                uploadCard.style.background = 'rgba(255, 255, 255, 0.6)';
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadCard.addEventListener(eventName, () => {
                uploadCard.style.borderColor = 'rgba(0,0,0,0.2)';
                uploadCard.style.background = 'var(--bg-panel)';
            }, false);
        });

        uploadCard.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if(files.length > 0 && files[0].type === 'application/pdf') {
                fileInput.files = files;
                handleFileUpload(files[0]);
            }
        }, false);
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }

    async function handleFileUpload(file) {
        // UI Switch to Workspace
        uploadState.classList.remove('active');
        uploadState.style.display = 'none';
        workspaceState.classList.remove('hidden');
        
        pdfTitle.textContent = file.name;
        pdfViewerContainer.innerHTML = '<div style="margin: auto; color: #333;">Loading PDF...</div>';
        
        // Render PDF visually
        renderPDF(file);

        // Send to backend for NLP Analysis
        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            if (data.analysis) {
                updateDashboard(data.analysis);
            }
        } catch (error) {
            console.error("Error analyzing PDF:", error);
            alert("Failed to analyze the PDF. Make sure the backend is running properly.");
        }
    }

    function updateDashboard(analysis) {
        // 1. Update TLDR (Extractive Summary)
        const tldrList = document.getElementById('tldrList');
        if (tldrList && analysis.tldr && analysis.tldr.length > 0) {
            tldrList.innerHTML = '';
            analysis.tldr.forEach(sentence => {
                const li = document.createElement('li');
                li.textContent = sentence;
                tldrList.appendChild(li);
            });
        }

        // 2. Update Flashcards
        const flashcardFront = document.getElementById('flashcardFront');
        const flashcardBack = document.getElementById('flashcardBack');
        if (flashcardFront && flashcardBack && analysis.flashcards && analysis.flashcards.length > 0) {
            const firstCard = analysis.flashcards[0];
            flashcardFront.textContent = firstCard.question;
            flashcardBack.textContent = firstCard.answer;
        }

        // 3. Update Claims & Evidence
        const claimsList = document.getElementById('claimsList');
        if (claimsList && analysis.claims && analysis.claims.length > 0) {
            claimsList.innerHTML = '';
            analysis.claims.forEach((claimObj, index) => {
                // Determine a mock relevance score based on index to look nice
                const score = (0.95 - (index * 0.05)).toFixed(2);
                
                const claimHtml = `
                    <div class="claim-card glass-box">
                        <div class="claim-header">
                            <span class="metric-tag">Relevance Score: ${score}</span>
                        </div>
                        <p class="claim-text">${claimObj.claim}</p>
                        <p class="subtext" style="margin-bottom: 1rem; font-style: italic;">"${claimObj.evidence_quote}"</p>
                        <button class="gradient-btn outline">
                            <i data-lucide="target"></i> Locate in PDF
                        </button>
                    </div>
                `;
                claimsList.innerHTML += claimHtml;
            });
            // Re-initialize any new lucide icons
            lucide.createIcons();
        }
    }

    // 5. PDF.js Rendering Logic
    async function renderPDF(file) {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                pdfViewerContainer.innerHTML = ''; // Clear loading text
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                console.log('PDF loaded, pages:', pdf.numPages);
                
                // Render the first few pages (up to 5 to save memory)
                const pagesToRender = Math.min(pdf.numPages, 5);
                for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const scale = 1.5;
                    const viewport = page.getViewport({ scale: scale });

                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.className = 'pdf-page';

                    pdfViewerContainer.appendChild(canvas);

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };
                    await page.render(renderContext).promise;
                }
            } catch (error) {
                console.error("Error rendering PDF:", error);
                pdfViewerContainer.innerHTML = `<div style="color:red">Failed to render PDF preview.</div>`;
            }
        };
        fileReader.readAsArrayBuffer(file);
    }

    // 6. Flashcard 3D Flip Logic
    const flipBtn = document.getElementById('flipBtn');
    const flashcard = document.getElementById('flashcard');
    
    if (flipBtn && flashcard) {
        flipBtn.addEventListener('click', () => {
            flashcard.classList.toggle('flipped');
        });
    }

    // 7. BM25 Grounding Simulation (Locate in PDF)
    const locateBtn = document.getElementById('locateTargetBtn');

    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            const originalHtml = locateBtn.innerHTML;
            locateBtn.innerHTML = '<i data-lucide="check-circle"></i> Target (Simulated)';
            lucide.createIcons();
            
            setTimeout(() => {
                locateBtn.innerHTML = originalHtml;
                lucide.createIcons();
            }, 2000);
        });
    }

    // 8. Theory-to-Code Linker Tabs
    const codeTabs = document.querySelectorAll('.code-tab');
    const codeSnippet = document.getElementById('codeSnippet');

    const snippets = {
        python: `# Self-Attention Mechanism (Simplified)
def self_attention(query, key, value):
    d_k = query.size(-1)
    # Compute attention scores
    scores = torch.matmul(query, key.transpose(-2, -1)) / math.sqrt(d_k)
    # Apply softmax
    p_attn = F.softmax(scores, dim=-1)
    # Multiply by values
    return torch.matmul(p_attn, value)`,
        cpp: `// Self-Attention Computation (C++ LibTorch)
Tensor self_attention(Tensor query, Tensor key, Tensor value) {
    auto d_k = query.size(-1);
    // Scores: (Q * K^T) / sqrt(d_k)
    auto scores = torch::matmul(query, key.transpose(-2, -1)) / std::sqrt(d_k);
    auto p_attn = torch::softmax(scores, /*dim=*/-1);
    return torch::matmul(p_attn, value);
}`,
        java: `// Attention mechanism in Java (using DJL)
public NDArray selfAttention(NDArray query, NDArray key, NDArray value) {
    long d_k = query.getShape().get(query.getShape().dimension() - 1);
    // Matrix multiplication
    NDArray scores = query.matMul(key.transpose(-2, -1))
                          .div(Math.sqrt(d_k));
    NDArray pAttn = NDArrays.softmax(scores, -1);
    return pAttn.matMul(value);
}`
    };

    codeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            codeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const lang = tab.getAttribute('data-lang');
            if (codeSnippet && snippets[lang]) {
                codeSnippet.className = `language-${lang}`;
                codeSnippet.textContent = snippets[lang];
            }
        });
    });
});
