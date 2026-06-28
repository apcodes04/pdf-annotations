class StorageManager {
    constructor() {
        this.dbName = "pdfAnnotatorDB";
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                if (!this.db.objectStoreNames.contains("state")) {
                    this.db.createObjectStore("state", { keyPath: "id" });
                }
            };
        });
    }

    async saveState(pdfs, annotations) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["state"], "readwrite");
            const store = transaction.objectStore("state");
            
            const stateObj = {
                id: "currentState",
                pdfs: pdfs,
                annotations: annotations
            };
            
            const request = store.put(stateObj);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async loadState() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["state"], "readonly");
            const store = transaction.objectStore("state");
            const request = store.get("currentState");
            
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async clearState() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["state"], "readwrite");
            const store = transaction.objectStore("state");
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
}
