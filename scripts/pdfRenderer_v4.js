class PDFRenderer {
    constructor(containerId, thumbContainerId) {
        this.container = document.getElementById(containerId);
        this.viewerContainer = this.container.parentElement;
        this.thumbContainer = document.getElementById(thumbContainerId);
        this.sidebar = this.thumbContainer.parentElement;
        this.pageIndicator = document.getElementById('pageIndicator');
        this.pages = []; 
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
        this.historyManager = null; 
        
        this.viewerContainer.addEventListener('scroll', this.handleScroll.bind(this));
        
        this.draggedPageObj = null;
    }

    handleScroll() {
        if (this.pages.length === 0) return;
        
        let maxVisibleArea = 0;
        let mostVisibleIndex = 0;
        
        const containerRect = this.viewerContainer.getBoundingClientRect();
        
        this.pages.forEach((pageObj, index) => {
            const rect = pageObj.container.getBoundingClientRect();
            const overlapTop = Math.max(rect.top, containerRect.top);
            const overlapBottom = Math.min(rect.bottom, containerRect.bottom);
            const overlapHeight = Math.max(0, overlapBottom - overlapTop);
            
            if (overlapHeight > maxVisibleArea) {
                maxVisibleArea = overlapHeight;
                mostVisibleIndex = index;
            }
        });
        
        this.currentPageIndex = mostVisibleIndex;
        this.updateActiveThumbnail(mostVisibleIndex);
    }
    
    updateActiveThumbnail(activeIndex) {
        this.pageIndicator.style.display = 'inline';
        this.pageIndicator.innerText = `Page ${activeIndex + 1} / ${this.pages.length}`;
        
        this.pages.forEach((pageObj, index) => {
            if (index === activeIndex) {
                pageObj.thumbCanvas.classList.add('active-thumb');
                const thumbRect = pageObj.thumb.getBoundingClientRect();
                const sidebarRect = this.sidebar.getBoundingClientRect();
                if (thumbRect.top < sidebarRect.top || thumbRect.bottom > sidebarRect.bottom) {
                    this.sidebar.scrollTop += (thumbRect.top - sidebarRect.top) - (sidebarRect.height / 2) + (thumbRect.height / 2);
                }
            } else {
                pageObj.thumbCanvas.classList.remove('active-thumb');
            }
        });
    }

    async loadPDF(arrayBuffer, pdfId, pdfName) {
        this.container.innerHTML = '';
        this.thumbContainer.innerHTML = '';
        this.pages = [];
        await this.appendPDF(arrayBuffer, pdfId, pdfName);
    }

    async appendPDF(arrayBuffer, pdfId, pdfName, position = 'end') {
        try {
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;
            
            let insertIndex = -1;
            if (position === 'start') {
                insertIndex = 0;
            } else if (position === 'after') {
                insertIndex = (this.currentPageIndex !== undefined ? this.currentPageIndex + 1 : this.pages.length);
            }
            
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                await this.renderPage(pdfDoc, i, pdfId, pdfName, insertIndex);
                if (insertIndex !== -1) insertIndex++;
            }
            this.handleScroll();
        } catch (error) {
            console.error('Error loading PDF:', error);
            throw error;
        }
    }

    async renderPage(pdfDoc, pageNumber, pdfId, pdfName, insertIndex = -1) {
        const page = await pdfDoc.getPage(pageNumber);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const pageObj = this.createPageElements(viewport.width, viewport.height, false, pageNumber - 1, pdfId, pdfName);
        
        const renderContext = {
            canvasContext: pageObj.ctx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        const thumbScale = 150 / viewport.width;
        const thumbViewport = page.getViewport({ scale: thumbScale });
        pageObj.thumbCanvas.width = thumbViewport.width;
        pageObj.thumbCanvas.height = thumbViewport.height;
        await page.render({
            canvasContext: pageObj.thumbCtx,
            viewport: thumbViewport
        }).promise;

        if (insertIndex !== -1 && insertIndex < this.pages.length) {
            this.pages.splice(insertIndex, 0, pageObj);
        } else {
            this.pages.push(pageObj);
        }
        this.updateDOM();
        return pageObj;
    }

    createPageElements(width, height, isNew, originalIndex, pdfId, pdfName) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';
        pageContainer.style.width = `${width}px`;
        pageContainer.style.height = `${height}px`;

        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        const ctx = canvas.getContext('2d');
        canvas.height = height;
        canvas.width = width;

        if (isNew) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
        }

        pageContainer.appendChild(canvas);
        
        const annotationLayer = document.createElement('div');
        annotationLayer.className = 'annotation-layer';
        pageContainer.appendChild(annotationLayer);

        const thumbWrapper = document.createElement('div');
        thumbWrapper.className = 'thumbnail-wrapper';
        thumbWrapper.draggable = true;
        
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.className = 'thumbnail-canvas';
        const thumbCtx = thumbCanvas.getContext('2d');
        
        if (isNew) {
            thumbCanvas.width = 150;
            thumbCanvas.height = (height / width) * 150;
            thumbCtx.fillStyle = 'white';
            thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        }

        const controls = document.createElement('div');
        controls.className = 'thumbnail-controls';
        
        const delBtn = document.createElement('button');
        delBtn.className = 'thumb-btn';
        delBtn.innerText = 'Del';
        
        const insertBtn = document.createElement('button');
        insertBtn.className = 'insert-page-btn';
        insertBtn.innerText = '+ Insert Page';

        const editControls = document.createElement('div');
        editControls.className = 'edit-mode-controls';
        const upBtn = document.createElement('button');
        upBtn.className = 'move-btn';
        upBtn.innerHTML = '↑';
        const downBtn = document.createElement('button');
        downBtn.className = 'move-btn';
        downBtn.innerHTML = '↓';
        editControls.appendChild(upBtn);
        editControls.appendChild(downBtn);

        controls.appendChild(delBtn);
        thumbWrapper.appendChild(editControls);
        thumbWrapper.appendChild(thumbCanvas);
        thumbWrapper.appendChild(controls);
        thumbWrapper.appendChild(insertBtn);

        const pageObj = {
            container: pageContainer,
            thumb: thumbWrapper,
            thumbCanvas,
            ctx,
            thumbCtx,
            isNew,
            originalIndex,
            pdfId,
            pdfName
        };

        // Event listeners
        thumbCanvas.addEventListener('click', () => {
            pageContainer.scrollIntoView({ behavior: 'smooth' });
        });

        delBtn.addEventListener('click', () => {
            const index = this.pages.indexOf(pageObj);
            const cmd = new DeletePageCommand(this, index, pageObj);
            this.historyManager.execute(cmd);
        });

        insertBtn.addEventListener('click', () => {
            const index = this.pages.indexOf(pageObj) + 1; // insert after
            const cmd = new AddPageCommand(this, index);
            this.historyManager.execute(cmd);
        });
        
        upBtn.addEventListener('click', () => this.movePage(pageObj, -1));
        downBtn.addEventListener('click', () => this.movePage(pageObj, 1));

        // Drag and drop
        thumbWrapper.addEventListener('dragstart', (e) => {
            if (!document.body.classList.contains('edit-mode')) {
                e.preventDefault();
                return;
            }
            this.draggedPageObj = pageObj;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.pages.indexOf(pageObj));
        });

        thumbWrapper.addEventListener('dragover', (e) => {
            if (!this.draggedPageObj) return;
            e.preventDefault();
            const rect = thumbWrapper.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (e.clientY < midpoint) {
                thumbWrapper.classList.add('drag-over');
                thumbWrapper.classList.remove('drag-over-bottom');
            } else {
                thumbWrapper.classList.add('drag-over-bottom');
                thumbWrapper.classList.remove('drag-over');
            }
        });

        thumbWrapper.addEventListener('dragleave', () => {
            thumbWrapper.classList.remove('drag-over');
            thumbWrapper.classList.remove('drag-over-bottom');
        });

        thumbWrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            thumbWrapper.classList.remove('drag-over');
            thumbWrapper.classList.remove('drag-over-bottom');
            if (!this.draggedPageObj || this.draggedPageObj === pageObj) return;
            
            const fromIndex = this.pages.indexOf(this.draggedPageObj);
            let toIndex = this.pages.indexOf(pageObj);
            
            const rect = thumbWrapper.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (e.clientY >= midpoint) {
                toIndex++; 
            }
            
            if (fromIndex < toIndex) toIndex--; 
            
            if (fromIndex !== toIndex) {
                const oldPages = [...this.pages];
                const newPages = [...this.pages];
                const [moved] = newPages.splice(fromIndex, 1);
                newPages.splice(toIndex, 0, moved);
                this.historyManager.execute(new ReorderPagesCommand(this, oldPages, newPages));
            }
            this.draggedPageObj = null;
        });

        return pageObj;
    }
    
    movePage(pageObj, dir) {
        const fromIndex = this.pages.indexOf(pageObj);
        const toIndex = fromIndex + dir;
        if (toIndex < 0 || toIndex >= this.pages.length) return;
        
        const oldPages = [...this.pages];
        const newPages = [...this.pages];
        const [moved] = newPages.splice(fromIndex, 1);
        newPages.splice(toIndex, 0, moved);
        
        this.historyManager.execute(new ReorderPagesCommand(this, oldPages, newPages));
    }

    movePDF(pdfId, dir) {
        const oldPages = [...this.pages];
        const pdfPages = this.pages.filter(p => p.pdfId === pdfId);
        if (pdfPages.length === 0) return;
        
        // Find contiguous block
        const firstIndex = this.pages.indexOf(pdfPages[0]);
        const lastIndex = this.pages.indexOf(pdfPages[pdfPages.length - 1]);
        
        let newPages = [...this.pages];
        
        if (dir === -1 && firstIndex > 0) {
            // Swap with previous PDF block
            const prevPdfId = this.pages[firstIndex - 1].pdfId;
            const prevPages = this.pages.filter(p => p.pdfId === prevPdfId);
            const prevCount = prevPages.length;
            
            const blockToMove = newPages.splice(firstIndex, pdfPages.length);
            newPages.splice(firstIndex - prevCount, 0, ...blockToMove);
            this.historyManager.execute(new ReorderPagesCommand(this, oldPages, newPages));
        } else if (dir === 1 && lastIndex < this.pages.length - 1) {
            // Swap with next PDF block
            const nextPdfId = this.pages[lastIndex + 1].pdfId;
            const nextPages = this.pages.filter(p => p.pdfId === nextPdfId);
            const nextCount = nextPages.length;
            
            const blockToMove = newPages.splice(firstIndex, pdfPages.length);
            newPages.splice(firstIndex + nextCount, 0, ...blockToMove);
            this.historyManager.execute(new ReorderPagesCommand(this, oldPages, newPages));
        }
    }

    addBlankPage(index) {
        const scale = 1.5;
        const width = 595.28 * scale;
        const height = 841.89 * scale;
        
        // Use pdfId of previous page, or a generic one
        let pdfId = 'new';
        let pdfName = 'Blank Page';
        if (index > 0 && this.pages[index - 1]) {
            pdfId = this.pages[index - 1].pdfId;
            pdfName = this.pages[index - 1].pdfName;
        }

        const pageObj = this.createPageElements(width, height, true, -1, pdfId, pdfName);
        
        if (index >= this.pages.length) {
            this.pages.push(pageObj);
        } else {
            this.pages.splice(index, 0, pageObj);
        }
        
        this.updateDOM();
        pageObj.container.scrollIntoView({ behavior: 'smooth' });
        return pageObj;
    }

    insertExistingPage(index, pageObj) {
        if (index >= this.pages.length) {
            this.pages.push(pageObj);
        } else {
            this.pages.splice(index, 0, pageObj);
        }
        this.updateDOM();
    }

    deletePage(index, useCommand = true) {
        const pageObj = this.pages[index];
        if (useCommand) {
            const cmd = new DeletePageCommand(this, index, pageObj);
            this.historyManager.execute(cmd);
            return;
        }
        
        this.pages.splice(index, 1);
        this.updateDOM();
    }

    updateDOM() {
        this.container.innerHTML = '';
        this.thumbContainer.innerHTML = '';
        
        const topInsert = document.createElement('button');
        topInsert.className = 'insert-page-btn';
        topInsert.innerText = '+ Insert Page at Top';
        topInsert.addEventListener('click', () => {
            const cmd = new AddPageCommand(this, 0);
            this.historyManager.execute(cmd);
        });
        this.thumbContainer.appendChild(topInsert);

        let currentPdfId = null;

        this.pages.forEach((pageObj, index) => {
            pageObj.container.dataset.pageIndex = index;
            this.container.appendChild(pageObj.container);
            
            // Add PDF Header if needed
            if (pageObj.pdfId !== currentPdfId) {
                currentPdfId = pageObj.pdfId;
                const header = document.createElement('div');
                header.className = 'pdf-group-header';
                
                const titleSpan = document.createElement('span');
                titleSpan.innerText = pageObj.pdfName || 'Document';
                
                const headerControls = document.createElement('div');
                headerControls.className = 'edit-mode-controls';
                headerControls.style.width = 'auto';
                
                const upBtn = document.createElement('button');
                upBtn.className = 'move-btn';
                upBtn.innerHTML = '↑';
                upBtn.title = 'Move PDF Up';
                upBtn.addEventListener('click', () => this.movePDF(currentPdfId, -1));
                
                const downBtn = document.createElement('button');
                downBtn.className = 'move-btn';
                downBtn.innerHTML = '↓';
                downBtn.title = 'Move PDF Down';
                downBtn.addEventListener('click', () => this.movePDF(currentPdfId, 1));
                
                headerControls.appendChild(upBtn);
                headerControls.appendChild(downBtn);
                
                header.appendChild(titleSpan);
                header.appendChild(headerControls);
                this.thumbContainer.appendChild(header);
            }

            this.thumbContainer.appendChild(pageObj.thumb);
        });
        
        this.handleScroll();
    }
}
