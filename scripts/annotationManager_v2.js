class AnnotationManager {
    constructor() {
        this.annotations = [];
        this.currentMode = null; 
        this.pendingImageData = null; 
        this.activeElement = null;
        this.cropperInstance = null;
        
        this.historyManager = null; 
        this.formattingToolbar = document.getElementById('formattingToolbar');
        this.boldBtn = document.getElementById('boldBtn');
        this.italicBtn = document.getElementById('italicBtn');
        this.colorBtn = document.getElementById('textColorBtn');
        this.fontSizeBtn = document.getElementById('fontSizeBtn');
        this.fontFamilyBtn = document.getElementById('fontFamilyBtn');
        this.fontNote = document.getElementById('fontNote');
        this.borderBtn = document.getElementById('borderBtn');
        this.cropBtn = document.getElementById('cropBtn');
        this.applyCropBtn = document.getElementById('applyCropBtn');
        this.cancelCropBtn = document.getElementById('cancelCropBtn');

        this.setupGlobalListeners();
        this.setupFormattingListeners();
    }
    
    setupGlobalListeners() {
        document.addEventListener('pointerdown', (e) => {
            // Don't deselect if clicking inside cropper
            if (this.cropperInstance && e.target.closest('.cropper-container')) return;
            
            if (!e.target.closest('.text-box') && !e.target.closest('.image-box') && !e.target.closest('#toolbar')) {
                if (this.cropperInstance) this.cancelCrop();
                this.setActive(null);
            }
        });

        document.getElementById('viewerContainer').addEventListener('pointerdown', (e) => {
            if (this.currentMode === 'text' || this.currentMode === 'image' || this.currentMode === 'dont-invert') {
                const pageContainer = e.target.closest('.page-container');
                if (pageContainer && !e.target.closest('.text-box') && !e.target.closest('.image-box') && !e.target.closest('.dont-invert-box')) {
                    const rect = pageContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    if (this.currentMode === 'text') {
                        this.addTextBox(pageContainer, x, y);
                    } else if (this.currentMode === 'image' && this.pendingImageData) {
                        this.addImage(pageContainer, x, y, this.pendingImageData.src, this.pendingImageData.width, this.pendingImageData.height);
                    } else if (this.currentMode === 'dont-invert') {
                        this.createDontInvertBox(pageContainer, x, y);
                    }
                    
                    this.setMode(null); 
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.cropperInstance) return; // disable delete/undo while cropping
            
            if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName !== 'DIV' && e.target.tagName !== 'INPUT') {
                if (this.activeElement) {
                    const ann = this.getAnnotationByElement(this.activeElement);
                    if (ann) {
                        const cmd = new DeleteAnnotationCommand(this, ann);
                        this.historyManager.execute(cmd);
                        this.setActive(null);
                    }
                }
            }
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                if(this.historyManager) this.historyManager.undo();
            }
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                if(this.historyManager) this.historyManager.redo();
            }
        });
    }

    setupFormattingListeners() {
        const addListener = (btn, event, handler) => {
            if (btn) btn.addEventListener(event, handler);
        };

        addListener(this.boldBtn, 'click', () => {
            if (!this.activeElement) return;
            const ann = this.getAnnotationByElement(this.activeElement);
            if (ann && ann.type === 'text') {
                const oldStyle = this.getStyle(ann);
                const newStyle = { ...oldStyle, bold: !oldStyle.bold };
                this.historyManager.execute(new StyleCommand(ann, oldStyle, newStyle));
                this.updateFormattingToolbar(ann);
            }
        });
        
        addListener(this.italicBtn, 'click', () => {
            if (!this.activeElement) return;
            const ann = this.getAnnotationByElement(this.activeElement);
            if (ann && ann.type === 'text') {
                const oldStyle = this.getStyle(ann);
                const newStyle = { ...oldStyle, italic: !oldStyle.italic };
                this.historyManager.execute(new StyleCommand(ann, oldStyle, newStyle));
                this.updateFormattingToolbar(ann);
            }
        });

        addListener(this.colorBtn, 'input', (e) => {
            if (!this.activeElement) return;
            const ann = this.getAnnotationByElement(this.activeElement);
            if (ann && ann.type === 'text') {
                const oldStyle = this.getStyle(ann);
                const newStyle = { ...oldStyle, color: e.target.value };
                this.historyManager.execute(new StyleCommand(ann, oldStyle, newStyle));
            }
        });

        addListener(this.fontSizeBtn, 'input', (e) => {
            if (!this.activeElement) return;
            const ann = this.getAnnotationByElement(this.activeElement);
            if (ann && ann.type === 'text') {
                const oldStyle = this.getStyle(ann);
                const newStyle = { ...oldStyle, fontSize: parseInt(e.target.value) || 16 };
                this.historyManager.execute(new StyleCommand(ann, oldStyle, newStyle));
            }
        });

        addListener(this.fontFamilyBtn, 'change', (e) => {
            if (!this.activeElement) return;
            const ann = this.getAnnotationByElement(this.activeElement);
            if (ann && ann.type === 'text') {
                const oldStyle = this.getStyle(ann);
                const newStyle = { ...oldStyle, fontFamily: e.target.value };
                this.historyManager.execute(new StyleCommand(ann, oldStyle, newStyle));
            }
        });

        addListener(this.borderBtn, 'click', () => {
            if (!this.activeElement) return;
            const ann = this.getAnnotationByElement(this.activeElement);
            if (ann && ann.type === 'image') {
                const oldStyle = this.getStyle(ann);
                const newStyle = { ...oldStyle, border: !oldStyle.border };
                this.historyManager.execute(new StyleCommand(ann, oldStyle, newStyle));
                this.updateFormattingToolbar(ann);
            }
        });

        addListener(this.cropBtn, 'click', () => this.startCrop());
        addListener(this.applyCropBtn, 'click', () => this.applyCrop());
        addListener(this.cancelCropBtn, 'click', () => this.cancelCrop());
    }

    startCrop() {
        if (!this.activeElement || this.cropperInstance) return;
        const ann = this.getAnnotationByElement(this.activeElement);
        if (!ann || ann.type !== 'image') return;
        
        const img = this.activeElement.querySelector('img');
        
        this.cropperInstance = new Cropper(img, {
            viewMode: 1,
            dragMode: 'crop',
            autoCropArea: 1,
            background: false,
            modal: true,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });

        this.activeElement.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'none');
        
        this.cropBtn.style.display = 'none';
        this.borderBtn.style.display = 'none';
        this.applyCropBtn.style.display = 'block';
        this.cancelCropBtn.style.display = 'block';
    }

    applyCrop() {
        if (!this.cropperInstance || !this.activeElement) return;
        const ann = this.getAnnotationByElement(this.activeElement);
        
        const oldImgData = ann.imgData;
        const oldRect = {
            left: parseFloat(this.activeElement.style.left),
            top: parseFloat(this.activeElement.style.top),
            width: this.activeElement.offsetWidth,
            height: this.activeElement.offsetHeight
        };

        const canvas = this.cropperInstance.getCroppedCanvas();
        if (!canvas) {
            this.cancelCrop();
            return;
        }

        const newImgData = canvas.toDataURL('image/png');
        const newAspect = canvas.width / canvas.height;
        
        this.cropperInstance.destroy();
        this.cropperInstance = null;

        const newRect = { ...oldRect };
        newRect.height = newRect.width / newAspect;

        const cmd = new CropCommand(this, ann, oldImgData, newImgData, oldRect, newRect);
        this.historyManager.execute(cmd);
        
        this.cleanupCropUI();
    }

    cancelCrop() {
        if (this.cropperInstance) {
            this.cropperInstance.destroy();
            this.cropperInstance = null;
        }
        this.cleanupCropUI();
    }

    cleanupCropUI() {
        if (this.activeElement) {
            this.activeElement.querySelectorAll('.resize-handle').forEach(h => h.style.display = '');
            this.updateFormattingToolbar(this.getAnnotationByElement(this.activeElement));
        }
    }

    getStyle(ann) {
        if (ann.type === 'text') {
            const content = ann.element.querySelector('.text-box-content');
            let color = content.style.color;
            if (content.classList.contains('auto-color')) {
                color = 'auto';
            } else if (!color) {
                color = '#000000';
            }
            return {
                bold: content.classList.contains('bold'),
                italic: content.classList.contains('italic'),
                color: color,
                fontSize: parseInt(content.style.fontSize) || 16,
                fontFamily: content.style.fontFamily || 'Helvetica',
                border: false
            };
        } else if (ann.type === 'dont-invert') {
            return { border: false };
        } else {
            return {
                bold: false, italic: false, color: '#000000',
                border: ann.element.classList.contains('has-border')
            };
        }
    }

    setMode(mode, imageData = null) {
        this.currentMode = mode;
        this.pendingImageData = imageData;
        const container = document.getElementById('viewerContainer');
        if (mode === 'text' || mode === 'image' || mode === 'dont-invert') {
            container.style.cursor = 'crosshair';
            document.querySelectorAll('.annotation-layer').forEach(layer => layer.style.pointerEvents = 'auto');
        } else {
            container.style.cursor = 'default';
            document.querySelectorAll('.annotation-layer').forEach(layer => layer.style.pointerEvents = 'none');
        }
    }

    setActive(element) {
        if (this.cropperInstance && this.activeElement !== element) {
            this.cancelCrop();
        }

        if (this.activeElement && this.activeElement !== element) {
            this.activeElement.classList.remove('active');
            const oldAnn = this.getAnnotationByElement(this.activeElement);
            if (oldAnn && oldAnn.type === 'text') {
                const content = this.activeElement.querySelector('.text-box-content');
                if (oldAnn.lastSavedText !== content.innerText) {
                    this.historyManager.execute(new TextEditCommand(oldAnn, oldAnn.lastSavedText, content.innerText));
                    oldAnn.lastSavedText = content.innerText;
                }
            }
        }
        
        this.activeElement = element;
        
        if (element) {
            element.classList.add('active');
            const ann = this.getAnnotationByElement(element);
            this.updateFormattingToolbar(ann);
            
            if (ann && ann.type === 'text') {
                ann.lastSavedText = element.querySelector('.text-box-content').innerText;
            }
        } else {
            this.updateFormattingToolbar(null);
        }
    }

    updateFormattingToolbar(ann) {
        if (!ann) {
            this.formattingToolbar.style.display = 'none';
            return;
        }

        this.formattingToolbar.style.display = 'flex';
        const style = this.getStyle(ann);

        if (ann.type === 'dont-invert') {
            this.boldBtn.style.display = 'none';
            this.italicBtn.style.display = 'none';
            this.colorBtn.style.display = 'none';
            this.fontSizeBtn.style.display = 'none';
            this.fontFamilyBtn.style.display = 'none';
            this.fontNote.style.display = 'none';
            this.borderBtn.style.display = 'none';
            this.cropBtn.style.display = 'none';
            this.applyCropBtn.style.display = 'none';
            this.cancelCropBtn.style.display = 'none';
        } else if (ann.type === 'text') {
            this.boldBtn.style.display = 'block';
            this.italicBtn.style.display = 'block';
            this.colorBtn.style.display = 'block';
            this.fontSizeBtn.style.display = 'block';
            this.fontFamilyBtn.style.display = 'block';
            this.fontNote.style.display = 'block';
            this.borderBtn.style.display = 'none';
            this.cropBtn.style.display = 'none';
            this.applyCropBtn.style.display = 'none';
            this.cancelCropBtn.style.display = 'none';
            
            this.boldBtn.classList.toggle('active', style.bold);
            this.italicBtn.classList.toggle('active', style.italic);
            
            if (style.color === 'auto') {
                this.colorBtn.value = document.body.classList.contains('dark-mode') ? '#ffffff' : '#000000';
            } else {
                this.colorBtn.value = this.rgbToHex(style.color);
            }
            
            this.fontSizeBtn.value = style.fontSize;
            this.fontFamilyBtn.value = style.fontFamily.replace(/['"]/g, '');
        } else {
            this.boldBtn.style.display = 'none';
            this.italicBtn.style.display = 'none';
            this.colorBtn.style.display = 'none';
            this.fontSizeBtn.style.display = 'none';
            this.fontFamilyBtn.style.display = 'none';
            this.fontNote.style.display = 'none';
            this.borderBtn.style.display = 'block';
            this.cropBtn.style.display = 'block';
            this.applyCropBtn.style.display = 'none';
            this.cancelCropBtn.style.display = 'none';
            
            this.borderBtn.classList.toggle('active', style.border);
        }
    }

    rgbToHex(rgb) {
        if (rgb.startsWith('#')) return rgb;
        const m = rgb.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (m) {
            return "#" +
                ("0" + parseInt(m[1],10).toString(16)).slice(-2) +
                ("0" + parseInt(m[2],10).toString(16)).slice(-2) +
                ("0" + parseInt(m[3],10).toString(16)).slice(-2);
        }
        return "#000000";
    }

    getAnnotationByElement(el) {
        return this.annotations.find(a => a.element === el);
    }

    addTextBox(pageContainer, x, y) {
        const layer = pageContainer.querySelector('.annotation-layer');
        const box = document.createElement('div');
        box.className = 'text-box';
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        box.style.width = `150px`;
        box.style.height = `40px`;
        
        const content = document.createElement('div');
        content.className = 'text-box-content auto-color';
        content.contentEditable = true;
        
        box.appendChild(content);
        this.addResizeHandles(box);
        
        const ann = {
            type: 'text',
            element: box,
            pageContainer: pageContainer,
            lastSavedText: ''
        };
        
        const cmd = new AddAnnotationCommand(this, ann);
        this.historyManager.execute(cmd);
        
        this.setupInteractions(box);
        this.setActive(box);
        content.focus();
    }

    addImage(pageContainer, x, y, src, imgWidth, imgHeight) {
        const layer = pageContainer.querySelector('.annotation-layer');
        const box = document.createElement('div');
        box.className = 'image-box';
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        
        const maxWidth = pageContainer.offsetWidth * 0.8;
        let finalWidth = imgWidth;
        let finalHeight = imgHeight;
        if (finalWidth > maxWidth) {
            const ratio = maxWidth / finalWidth;
            finalWidth = maxWidth;
            finalHeight = finalHeight * ratio;
        }
        
        box.style.width = `${finalWidth}px`;
        box.style.height = `${finalHeight}px`;
        
        const img = document.createElement('img');
        img.src = src;
        
        box.appendChild(img);
        this.addResizeHandles(box);
        
        const ann = {
            type: 'image',
            element: box,
            pageContainer: pageContainer,
            imgData: src
        };
        
        const cmd = new AddAnnotationCommand(this, ann);
        this.historyManager.execute(cmd);
        
        this.setupInteractions(box);
        this.setActive(box);
    }

    createDontInvertBox(pageContainer, x, y) {
        const layer = pageContainer.querySelector('.annotation-layer');
        const box = document.createElement('div');
        box.className = 'dont-invert-box';
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        box.style.width = `100px`;
        box.style.height = `100px`;
        
        layer.appendChild(box);
        this.addResizeHandles(box);
        
        const ann = {
            type: 'dont-invert',
            element: box,
            pageContainer: pageContainer
        };
        
        const cmd = new AddAnnotationCommand(this, ann);
        this.historyManager.execute(cmd);
        
        this.setupInteractions(box);
        this.setActive(box);
    }

    addResizeHandles(box) {
        const positions = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle handle-${pos}`;
            handle.dataset.pos = pos;
            box.appendChild(handle);
        });
    }

    setupInteractions(box) {
        let isDragging = false;
        let isResizing = false;
        let resizePos = null;
        let startX, startY, startRect;
        
        box.addEventListener('pointerdown', (e) => {
            if (this.cropperInstance) return;

            if (e.target.classList.contains('text-box-content')) {
                this.setActive(box);
                return;
            }
            
            e.stopPropagation();
            this.setActive(box);
            box.setPointerCapture(e.pointerId);
            
            const rect = {
                left: parseFloat(box.style.left) || 0,
                top: parseFloat(box.style.top) || 0,
                width: box.offsetWidth,
                height: box.offsetHeight
            };
            
            startX = e.clientX;
            startY = e.clientY;
            startRect = { ...rect };

            if (e.target.classList.contains('resize-handle')) {
                isResizing = true;
                resizePos = e.target.dataset.pos;
            } else {
                isDragging = true;
            }
        });

        box.addEventListener('pointermove', (e) => {
            if (!isDragging && !isResizing) return;
            if (this.cropperInstance) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (isDragging) {
                box.style.left = `${startRect.left + dx}px`;
                box.style.top = `${startRect.top + dy}px`;
            } else if (isResizing) {
                let newLeft = startRect.left;
                let newTop = startRect.top;
                let newWidth = startRect.width;
                let newHeight = startRect.height;
                
                const isCorner = ['tl', 'tr', 'bl', 'br'].includes(resizePos);
                const isImage = box.classList.contains('image-box');
                const aspectRatio = startRect.width / startRect.height;
                
                if (isImage && isCorner) {
                    // Proportional resize locked aspect ratio
                    let primaryDx = dx;
                    if (resizePos === 'tl') {
                        newWidth = startRect.width - primaryDx;
                        newHeight = newWidth / aspectRatio;
                        newLeft = startRect.left + primaryDx;
                        newTop = startRect.top + (startRect.height - newHeight);
                    } else if (resizePos === 'tr') {
                        newWidth = startRect.width + primaryDx;
                        newHeight = newWidth / aspectRatio;
                        newTop = startRect.top - (newHeight - startRect.height);
                    } else if (resizePos === 'bl') {
                        newWidth = startRect.width - primaryDx;
                        newHeight = newWidth / aspectRatio;
                        newLeft = startRect.left + primaryDx;
                    } else if (resizePos === 'br') {
                        newWidth = startRect.width + primaryDx;
                        newHeight = newWidth / aspectRatio;
                    }
                } else {
                    // Freeform resize
                    if (resizePos.includes('l')) {
                        newWidth = startRect.width - dx;
                        newLeft = startRect.left + dx;
                    }
                    if (resizePos.includes('r')) {
                        newWidth = startRect.width + dx;
                    }
                    if (resizePos.includes('t')) {
                        newHeight = startRect.height - dy;
                        newTop = startRect.top + dy;
                    }
                    if (resizePos.includes('b')) {
                        newHeight = startRect.height + dy;
                    }
                }
                
                if (newWidth > 20 && newHeight > 20) {
                    box.style.width = `${newWidth}px`;
                    box.style.height = `${newHeight}px`;
                    box.style.left = `${newLeft}px`;
                    box.style.top = `${newTop}px`;
                }
            }
        });

        box.addEventListener('pointerup', (e) => {
            if (this.cropperInstance) return;
            box.releasePointerCapture(e.pointerId);
            if (isDragging || isResizing) {
                const finalRect = {
                    left: parseFloat(box.style.left),
                    top: parseFloat(box.style.top),
                    width: box.offsetWidth,
                    height: box.offsetHeight
                };
                
                if (finalRect.left !== startRect.left || finalRect.top !== startRect.top || finalRect.width !== startRect.width || finalRect.height !== startRect.height) {
                    const ann = this.getAnnotationByElement(box);
                    if (ann) {
                        this.historyManager.execute(new MoveResizeCommand(ann, startRect, finalRect));
                    }
                }
            }
            isDragging = false;
            isResizing = false;
            resizePos = null;
        });
    }

    getAnnotations() {
        return this.annotations.map(ann => {
            if (!document.body.contains(ann.element)) return null;

            const rect = ann.element.getBoundingClientRect();
            const pageRect = ann.pageContainer.getBoundingClientRect();
            const style = this.getStyle(ann);
            
            return {
                type: ann.type,
                pageIndex: parseInt(ann.pageContainer.dataset.pageIndex),
                x: rect.left - pageRect.left,
                y: rect.top - pageRect.top,
                width: rect.width,
                height: rect.height,
                text: ann.type === 'text' ? ann.element.querySelector('.text-box-content').innerText : null,
                style: style,
                imgData: ann.imgData
            };
        }).filter(Boolean);
    }
}
