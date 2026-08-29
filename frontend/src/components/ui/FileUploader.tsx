import React, { useRef, useState } from 'react';
import { parseEmailFile } from '../../utils/csvParser';
import type { ParseResult } from '../../utils/csvParser';

interface FileUploaderProps {
  onParsed: (result: ParseResult) => void;
  disabled?: boolean;
}

export function FileUploader({ onParsed, disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'txt'].includes(ext ?? '')) {
      setError('Please upload a .csv or .txt file');
      return;
    }
    setError(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const result = await parseEmailFile(file);
      onParsed(result);
    } catch (err: any) {
      setError(err.message ?? 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div
        className={[
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          dragging
            ? 'border-violet-500 bg-violet-500/5'
            : 'border-gray-700 hover:border-gray-500 bg-gray-900/50',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        aria-label="Upload CSV or TXT file"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />

        {parsing ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-gray-400">Parsing {fileName}…</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-1">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-200">{fileName}</p>
            <p className="text-xs text-gray-500">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm text-gray-400">
              Drop your <span className="text-violet-400">CSV</span> or <span className="text-violet-400">TXT</span> file here
            </p>
            <p className="text-xs text-gray-600">or click to browse</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
