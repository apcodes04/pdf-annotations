class PDFExporter {
    constructor() {}

    async export(annotations, currentPagesOrder, loadedPdfs) {
        const newPdfDoc = await PDFLib.PDFDocument.create();
        if (window.fontkit) {
            newPdfDoc.registerFontkit(window.fontkit);
        }
        
        const pdfDocsMap = {};
        for (const loadedPdf of loadedPdfs) {
            pdfDocsMap[loadedPdf.id] = await PDFLib.PDFDocument.load(loadedPdf.bytes);
        }

        const scale = 1.5; 

        // Font caching mechanism
        const fontCache = {};
        fontCache['Helvetica'] = await newPdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        fontCache['Helvetica-Bold'] = await newPdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        fontCache['Helvetica-Italic'] = await newPdfDoc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
        fontCache['Helvetica-BoldItalic'] = await newPdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBoldOblique);
        
        fontCache['TimesRoman'] = await newPdfDoc.embedFont(PDFLib.StandardFonts.TimesRoman);
        fontCache['Courier'] = await newPdfDoc.embedFont(PDFLib.StandardFonts.Courier);

        const getFont = async (family, isBold, isItalic) => {
            if (!family) family = 'Helvetica';
            family = family.replace(/['"]/g, '');
            
            if (family === 'Helvetica') {
                if (isBold && isItalic) return fontCache['Helvetica-BoldItalic'];
                if (isBold) return fontCache['Helvetica-Bold'];
                if (isItalic) return fontCache['Helvetica-Italic'];
                return fontCache['Helvetica'];
            }
            if (family === 'TimesRoman') return fontCache['TimesRoman'];
            if (family === 'Courier') return fontCache['Courier'];
            
            const cacheKey = `${family}-${isBold}-${isItalic}`;
            if (fontCache[cacheKey]) return fontCache[cacheKey];
            
            try {
                const id = family.toLowerCase().replace(/ /g, '-');
                const weight = isBold ? '700' : '400';
                const style = isItalic ? 'italic' : 'normal';
                const url = `https://unpkg.com/@fontsource/${id}@5.0.8/files/${id}-latin-${weight}-${style}.woff`;
                
                let res = await fetch(url);
                if (!res.ok) {
                    res = await fetch(`https://unpkg.com/@fontsource/${id}@5.0.8/files/${id}-latin-400-normal.woff`);
                }
                
                if (res.ok) {
                    const fontBytes = await res.arrayBuffer();
                    const customFont = await newPdfDoc.embedFont(fontBytes);
                    fontCache[cacheKey] = customFont;
                    return customFont;
                }
            } catch(e) {
                console.warn('Failed to load custom font:', family, e);
            }
            return fontCache['Helvetica'];
        };

        for (let i = 0; i < currentPagesOrder.length; i++) {
            const pageObj = currentPagesOrder[i];
            let newPage;
            if (pageObj.isNew) {
                newPage = newPdfDoc.addPage([595.28, 841.89]);
            } else {
                const sourceDoc = pdfDocsMap[pageObj.pdfId];
                if (sourceDoc) {
                    const [copiedPage] = await newPdfDoc.copyPages(sourceDoc, [pageObj.originalIndex]);
                    newPage = newPdfDoc.addPage(copiedPage);
                } else {
                    newPage = newPdfDoc.addPage([595.28, 841.89]); // fallback blank
                }
            }

            const pageAnns = annotations.filter(a => a.pageIndex === i);
            const { height } = newPage.getSize();

            for (const ann of pageAnns) {
                const pdfX = ann.x / scale;
                const pdfY = height - (ann.y / scale) - (ann.height / scale);

                if (ann.type === 'text' && ann.text && ann.text.trim().length > 0) {
                    const font = await getFont(ann.style.fontFamily, ann.style.bold, ann.style.italic);

                    let r = 0, g = 0, b = 0;
                    if (ann.style.color === 'auto' || !ann.style.color) {
                        r = 0; g = 0; b = 0;
                    } else if (ann.style.color.startsWith('#')) {
                        r = parseInt(ann.style.color.substring(1,3), 16) / 255;
                        g = parseInt(ann.style.color.substring(3,5), 16) / 255;
                        b = parseInt(ann.style.color.substring(5,7), 16) / 255;
                    } else if (ann.style.color && ann.style.color.startsWith('rgb')) {
                        const m = ann.style.color.match(/\d+/g);
                        if (m && m.length >= 3) {
                            r = parseInt(m[0])/255; g = parseInt(m[1])/255; b = parseInt(m[2])/255;
                        }
                    }

                    const fontSize = ann.style.fontSize ? ann.style.fontSize / scale : 16 / scale;

                    newPage.drawText(ann.text, {
                        x: pdfX,
                        y: height - (ann.y / scale) - fontSize, // baseline adjustment based on font size
                        size: fontSize,
                        font: font,
                        color: PDFLib.rgb(r, g, b),
                    });
                } else if (ann.type === 'image' && ann.imgData) {
                    let img;
                    if (ann.imgData.startsWith('data:image/png')) {
                        img = await newPdfDoc.embedPng(ann.imgData);
                    } else if (ann.imgData.startsWith('data:image/jpeg') || ann.imgData.startsWith('data:image/jpg')) {
                        img = await newPdfDoc.embedJpg(ann.imgData);
                    }
                    
                    if (img) {
                        const imgWidth = ann.width / scale;
                        const imgHeight = ann.height / scale;
                        newPage.drawImage(img, {
                            x: pdfX,
                            y: pdfY,
                            width: imgWidth,
                            height: imgHeight
                        });

                        if (ann.style.border) {
                            newPage.drawRectangle({
                                x: pdfX,
                                y: pdfY,
                                width: imgWidth,
                                height: imgHeight,
                                borderColor: PDFLib.rgb(0, 0, 0),
                                borderWidth: 2 / scale,
                            });
                        }
                    }
                }
            }
        }

        const pdfBytes = await newPdfDoc.save();
        this.download(pdfBytes, 'annotated_document.pdf');
    }

    download(bytes, filename) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
