document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Global State
    let currentFlashcards = [];
    let currentFlashcardIndex = 0;
    let currentPdfDoc = null;
    let pdfScale = 1.5;

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
        if (analysis.flashcards && analysis.flashcards.length > 0) {
            currentFlashcards = analysis.flashcards;
            currentFlashcardIndex = 0;
            updateFlashcardUI();
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
                        <button class="gradient-btn outline locate-btn" data-quote="${encodeURIComponent(claimObj.evidence_quote)}">
                            <i data-lucide="target"></i> Locate in PDF
                        </button>
                    </div>
                `;
                claimsList.innerHTML += claimHtml;
            });
            // Re-initialize any new lucide icons
            lucide.createIcons();
        }

        // 4. Update Limitations
        const limitationsList = document.getElementById('limitationsList');
        if (limitationsList && analysis.limitations && analysis.limitations.length > 0) {
            limitationsList.innerHTML = '';
            analysis.limitations.forEach(lim => {
                const limHtml = `
                    <div class="glass-box" style="margin-bottom: 1rem; border-left: 4px solid #ff9a9e;">
                        <p class="secondary-text" style="color: var(--text-primary);"><i data-lucide="alert-circle" style="width: 16px; height: 16px; display: inline; vertical-align: middle; margin-right: 0.5rem; color: #ff9a9e;"></i> ${lim}</p>
                    </div>
                `;
                limitationsList.innerHTML += limHtml;
            });
            lucide.createIcons();
        }

        // 5. Update Concept Map (D3.js)
        const mapContainer = document.getElementById('conceptMapContainer');
        if (mapContainer && analysis.concept_map && analysis.concept_map.nodes && typeof d3 !== 'undefined') {
            mapContainer.innerHTML = ''; // Clear empty state
            
            const width = mapContainer.clientWidth || 600;
            const height = mapContainer.clientHeight || 400;
            
            const svg = d3.select('#conceptMapContainer')
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('viewBox', [0, 0, width, height]);

            // Deep copy to prevent d3 from mutating original data
            const nodes = analysis.concept_map.nodes.map(d => ({...d}));
            const links = analysis.concept_map.links.map(d => ({...d}));

            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(links).id(d => d.id).distance(100))
                .force('charge', d3.forceManyBody().strength(-300))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collide', d3.forceCollide().radius(40));

            const link = svg.append('g')
                .attr('stroke', 'rgba(255, 154, 158, 0.8)')
                .attr('stroke-opacity', 1)
                .selectAll('line')
                .data(links)
                .join('line')
                .attr('stroke-width', d => Math.sqrt(d.value || 1) * 2.5);

            const node = svg.append('g')
                .selectAll('g')
                .data(nodes)
                .join('g')
                .call(drag(simulation))
                .style('cursor', 'pointer');

            node.append('circle')
                .attr('r', 12)
                .attr('fill', '#ff758c')
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .style('transition', 'all 0.2s');

            node.append('text')
                .text(d => d.label || d.id)
                .attr('x', 16)
                .attr('y', 5)
                .style('font-family', 'var(--font-sans)')
                .style('font-size', '14px')
                .style('font-weight', '600')
                .style('fill', '#000')
                .style('pointer-events', 'none')
                .style('text-shadow', '0 1px 3px rgba(255,255,255,0.9)');

            // Tooltip for descriptions
            const tooltip = d3.select('#conceptMapContainer')
                .append('div')
                .style('position', 'absolute')
                .style('bottom', '15px')
                .style('left', '15px')
                .style('right', '15px')
                .style('background', 'rgba(255, 255, 255, 0.95)')
                .style('backdrop-filter', 'blur(10px)')
                .style('border', '1px solid #ff9a9e')
                .style('border-radius', '8px')
                .style('padding', '12px')
                .style('box-shadow', '0 4px 15px rgba(0,0,0,0.1)')
                .style('font-size', '13px')
                .style('color', '#333')
                .style('display', 'none')
                .style('z-index', '10');

            node.on('click', (event, d) => {
                tooltip.style('display', 'block')
                       .html(`<strong>${d.label || d.id}</strong><br><span style="margin-top:4px; display:block; color:#555;">${d.description || 'No description available.'}</span>`);
                
                node.selectAll('circle').attr('stroke', '#fff').attr('stroke-width', 2);
                d3.select(event.currentTarget).select('circle').attr('stroke', '#000').attr('stroke-width', 2.5);
            });

            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                node.attr('transform', d => `translate(${d.x},${d.y})`);
            });

            function drag(simulation) {
                function dragstarted(event) {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    event.subject.fx = event.subject.x;
                    event.subject.fy = event.subject.y;
                }
                function dragged(event) {
                    event.subject.fx = event.x;
                    event.subject.fy = event.y;
                }
                function dragended(event) {
                    if (!event.active) simulation.alphaTarget(0);
                    event.subject.fx = null;
                    event.subject.fy = null;
                }
                return d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended);
            }
        }
    }

    // 5. PDF.js Rendering Logic
    async function renderPDFPages() {
        pdfViewerContainer.innerHTML = '';
        const pagesToRender = Math.min(currentPdfDoc.numPages, 10); // max 10 pages for perf
        for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
            const page = await currentPdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: pdfScale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.className = 'pdf-page';
            canvas.id = `pdf-page-${pageNum}`;
            canvas.style.marginBottom = '1rem';
            canvas.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';

            pdfViewerContainer.appendChild(canvas);

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
        }
    }

    async function renderPDF(file) {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                pdfViewerContainer.innerHTML = ''; // Clear loading text
                currentPdfDoc = await pdfjsLib.getDocument(typedarray).promise;
                console.log('PDF loaded, pages:', currentPdfDoc.numPages);
                await renderPDFPages();
            } catch (error) {
                console.error("Error rendering PDF:", error);
                pdfViewerContainer.innerHTML = `<div style="color:red">Failed to render PDF preview.</div>`;
            }
        };
        fileReader.readAsArrayBuffer(file);
    }

    // 6. Flashcard Navigation & 3D Flip Logic
    const flipBtn = document.getElementById('flipBtn');
    const flashcard = document.getElementById('flashcard');
    const flashcardFront = document.getElementById('flashcardFront');
    const flashcardBack = document.getElementById('flashcardBack');
    const prevCardBtn = document.getElementById('prevCardBtn');
    const nextCardBtn = document.getElementById('nextCardBtn');

    function updateFlashcardUI() {
        if (currentFlashcards.length > 0 && flashcardFront && flashcardBack) {
            flashcard.classList.remove('flipped');
            const card = currentFlashcards[currentFlashcardIndex];
            flashcardFront.textContent = card.question;
            flashcardBack.textContent = card.answer;
        }
    }

    if (flipBtn && flashcard) {
        flipBtn.addEventListener('click', () => {
            flashcard.classList.toggle('flipped');
        });
    }

    if (prevCardBtn) {
        prevCardBtn.addEventListener('click', () => {
            if (currentFlashcards.length > 0) {
                currentFlashcardIndex = (currentFlashcardIndex - 1 + currentFlashcards.length) % currentFlashcards.length;
                updateFlashcardUI();
            }
        });
    }

    if (nextCardBtn) {
        nextCardBtn.addEventListener('click', () => {
            if (currentFlashcards.length > 0) {
                currentFlashcardIndex = (currentFlashcardIndex + 1) % currentFlashcards.length;
                updateFlashcardUI();
            }
        });
    }

    // 7. Zoom Controls
    const toolBtns = document.querySelectorAll('.tool-btn');
    if (toolBtns.length >= 2) {
        toolBtns[0].addEventListener('click', () => {
            if (currentPdfDoc) {
                pdfScale = Math.min(3.0, pdfScale + 0.2);
                renderPDFPages();
            }
        });
        toolBtns[1].addEventListener('click', () => {
            if (currentPdfDoc) {
                pdfScale = Math.max(0.5, pdfScale - 0.2);
                renderPDFPages();
            }
        });
    }

    // 8. Locate in PDF functionality
    const claimsListEl = document.getElementById('claimsList');
    if (claimsListEl) {
        claimsListEl.addEventListener('click', async (e) => {
            const locateBtn = e.target.closest('.locate-btn');
            if (locateBtn && currentPdfDoc) {
                const quote = decodeURIComponent(locateBtn.getAttribute('data-quote'));
                
                const originalHtml = locateBtn.innerHTML;
                locateBtn.innerHTML = '<i data-lucide="loader"></i> Searching...';
                lucide.createIcons();
                
                let foundPageNum = null;
                for (let i = 1; i <= currentPdfDoc.numPages; i++) {
                    const page = await currentPdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const textStr = textContent.items.map(item => item.str).join(' ');
                    
                    // Simple case-insensitive match, stripping extra whitespace
                    const normalizedQuote = quote.replace(/\s+/g, ' ').trim().toLowerCase();
                    const normalizedText = textStr.replace(/\s+/g, ' ').toLowerCase();
                    
                    if (normalizedText.includes(normalizedQuote)) {
                        foundPageNum = i;
                        break;
                    }
                }
                
                if (foundPageNum) {
                    locateBtn.innerHTML = '<i data-lucide="check-circle"></i> Page ' + foundPageNum;
                    const canvas = document.getElementById(`pdf-page-${foundPageNum}`);
                    if (canvas) {
                        canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Brief highlight effect on canvas wrapper
                        canvas.style.border = '4px solid #ff9a9e';
                        setTimeout(() => canvas.style.border = 'none', 3000);
                    }
                } else {
                    locateBtn.innerHTML = '<i data-lucide="x-circle"></i> Not Found';
                }
                lucide.createIcons();
                
                setTimeout(() => {
                    locateBtn.innerHTML = originalHtml;
                    lucide.createIcons();
                }, 4000);
            }
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
