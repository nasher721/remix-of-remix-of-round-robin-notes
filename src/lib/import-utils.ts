/**
 * Load PDF.js from CDN and extract text/images
 */

type PdfJsTextItem = { str?: string };

type PdfJsTextContent = {
    items: PdfJsTextItem[];
};

type PdfJsPage = {
    getTextContent: () => Promise<PdfJsTextContent>;
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

type PdfJsDocument = {
    numPages: number;
    getPage: (pageNum: number) => Promise<PdfJsPage>;
};

type PdfJsLib = {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PdfJsDocument> };
};

declare global {
    interface Window {
        pdfjsLib: PdfJsLib;
    }
}

// Load PDF.js from CDN
export const loadPdfJs = async () => {
    if (!window.pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load PDF.js'));
            document.head.appendChild(script);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    return window.pdfjsLib;
};

export const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map((item) => item.str ?? '')
            .join(" ");

        fullText += pageText + "\n\n--- Page Break ---\n\n";
    }

    return fullText;
};

// Convert PDF pages to base64 images for OCR
export const extractPdfAsImages = async (
    file: File,
    scale: number = 2.0,
    maxPages: number = 10
): Promise<string[]> => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const images: string[] = [];

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, maxPages); pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Convert to base64 JPEG (smaller than PNG)
        const imageData = canvas.toDataURL('image/jpeg', 0.85);
        images.push(imageData);
    }

    return images;
};
