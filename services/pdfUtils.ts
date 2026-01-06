
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Sử dụng CDN cho worker để đảm bảo phiên bản khớp với thư viện chính (được load qua importmap trong index.html)
// Điều này sửa lỗi "Invalid URL" và lỗi "Version Mismatch" khi chạy trên môi trường có importmap.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface PdfPageData {
  pageNumber: number;
  imageData: string;
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
  
  return canvas.toDataURL('image/jpeg', 0.8);
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
