
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Eye, FileText, Pencil, Save, X, Code } from 'lucide-react';

interface PageResultProps {
  pageNumber: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  originalImage: string | null;
  extractedHtml: string;
  onSaveHtml: (html: string) => void;
}

export const PageResult: React.FC<PageResultProps> = ({ pageNumber, status, originalImage, extractedHtml, onSaveHtml }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(extractedHtml);

  // Sync edit value when extractedHtml changes (e.g. when switching pages or processing finishes)
  useEffect(() => {
    setEditValue(extractedHtml);
    // Exit edit mode if page changes
    setIsEditing(false);
  }, [extractedHtml, pageNumber]);

  const handleSave = () => {
    onSaveHtml(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(extractedHtml);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          Chi tiết Trang {pageNumber}
        </h3>
        
        <div className="flex items-center gap-2">
          {status === 'pending' && <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">Đang chờ...</span>}
          {status === 'processing' && (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              <Loader2 className="w-3 h-3 animate-spin" /> Đang xử lý
            </span>
          )}
          {status === 'done' && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
              <CheckCircle2 className="w-3 h-3" /> Hoàn tất
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
              <AlertCircle className="w-3 h-3" /> Lỗi
            </span>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden min-h-0">
        {/* Left: Original Scan */}
        <div className="flex flex-col gap-2 h-full min-h-0">
          <div className="flex items-center gap-2 mb-1 flex-shrink-0">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bản gốc (Scan)</span>
          </div>
          <div className="bg-gray-100 rounded-lg border border-gray-200 p-2 flex items-center justify-center h-full overflow-auto relative">
            {originalImage ? (
              <img 
                src={originalImage} 
                alt={`Page ${pageNumber}`} 
                className="max-w-full h-auto shadow-sm rounded border border-gray-300 object-contain max-h-full"
              />
            ) : (
               <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                  <span className="text-xs">Đang tải hình ảnh...</span>
               </div>
            )}
          </div>
        </div>

        {/* Right: Extracted HTML */}
        <div className="flex flex-col gap-2 h-full min-h-0">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 text-blue-500 flex items-center justify-center font-bold font-serif">T</div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                {isEditing ? 'Chỉnh sửa mã HTML' : 'Kết quả (HTML Preview)'}
              </span>
            </div>
            
            {status === 'done' && (
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button 
                      onClick={handleCancel}
                      className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Hủy bỏ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleSave}
                      className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                      title="Lưu thay đổi"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Sửa</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 flex-1 relative h-full overflow-hidden">
            {isEditing ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full h-full p-4 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Nhập mã HTML tại đây..."
                spellCheck={false}
              />
            ) : (
              <div className="absolute inset-0 overflow-auto custom-scrollbar">
                {status === 'done' ? (
                  extractedHtml ? (
                    <>
                      <style>{`
                        /* Force black text for better readability as requested */
                        .extracted-content { color: #000 !important; }
                        .extracted-content table { border-collapse: collapse; width: 100%; }
                        .extracted-content th, .extracted-content td { border: 1px solid #d1d5db; padding: 8px; color: #000 !important; }
                        .extracted-content th { background-color: #f3f4f6; font-weight: bold; }
                        /* Ensure text inside specific background cells is also black */
                        .extracted-content * { color: #000 !important; }
                      `}</style>
                      <div 
                        className="extracted-content prose prose-sm max-w-none p-6"
                        dangerouslySetInnerHTML={{ __html: extractedHtml }} 
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-4 text-center">
                       <AlertCircle className="w-6 h-6 text-yellow-500" />
                       <p className="text-sm">Đã xử lý xong nhưng không tìm thấy nội dung.</p>
                       <p className="text-xs">Có thể do trang trắng hoặc ảnh quá mờ.</p>
                    </div>
                  )
                ) : status === 'processing' ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <p className="text-sm">Đang phân tích hình ảnh...</p>
                    <p className="text-xs text-gray-400">Việc này có thể mất vài giây</p>
                  </div>
                ) : status === 'error' ? (
                  <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2 p-4 text-center">
                    <AlertCircle className="w-8 h-8" />
                    <p className="text-sm font-medium">Lỗi trích xuất</p>
                    <p className="text-xs text-red-300">{extractedHtml.replace(/<[^>]*>?/gm, '') || "Hệ thống sẽ thử lại tự động."}</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">
                    <p className="text-sm">Kết quả sẽ hiện ở đây</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
