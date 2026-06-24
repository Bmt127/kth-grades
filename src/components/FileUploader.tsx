import { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, Loader2 } from 'lucide-react';
import type { Course } from '../types';
import { parseCSV, generateSampleCSV } from '../csvParser';
import { parsePdf } from '../pdfParser';

export function FileUploader({ onImport }: { onImport: (courses: Course[]) => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    setLoading(true);

    try {
      let courses: Course[];

      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        courses = await parsePdf(file);
      } else {
        const text = await file.text();
        courses = parseCSV(text);
      }

      if (courses.length === 0) {
        setError(
          'No valid courses found. For PDFs, make sure it\'s a Ladok resultatintyg with course codes (e.g. DD1337) and grades. For CSV, use columns: Code, Name, Credits, Grade.'
        );
        return;
      }

      onImport(courses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function downloadSample() {
    const blob = new Blob([generateSampleCSV()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kth-grades-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        {loading ? (
          <>
            <Loader2 size={32} className="mx-auto mb-3 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Parsing your transcript...</p>
          </>
        ) : (
          <>
            <Upload size={32} className="mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Drop your Ladok PDF or CSV file here
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports Ladok resultatintyg (PDF) and CSV/TSV files
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={downloadSample}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
      >
        <Download size={14} /> Download sample CSV format
      </button>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <p className="text-xs font-medium text-gray-500">Supported formats:</p>
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>PDF:</strong> Ladok resultatintyg — the app reads course codes, grades, credits, and dates directly from the PDF.</p>
          <p><strong>CSV:</strong> Columns — Code, Name, Credits, Grade, Date, Period. Swedish headers (Kurskod, Betyg, etc.) also work.</p>
        </div>
      </div>
    </div>
  );
}
