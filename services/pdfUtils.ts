
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Define the worker source. 
// We use unpkg to fetch the exact version matching the library.
// We use the .mjs extension to ensure it is loaded as an ES module.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export interface PdfPageData {
  pageNumber: number;
  imageData: string; // Base64 encoded image
}

export const loadPdf = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
};

export const renderPageToImage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale = 1.5): Promise<string> => {
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
  
  // Convert to JPEG for better compression/token usage with Gemini
  return canvas.toDataURL('image/jpeg', 0.8);
};

// New function to convert images to PDF
export const createPdfFromImages = async (imageFiles: File[]): Promise<File> => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'px',
    format: 'a4', // Initial format, will change per page
  });

  // Delete the initial default page so we can add pages with correct dimensions
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
          
          // Add a new page with the exact dimensions of the image
          doc.addPage([width, height], width > height ? 'landscape' : 'portrait');
          
          // Add image to the full page
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
