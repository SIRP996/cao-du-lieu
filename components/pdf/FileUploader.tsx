
import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Image as ImageIcon, ClipboardPaste } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (files: File[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files);
        validateAndSelectFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSelectFiles = (files: File[]) => {
    setError(null);
    
    if (files.length === 0) return;

    // Check types
    const validFiles: File[] = [];
    let hasInvalidType = false;

    for (const file of files) {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        validFiles.push(file);
      } else {
        hasInvalidType = true;
      }
    }

    if (hasInvalidType && validFiles.length === 0) {
      setError("Vui lòng chỉ tải lên file PDF hoặc Hình ảnh (JPG, PNG).");
      return;
    }

    // Limit size (200MB total roughly)
    const totalSize = validFiles.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 200 * 1024 * 1024) {
      setError("Tổng dung lượng quá lớn (Tối đa 200MB).");
      return;
    }

    onFileSelect(validFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectFiles(Array.from(e.target.files));
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out text-center cursor-pointer group
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"}
          ${error ? "border-red-300 bg-red-50" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/*"
          multiple
          onChange={handleChange}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className={`p-4 rounded-full ${error ? 'bg-red-100' : 'bg-blue-100'}`}>
            {error ? (
              <AlertCircle className="w-8 h-8 text-red-500" />
            ) : (
              <div className="relative">
                 <Upload className="w-8 h-8 text-blue-500" />
                 <ClipboardPaste className="w-5 h-5 text-blue-700 absolute -bottom-1 -right-2 bg-white rounded-full border border-blue-100" />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {error ? "Lỗi tải file" : "Tải lên PDF hoặc Hình ảnh Facebook"}
            </h3>
            <p className="text-sm text-gray-500">
              {error ? error : "Kéo thả file vào đây hoặc click để chọn"}
            </p>
          </div>
          
          {!error && (
             <div className="flex flex-wrap justify-center gap-2 mt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  <FileText className="w-3 h-3" />
                  <span>PDF</span>
                </div>
                 <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  <ImageIcon className="w-3 h-3" />
                  <span>JPG/PNG (Nhiều ảnh)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 animate-pulse">
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Hỗ trợ Ctrl+V (Dán ảnh)</span>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
