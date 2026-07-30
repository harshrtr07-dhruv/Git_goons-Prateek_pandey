document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // File upload and processing logic
    const fileInput = document.getElementById('pdfUpload');
    const pdfPane = document.getElementById('pdfPane');
    const overviewTab = document.getElementById('overview');
    const studyTab = document.getElementById('study');
    const claimsTab = document.getElementById('claims');
    const limitationsTab = document.getElementById('limitations');
    const conceptMapTab = document.getElementById('concept-map');
    const pdfViewerContainer = document.getElementById('pdfViewerContainer');
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            // UI Reset
            const placeholder = pdfPane.querySelector('.placeholder-state');
            if (placeholder) placeholder.style.display = 'none';
            pdfViewerContainer.classList.remove('hidden');
            pdfViewerContainer.innerHTML = '';
            
            // Enhanced Loading UI
            overviewTab.innerHTML = `
                <div class="loading-container">
                    <div class="spinner-ring"></div>
                    <h3 style="font-weight: 600;">Analyzing ${file.name}</h3>
                    <ul class="loading-steps">
                        <li id="step1" class="active"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10.1 10.1 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Uploading PDF to Node.js...</li>
                        <li id="step2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10.1 10.1 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Extracting text with PyMuPDF...</li>
                        <li id="step3"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10.1 10.1 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Running Support Vector Machines...</li>
                    </ul>
                </div>
            `;

            // Simulate progress steps
            setTimeout(() => {
                const s1 = document.getElementById('step1');
                const s2 = document.getElementById('step2');
                if(s1 && s2) { s1.classList.replace('active', 'done'); s2.classList.add('active'); }
            }, 800);
            
            setTimeout(() => {
                const s2 = document.getElementById('step2');
                const s3 = document.getElementById('step3');
                if(s2 && s3) { s2.classList.replace('active', 'done'); s3.classList.add('active'); }
            }, 2500);

            // Render PDF visually
            renderPDF(file);

            // Prepare form data for backend
            const formData = new FormData();
            formData.append('pdf', file);

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();

                if (response.ok && result.analysis) {
                    renderDashboard(result.analysis);
                } else {
                    throw new Error(result.details || result.error || 'Failed to analyze PDF');
                }
            } catch (error) {
                console.error('Upload error:', error);
                overviewTab.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <div class="error-title">Analysis Failed</div>
                        <p style="color: var(--text-primary); margin-bottom: 0.5rem;">We couldn't process the PDF. Is the Python ML microservice running?</p>
                        <div class="error-details">${error.message}</div>
                    </div>
                `;
            }
        }
    });

    // 1. PDF Rendering Logic
    async function renderPDF(file) {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
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
                pdfViewerContainer.innerHTML = `<p style="color:red">Failed to render PDF preview.</p>`;
            }
        };
        fileReader.readAsArrayBuffer(file);
    }

    // 2. Dashboard UI Rendering
    function renderDashboard(analysis) {
        // OVERVIEW TAB (TL;DR)
        const tldrHtml = analysis.tldr.map(point => `<li>${point}</li>`).join('');
        overviewTab.innerHTML = `
            <h2 style="margin-bottom: 1rem; font-weight: 600;">Paper TL;DR</h2>
            <ul class="tldr-list">
                ${tldrHtml}
            </ul>
        `;

        // CLAIMS TAB
        const claimsRows = analysis.claims.map(c => `
            <tr>
                <td style="width: 40%; vertical-align: top;"><strong>${c.claim}</strong></td>
                <td style="width: 60%;">
                    <div class="evidence-quote" onclick="highlightEvidence(this)">
                        "${c.evidence_quote}"
                    </div>
                </td>
            </tr>
        `).join('');
        claimsTab.innerHTML = `
            <h2 style="margin-bottom: 1rem; font-weight: 600;">Claims & Evidence</h2>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">Click a quote to highlight the source sentence.</p>
            <table class="claims-table">
                <thead><tr><th>The Claim</th><th>Source Text (Grounded)</th></tr></thead>
                <tbody>${claimsRows}</tbody>
            </table>
        `;

        // LIMITATIONS TAB
        const limsHtml = analysis.limitations.map(l => `<li>${l}</li>`).join('');
        limitationsTab.innerHTML = `
            <h2 style="margin-bottom: 1rem; font-weight: 600;">Limitations & Constraints</h2>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">ML-extracted sentences where the authors acknowledge limitations, caveats, or future work.</p>
            <ul class="limitations-list">
                ${limsHtml}
            </ul>
        `;

        // STUDY TAB (Flashcards)
        const flashcardsHtml = analysis.flashcards.map(card => `
            <div class="flashcard" onclick="this.classList.toggle('flipped')">
                <div class="flashcard-inner">
                    <div class="flashcard-front">${card.question}</div>
                    <div class="flashcard-back">${card.answer}</div>
                </div>
            </div>
        `).join('');
        studyTab.innerHTML = `
            <h2 style="margin-bottom: 1rem; font-weight: 600;">Study Mode</h2>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Click a card to reveal the answer.</p>
            <div class="flashcards-grid">
                ${flashcardsHtml}
            </div>
        `;

        // CONCEPT MAP TAB (D3.js Force-Directed Graph)
        renderConceptMap(analysis.concept_map);
    }

    function renderConceptMap(data) {
        if (!data || !data.nodes || data.nodes.length === 0) {
            conceptMapTab.innerHTML = '<div class="empty-state">Could not extract enough concepts to build a map.</div>';
            return;
        }

        conceptMapTab.innerHTML = `
            <h2 style="margin-bottom:0.5rem;font-weight:600;">Concept Map</h2>
            <p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:1rem;">Key concepts from the paper. <strong style="color:var(--accent);">Click a node</strong> to see its context from the paper.</p>
            <div id="d3-graph"></div>
            <div id="concept-tooltip" class="concept-tooltip hidden">
                <div class="concept-tooltip-title" id="tooltip-title"></div>
                <div class="concept-tooltip-body" id="tooltip-body"></div>
            </div>
        `;

        // Use a fixed width to avoid the hidden-tab 0px bug
        const W = 800;
        const H = 460;

        const svg = d3.select('#d3-graph')
            .append('svg')
            .attr('viewBox', `0 0 ${W} ${H}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('height', `${H}px`)
            .style('border-radius', '0.75rem')
            .style('background', 'rgba(0,0,0,0.25)');

        // Arrow marker for directed edges
        svg.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 38).attr('refY', 0)
            .attr('markerWidth', 6).attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', 'rgba(59,130,246,0.5)');

        const simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.links).id(d => d.id).distance(140))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('center', d3.forceCenter(W / 2, H / 2))
            .force('collide', d3.forceCollide(50));

        const link = svg.append('g')
            .selectAll('line').data(data.links).join('line')
            .attr('stroke', 'rgba(59,130,246,0.25)')
            .attr('stroke-width', 1.5)
            .attr('marker-end', 'url(#arrow)');

        const color = d3.scaleOrdinal(d3.schemeTableau10);

        const node = svg.append('g')
            .selectAll('g').data(data.nodes).join('g')
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag',  (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end',   (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
            )
            .on('click', (event, d) => {
                // Show description tooltip below graph
                const tooltip  = document.getElementById('concept-tooltip');
                const titleEl  = document.getElementById('tooltip-title');
                const bodyEl   = document.getElementById('tooltip-body');
                titleEl.textContent = d.label;
                bodyEl.textContent  = d.description;
                tooltip.classList.remove('hidden');
                // Highlight clicked node
                node.select('circle').attr('stroke', n => n.id === d.id ? '#facc15' : '#3b82f6')
                                     .attr('stroke-width', n => n.id === d.id ? 3 : 1.5);
            });

        node.append('circle')
            .attr('r', 32)
            .attr('fill', (d, i) => d3.color(color(i)).copy({opacity: 0.25}))
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 1.5);

        node.append('text')
            .text(d => d.label.length > 10 ? d.label.substring(0, 10) + '…' : d.label)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#f8fafc')
            .attr('font-size', '11px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, sans-serif')
            .style('pointer-events', 'none');

        simulation.on('tick', () => {
            // Keep nodes inside the SVG bounds
            data.nodes.forEach(d => {
                d.x = Math.max(36, Math.min(W - 36, d.x));
                d.y = Math.max(36, Math.min(H - 36, d.y));
            });
            link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }
});

// Grounding Feature Logic
window.highlightEvidence = function(element) {
    const quoteText = element.innerText.replace(/"/g, '').trim();
    const original = element.innerHTML;

    element.style.background = 'rgba(250, 204, 21, 0.35)';
    element.style.borderLeft = '3px solid #facc15';
    element.innerHTML = `<span style="color:#facc15; font-weight:600;">📍 Source text located in paper</span><br><em style="color:var(--text-primary); font-size:0.85rem;">${quoteText}</em>`;
    
    setTimeout(() => {
        element.style.background = 'rgba(59, 130, 246, 0.15)';
        element.style.borderLeft = '';
        element.innerHTML = `"${quoteText}"`;
    }, 3000);
};
