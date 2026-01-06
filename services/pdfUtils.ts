
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// --- PDF WORKER CONFIGURATION ---
// Set worker source to a specific version to ensure stability on Vercel/CDN.
// Fallback to 4.4.168 if version is not detected.
const pdfjsVersion = pdfjsLib.version || '4.4.168';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

export interface PdfPageData {
  pageNumber: number;
  imageData: string;
}

export const loadPdf = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
};

// --- UPDATE: Render with High Quality for OCR ---
export const renderPageToImage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale = 2.5): Promise<string> => {
  const page = await pdf.getPage(pageNumber);
  
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error("Could not get canvas context");
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext as any).promise;
  
  // Return high quality JPEG
  return canvas.toDataURL('image/jpeg', 0.95);
};

export const createPdfFromImages = async (imageFiles: File[]): Promise<File> => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'px',
    format: 'a4',
  });

  doc.deletePage(1);

  for (const file of imageFiles) {
    await new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const width = img.width;
          const height = img.height;
          doc.addPage([width, height], width > height ? 'landscape' : 'portrait');
          doc.addImage(img.src, 'JPEG', 0, 0, width, height);
          resolve();
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const pdfBlob = doc.output('blob');
  return new File([pdfBlob], "converted_images.pdf", { type: "application/pdf" });
};
