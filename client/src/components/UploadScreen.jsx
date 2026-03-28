import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { analyseCSV } from '../lib/api';

const STATUS_MESSAGES = [
  'Reading the statement…',
  'Parsing accounts and holdings…',
  'Researching holdings…',
  'Analyzing asset allocation…',
  'Preparing questions…',
];

export default function UploadScreen({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setStatusIndex(0);

    // Cycle through status messages
    const interval = setInterval(() => {
      setStatusIndex((prev) => Math.min(prev + 1, STATUS_MESSAGES.length - 1));
    }, 3000);

    try {
      // Read the file — handle UTF-16 encoding
      const text = await readFileAsText(file);

      // Parse CSV
      const result = Papa.parse(text, {
        header: false,
        skipEmptyLines: false,
        dynamicTyping: false,
      });

      if (!result.data || result.data.length === 0) {
        throw new Error('The CSV file appears to be empty or could not be parsed.');
      }

      // Send to server
      const analysis = await analyseCSV(result.data);
      clearInterval(interval);
      onComplete(analysis);
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }, [onComplete]);

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const bytes = new Uint8Array(buffer);

        // Check for UTF-16 BOM
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
          // UTF-16 LE
          const decoder = new TextDecoder('utf-16le');
          resolve(decoder.decode(buffer));
        } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
          // UTF-16 BE
          const decoder = new TextDecoder('utf-16be');
          resolve(decoder.decode(buffer));
        } else {
          // Assume UTF-8
          const decoder = new TextDecoder('utf-8');
          resolve(decoder.decode(buffer));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-ig-pale">
      <div className="w-full max-w-xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-ig-dark mb-2">Net Worth Dashboard</h1>
          <p className="text-ig-grey text-sm">IG Wealth Management</p>
        </div>

        {!loading ? (
          <>
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-ig-mid bg-blue-50'
                  : 'border-ig-grey/40 hover:border-ig-mid hover:bg-white'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <div className="mb-4">
                <svg className="mx-auto w-12 h-12 text-ig-mid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-ig-dark font-semibold mb-1">
                Drop your net worth statement CSV here
              </p>
              <p className="text-ig-grey text-sm">
                or click to browse
              </p>
            </div>

            <input
              id="file-input"
              type="file"
              accept=".csv,.CSV"
              className="hidden"
              onChange={handleFileSelect}
            />

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-ig-red/20 rounded-lg text-ig-red text-sm">
                {error}
              </div>
            )}

            <p className="mt-6 text-center text-ig-grey text-xs">
              Export your client's net worth statement from IG Online as a CSV file, then upload it here.
            </p>
          </>
        ) : (
          /* Loading state */
          <div className="text-center py-12">
            <div className="inline-block w-10 h-10 border-3 border-ig-mid border-t-transparent rounded-full animate-spin mb-6"
                 style={{ borderWidth: '3px' }} />
            <p className="text-ig-dark font-semibold text-lg mb-2">
              {STATUS_MESSAGES[statusIndex]}
            </p>
            <p className="text-ig-grey text-sm">
              This may take a minute — we're researching your client's holdings.
            </p>
            <div className="mt-6 flex justify-center gap-1.5">
              {STATUS_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i <= statusIndex ? 'bg-ig-mid' : 'bg-ig-grey/30'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
