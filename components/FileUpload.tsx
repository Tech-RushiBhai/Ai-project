
import React from 'react';
import { MusicNoteIcon } from './icons';

interface FileUploadProps {
  id: string;
  label: string;
  onFileSelect: (file: File | null) => void;
  fileName: string | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ id, label, onFileSelect, fileName }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    onFileSelect(file);
  };

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-slate-400 mb-2">
        {label}
      </label>
      <label
        htmlFor={id}
        className="flex flex-col items-center justify-center w-full h-32 px-4 transition-all duration-300 bg-slate-800/50 border-2 border-slate-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-fuchsia-500 hover:bg-slate-800 focus:outline-none"
      >
        <MusicNoteIcon className="w-10 h-10 text-slate-500" />
        <span className="mt-2 text-sm text-slate-400">
          {fileName ? (
            <span className="font-semibold text-fuchsia-400">{fileName}</span>
          ) : (
            'Drag & drop or click to upload'
          )}
        </span>
        <input
          id={id}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
    </div>
  );
};

export default FileUpload;