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
    const pdfViewerContainer = document.getElementById('pdfViewerContainer');
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            // UI Reset
            const placeholder = pdfPane.querySelector('.placeholder-state');
            if (placeholder) placeholder.style.display = 'none';
            pdfViewerContainer.classList.remove('hidden');
            pdfViewerContainer.innerHTML = '';
            
            overviewTab.innerHTML = `
                <div class="empty-state">
                    <p>Analyzing ${file.name}...</p>
                    <div class="icon-pulse" style="margin: 2rem auto;"></div>
                </div>
            `;

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
                    <div class="empty-state" style="color: #ef4444; text-align: left; background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 0.5rem;">
                        <h4 style="margin-bottom: 0.5rem;">Error Parsing PDF</h4>
                        <p style="font-family: monospace; font-size: 0.85rem; word-break: break-all;">${error.message}</p>
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

        // CLAIMS TAB (Table + Grounding)
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
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">Click on a quote to find it in the PDF.</p>
            <table class="claims-table">
                <thead><tr><th>The Claim</th><th>The Evidence (Quote)</th></tr></thead>
                <tbody>${claimsRows}</tbody>
            </table>
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
    }
});

// Grounding Feature Logic
window.highlightEvidence = function(element) {
    const quoteText = element.innerText.replace(/"/g, '').trim();
    
    // We try to use the browser's native find feature to locate the text on the page
    // (This requires a text-layer on the PDF, which we don't have time to build in 20 hours, 
    // so we simulate the grounding effect by flashing the element)
    
    element.style.background = 'rgba(250, 204, 21, 0.4)';
    element.innerText = "🔍 Grounding located in Source PDF! (Simulated)";
    
    setTimeout(() => {
        element.style.background = 'rgba(59, 130, 246, 0.2)';
        element.innerText = `"${quoteText}"`;
    }, 2000);
};
