document.addEventListener('DOMContentLoaded', () => {
    window.historyManager = new HistoryManager();
    window.loadedPdfs = []; // { id, name, bytes }
    
    const renderer = new PDFRenderer('pdfContainer', 'thumbnailsContainer');
    renderer.historyManager = window.historyManager;
    
    const annManager = new AnnotationManager();
    annManager.historyManager = window.historyManager;
    
    const exporter = new PDFExporter();

    // Helper for safe event listeners
    const addListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    addListener('darkModeBtn', 'click', () => {
        document.body.classList.toggle('dark-mode');
        const btn = document.getElementById('darkModeBtn');
        if (btn) btn.classList.toggle('active', document.body.classList.contains('dark-mode'));
    });

    function enableToolbar() {
        ['addTextBtn', 'addImageBtn', 'fixInvertMenuBtn', 'saveBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = false;
        });
    }

    addListener('fileInput', 'change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const arrayBuffer = await file.arrayBuffer();
        const pdfId = 'pdf_' + Date.now();
        window.loadedPdfs = [{ id: pdfId, name: file.name, bytes: arrayBuffer.slice(0) }];
        
        await renderer.loadPDF(arrayBuffer, pdfId, file.name);
        
        enableToolbar();
        window.historyManager.undoStack = [];
        window.historyManager.redoStack = [];
        window.historyManager.updateButtons();
        
        const openPdfLabel = document.getElementById('openPdfLabel');
        const editPdfBtn = document.getElementById('editPdfBtn');
        const addPdfLabel = document.getElementById('addPdfLabel');
        
        if (openPdfLabel) openPdfLabel.style.display = 'none';
        if (editPdfBtn) editPdfBtn.style.display = 'inline-block';
        if (addPdfLabel) addPdfLabel.style.display = 'inline-block';
    });

    let pendingPdfFile = null;

    addListener('addPdfInput', 'change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        pendingPdfFile = file;
        
        const dialog = document.getElementById('addPdfDialog');
        if (dialog) dialog.showModal();
        
        const addPdfInput = document.getElementById('addPdfInput');
        if (addPdfInput) addPdfInput.value = '';
    });

    const processAddPdf = async (position) => {
        if (!pendingPdfFile) return;
        const file = pendingPdfFile;
        pendingPdfFile = null;
        
        const dialog = document.getElementById('addPdfDialog');
        if (dialog) dialog.close();

        const arrayBuffer = await file.arrayBuffer();
        const pdfId = 'pdf_' + Date.now();
        window.loadedPdfs.push({ id: pdfId, name: file.name, bytes: arrayBuffer.slice(0) });
        
        await renderer.appendPDF(arrayBuffer, pdfId, file.name, position);
    };

    addListener('insertStartBtn', 'click', () => processAddPdf('start'));
    addListener('insertEndBtn', 'click', () => processAddPdf('end'));
    addListener('insertAfterBtn', 'click', () => processAddPdf('after'));
    addListener('insertCancelBtn', 'click', () => {
        pendingPdfFile = null;
        const dialog = document.getElementById('addPdfDialog');
        if (dialog) dialog.close();
    });

    addListener('editPdfBtn', 'click', () => {
        document.body.classList.toggle('edit-mode');
        const btn = document.getElementById('editPdfBtn');
        if (btn) {
            if (document.body.classList.contains('edit-mode')) {
                btn.innerText = 'Done Editing';
                btn.classList.add('active');
                annManager.setActive(null);
                annManager.setMode(null);
            } else {
                btn.innerText = 'Edit PDF';
                btn.classList.remove('active');
            }
        }
    });

    addListener('undoBtn', 'click', () => {
        window.historyManager.undo();
    });

    addListener('redoBtn', 'click', () => {
        window.historyManager.redo();
    });

    addListener('addTextBtn', 'click', () => {
        annManager.setMode('text');
        const textBtn = document.getElementById('addTextBtn');
        const imgBtn = document.getElementById('addImageBtn');
        const fixMenuBtn = document.getElementById('fixInvertMenuBtn');
        
        if (textBtn) textBtn.classList.add('active');
        if (imgBtn) imgBtn.classList.remove('active');
        if (fixMenuBtn) fixMenuBtn.classList.remove('active');
    });

    addListener('addImageBtn', 'click', () => {
        const imageInput = document.getElementById('imageInput');
        if (imageInput) imageInput.click();
    });
    
    addListener('fixInvertBtn', 'click', (e) => {
        annManager.setMode('dont-invert');
        const textBtn = document.getElementById('addTextBtn');
        const imgBtn = document.getElementById('addImageBtn');
        const fixMenuBtn = document.getElementById('fixInvertMenuBtn');
        
        if (fixMenuBtn) fixMenuBtn.classList.add('active');
        if (textBtn) textBtn.classList.remove('active');
        if (imgBtn) imgBtn.classList.remove('active');
        
        document.getElementById('fixInvertDropdown').classList.remove('show');
    });

    addListener('editInvertBtn', 'click', (e) => {
        annManager.setMode(null);
        const textBtn = document.getElementById('addTextBtn');
        const imgBtn = document.getElementById('addImageBtn');
        const fixMenuBtn = document.getElementById('fixInvertMenuBtn');
        
        if (fixMenuBtn) fixMenuBtn.classList.remove('active');
        if (textBtn) textBtn.classList.remove('active');
        if (imgBtn) imgBtn.classList.remove('active');
        
        document.getElementById('fixInvertDropdown').classList.remove('show');
    });

    addListener('fixInvertMenuBtn', 'click', (e) => {
        document.getElementById('fixInvertDropdown').classList.toggle('show');
        e.stopPropagation();
    });

    window.addEventListener('click', (e) => {
        if (!e.target.matches('#fixInvertMenuBtn')) {
            const dropdown = document.getElementById('fixInvertDropdown');
            if (dropdown && dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    });

    addListener('imageInput', 'change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const imgData = event.target.result;
            const img = new Image();
            img.onload = () => {
                annManager.setMode('image', { src: imgData, width: img.width, height: img.height });
                const textBtn = document.getElementById('addTextBtn');
                const imgBtn = document.getElementById('addImageBtn');
                const fixMenuBtn = document.getElementById('fixInvertMenuBtn');
                
                if (imgBtn) imgBtn.classList.add('active');
                if (textBtn) textBtn.classList.remove('active');
                if (fixMenuBtn) fixMenuBtn.classList.remove('active');
            };
            img.src = imgData;
        };
        reader.readAsDataURL(file);
        
        const imageInput = document.getElementById('imageInput');
        if (imageInput) imageInput.value = '';
    });
    
    addListener('viewerContainer', 'pointerdown', () => {
        setTimeout(() => {
            if (!annManager.currentMode) {
                const textBtn = document.getElementById('addTextBtn');
                const imgBtn = document.getElementById('addImageBtn');
                const fixMenuBtn = document.getElementById('fixInvertMenuBtn');
                
                if (textBtn) textBtn.classList.remove('active');
                if (imgBtn) imgBtn.classList.remove('active');
                if (fixMenuBtn) fixMenuBtn.classList.remove('active');
            }
        }, 50);
    });

    addListener('saveBtn', 'click', async () => {
        const btn = document.getElementById('saveBtn');
        if (btn) {
            btn.innerText = 'Saving...';
            btn.disabled = true;
        }
        try {
            const annotations = annManager.getAnnotations();
            await exporter.export(annotations, renderer.pages, window.loadedPdfs);
        } catch(e) {
            console.error(e);
            alert("Error saving PDF.");
        }
        if (btn) {
            btn.innerText = 'Save PDF';
            btn.disabled = false;
        }
    });
});
