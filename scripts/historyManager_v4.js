class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.undoBtn = document.getElementById('undoBtn');
        this.redoBtn = document.getElementById('redoBtn');
    }

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = []; 
        this.updateButtons();
    }

    undo() {
        if (this.undoStack.length > 0) {
            const command = this.undoStack.pop();
            command.undo();
            this.redoStack.push(command);
            this.updateButtons();
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const command = this.redoStack.pop();
            command.execute();
            this.undoStack.push(command);
            this.updateButtons();
        }
    }

    updateButtons() {
        if (this.undoBtn) this.undoBtn.disabled = this.undoStack.length === 0;
        if (this.redoBtn) this.redoBtn.disabled = this.redoStack.length === 0;
    }
}

// Command Interface: { execute(), undo() }

class AddAnnotationCommand {
    constructor(annManager, annotation) {
        this.annManager = annManager;
        this.annotation = annotation;
    }
    execute() {
        // Assume already added initially, but on redo we need to re-add
        if (!this.annManager.annotations.includes(this.annotation)) {
            this.annManager.annotations.push(this.annotation);
            this.annotation.pageContainer.querySelector('.annotation-layer').appendChild(this.annotation.element);
        }
    }
    undo() {
        const idx = this.annManager.annotations.indexOf(this.annotation);
        if (idx > -1) this.annManager.annotations.splice(idx, 1);
        if (this.annotation.element.parentNode) {
            this.annotation.element.parentNode.removeChild(this.annotation.element);
        }
    }
}

class DeleteAnnotationCommand {
    constructor(annManager, annotation) {
        this.annManager = annManager;
        this.annotation = annotation;
    }
    execute() {
        const idx = this.annManager.annotations.indexOf(this.annotation);
        if (idx > -1) this.annManager.annotations.splice(idx, 1);
        if (this.annotation.element.parentNode) {
            this.annotation.element.parentNode.removeChild(this.annotation.element);
        }
    }
    undo() {
        this.annManager.annotations.push(this.annotation);
        this.annotation.pageContainer.querySelector('.annotation-layer').appendChild(this.annotation.element);
    }
}

class MoveResizeCommand {
    constructor(annotation, oldRect, newRect) {
        this.annotation = annotation;
        this.oldRect = oldRect; // { left, top, width, height }
        this.newRect = newRect;
    }
    execute() {
        this.applyRect(this.newRect);
    }
    undo() {
        this.applyRect(this.oldRect);
    }
    applyRect(rect) {
        this.annotation.element.style.left = `${rect.left}px`;
        this.annotation.element.style.top = `${rect.top}px`;
        this.annotation.element.style.width = `${rect.width}px`;
        this.annotation.element.style.height = `${rect.height}px`;
    }
}

class StyleCommand {
    constructor(annotation, oldStyle, newStyle) {
        this.annotation = annotation;
        this.oldStyle = oldStyle;
        this.newStyle = newStyle;
    }
    execute() {
        this.applyStyle(this.newStyle);
    }
    undo() {
        this.applyStyle(this.oldStyle);
    }
    applyStyle(style) {
        if (this.annotation.type === 'text') {
            const content = this.annotation.element.querySelector('.text-box-content');
            content.classList.toggle('bold', style.bold);
            content.classList.toggle('italic', style.italic);
            
            if (style.color === 'auto') {
                content.classList.add('auto-color');
                content.style.color = '';
            } else {
                content.classList.remove('auto-color');
                content.style.color = style.color;
            }
            
            if (style.fontSize) content.style.fontSize = `${style.fontSize}px`;
            if (style.fontFamily) content.style.fontFamily = style.fontFamily;
        } else {
            this.annotation.element.classList.toggle('has-border', style.border);
        }
    }
}

class TextEditCommand {
    constructor(annotation, oldText, newText) {
        this.annotation = annotation;
        this.oldText = oldText;
        this.newText = newText;
    }
    execute() {
        this.annotation.element.querySelector('.text-box-content').innerText = this.newText;
    }
    undo() {
        this.annotation.element.querySelector('.text-box-content').innerText = this.oldText;
    }
}

class AddPageCommand {
    constructor(renderer, index) {
        this.renderer = renderer;
        this.index = index;
        this.pageContainer = null;
    }
    execute() {
        if (this.pageContainer) {
            this.renderer.insertExistingPage(this.index, this.pageContainer);
        } else {
            this.pageContainer = this.renderer.addBlankPage(this.index);
        }
    }
    undo() {
        this.renderer.deletePage(this.index, false); // false = don't create a command
    }
}

class DeletePageCommand {
    constructor(renderer, index, pageContainer) {
        this.renderer = renderer;
        this.index = index;
        this.pageContainer = pageContainer;
    }
    execute() {
        this.renderer.deletePage(this.index, false);
    }
    undo() {
        this.renderer.insertExistingPage(this.index, this.pageContainer);
    }
}

class CropCommand {
    constructor(annManager, annotation, oldImgData, newImgData, oldRect, newRect) {
        this.annManager = annManager;
        this.annotation = annotation;
        this.oldImgData = oldImgData;
        this.newImgData = newImgData;
        this.oldRect = oldRect;
        this.newRect = newRect;
    }
    execute() {
        this.annotation.imgData = this.newImgData;
        const img = this.annotation.element.querySelector('img');
        if (img && !img.classList.contains('cropper-hidden')) {
            img.src = this.newImgData;
        }
        this.applyRect(this.newRect);
    }
    undo() {
        this.annotation.imgData = this.oldImgData;
        const img = this.annotation.element.querySelector('img');
        if (img && !img.classList.contains('cropper-hidden')) {
            img.src = this.oldImgData;
        }
        this.applyRect(this.oldRect);
    }
    applyRect(rect) {
        this.annotation.element.style.left = `${rect.left}px`;
        this.annotation.element.style.top = `${rect.top}px`;
        this.annotation.element.style.width = `${rect.width}px`;
        this.annotation.element.style.height = `${rect.height}px`;
    }
}

class ReorderPagesCommand {
    constructor(renderer, oldPages, newPages) {
        this.renderer = renderer;
        this.oldPages = [...oldPages];
        this.newPages = [...newPages];
    }
    execute() {
        this.renderer.pages = [...this.newPages];
        this.renderer.updateDOM();
    }
    undo() {
        this.renderer.pages = [...this.oldPages];
        this.renderer.updateDOM();
    }
}
