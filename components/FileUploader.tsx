import React, { useCallback } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        const fileType = file.name.split('.').pop()?.toLowerCase();
        
        if (['csv', 'xlsx', 'xls'].includes(fileType || '')) {
          onFileUpload(file);
        } else {
          alert('Please upload a valid CSV or Excel file.');
        }
      }
    },
    [onFileUpload]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="w-full max-w-3xl mx-auto h-64 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50 hover:border-brand-500 transition-all group"
    >
      <input
        type="file"
        accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        className="hidden"
        id="file-upload"
        onChange={handleInputChange}
      />
      <label
        htmlFor="file-upload"
        className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
      >
        <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:shadow-md transition-shadow">
          <UploadCloud className="w-8 h-8 text-brand-500" />
        </div>
        <p className="text-lg font-semibold text-slate-700">
          Click to upload or drag and drop
        </p>
        <p className="text-sm text-slate-500 mt-2">
          CSV or Excel files (e.g., .csv, .xlsx)
        </p>
        
        <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
          <FileSpreadsheet className="w-4 h-4" />
          <span>Supports standard CSV & Excel tables</span>
        </div>
      </label>
    </div>
  );
};