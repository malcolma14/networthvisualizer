import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { analyseCSV } from '../lib/claude';

// Steps: 'upload' → 'post-upload' → 'family-setup' → done
export default function UploadScreen({ onComplete, onFamilyTreeComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Real-time status log
  const [statusLog, setStatusLog] = useState([]); // [{text, done}]
  const [currentStatus, setCurrentStatus] = useState('');

  // Multi-member state
  const [profiles, setProfiles] = useState([]); // [{name, analysisData, fundResearch}]
  const [step, setStep] = useState('upload'); // 'upload' | 'post-upload' | 'family-setup'
  const [pendingResult, setPendingResult] = useState(null); // result awaiting naming
  const [profileName, setProfileName] = useState('');

  // Family setup state
  const [familyName, setFamilyName] = useState('');
  const [genAssignments, setGenAssignments] = useState({}); // profileIndex → genNumber

  const processFile = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setStatusLog([]);
    setCurrentStatus('Reading the statement…');

    try {
      const text = await readFileAsText(file);
      const result = Papa.parse(text, {
        header: false,
        skipEmptyLines: false,
        dynamicTyping: false,
      });

      if (!result.data || result.data.length === 0) {
        throw new Error('The CSV file appears to be empty or could not be parsed.');
      }

      setStatusLog((prev) => [...prev, { text: 'CSV parsed', done: true }]);

      const analysis = await analyseCSV(result.data, (msg) => {
        if (!msg) return;
        // Fund library hits — immediate completion
        if (msg.includes('fund library')) {
          setStatusLog((prev) => [...prev, { text: msg, done: true, verified: true, fromLibrary: true }]);
        // Fund-specific messages from sequential research
        } else if (msg.startsWith('Researching ') && !msg.includes('via web search')) {
          setCurrentStatus(msg);
        } else if (msg.includes('— done') || msg.includes('— verified') || msg.includes('— not found') || msg.includes('— error')) {
          // A fund completed — move to log
          const fundLabel = msg.replace('…', '').replace('— done', '').trim();
          const isVerified = msg.includes('verified');
          const isMissing = msg.includes('no allocation');
          const statusText = isVerified
            ? (isMissing ? `${fundLabel} — verified (no allocation data)` : `${fundLabel} — verified`)
            : msg.includes('not found') ? `${fundLabel} — not found` : `${fundLabel} — error`;
          setStatusLog((prev) => [...prev, { text: statusText, done: true, verified: isVerified }]);
        } else if (msg.includes('holdings')) {
          setCurrentStatus(msg);
        } else {
          // General status like "Analyzing asset allocation…"
          setCurrentStatus(msg);
          if (msg.includes('Parsing')) {
            // Already logged above
          }
        }
      });

      if (profiles.length === 0 && step === 'upload') {
        // First file — store pending and ask what to do next
        setPendingResult(analysis);
        setProfileName(analysis.data.clientName || '');
        setStep('post-upload');
        setLoading(false);
      } else {
        // Subsequent file — store pending and ask for name
        setPendingResult(analysis);
        setProfileName(analysis.data.clientName || '');
        setStep('post-upload');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }, [profiles, step]);

  function savePendingProfile() {
    if (!pendingResult) return;
    const name = profileName.trim() || `Profile ${profiles.length + 1}`;
    setProfiles((prev) => [...prev, {
      name,
      analysisData: pendingResult.data,
      fundResearch: pendingResult.fundResearch || {},
    }]);
    setPendingResult(null);
    setProfileName('');
  }

  function handleViewDashboard() {
    if (pendingResult && profiles.length === 0) {
      // Single profile mode — pass directly
      onComplete(pendingResult);
    }
  }

  function handleAddAnother() {
    savePendingProfile();
    setStep('upload');
  }

  function handleProceedToFamilySetup() {
    savePendingProfile();
    setStep('family-setup');
  }

  function handleFamilyDone() {
    const allProfiles = profiles.length > 0 ? profiles :
      (pendingResult ? [{ name: profileName || 'Profile 1', analysisData: pendingResult.data, fundResearch: pendingResult.fundResearch || {} }] : []);

    // Build generations from assignments
    const genMap = {};
    allProfiles.forEach((profile, idx) => {
      const gen = genAssignments[idx] || 1;
      if (!genMap[gen]) genMap[gen] = { id: `gen_${gen}`, label: `Generation ${gen}`, members: [] };
      genMap[gen].members.push({
        id: `member_${idx}`,
        name: profile.name,
        analysisData: profile.analysisData,
        fundResearch: profile.fundResearch,
      });
    });

    const generations = Object.keys(genMap).sort((a, b) => a - b).map((k) => genMap[k]);

    const tree = {
      name: familyName.trim() || 'Family',
      generations,
    };

    onFamilyTreeComplete(tree);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const bytes = new Uint8Array(buffer);

        // Check for UTF-16 BOM
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
          const decoder = new TextDecoder('utf-16le');
          resolve(decoder.decode(buffer));
        } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
          const decoder = new TextDecoder('utf-16be');
          resolve(decoder.decode(buffer));
        } else {
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

  // ─── Family Setup Step ───
  if (step === 'family-setup') {
    const allProfiles = profiles;
    return (
      <div className="flex items-center justify-center min-h-screen bg-ig-pale">
        <div className="w-full max-w-xl mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-ig-dark mb-2">Define family structure</h1>
            <p className="text-ig-grey text-sm">Assign each profile to a generation</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-ig-grey/10 p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-ig-dark mb-1">Family name</label>
              <input
                type="text"
                className="w-full border border-ig-grey/30 rounded-lg px-4 py-2.5 text-sm text-ig-dark focus:outline-none focus:ring-2 focus:ring-ig-mid/30 focus:border-ig-mid"
                placeholder="e.g. The Malcolm Family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {allProfiles.map((profile, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm text-ig-dark flex-1 truncate">{profile.name}</span>
                  <select
                    className="border border-ig-grey/30 rounded-lg px-3 py-2 text-sm text-ig-dark focus:outline-none focus:ring-2 focus:ring-ig-mid/30"
                    value={genAssignments[idx] || 1}
                    onChange={(e) => setGenAssignments((prev) => ({ ...prev, [idx]: parseInt(e.target.value) }))}
                  >
                    <option value={1}>Generation 1</option>
                    <option value={2}>Generation 2</option>
                    <option value={3}>Generation 3</option>
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={handleFamilyDone}
              className="w-full py-3 bg-ig-dark text-white font-semibold rounded-lg hover:bg-ig-mid transition-colors"
            >
              View family dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Post-Upload Step (name profile + choose next action) ───
  if (step === 'post-upload' && pendingResult) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ig-pale">
        <div className="w-full max-w-xl mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-ig-dark mb-2">Net Worth Dashboard</h1>
            <p className="text-ig-grey text-sm">IG Wealth Management</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-ig-grey/10 p-6 space-y-5">
            {/* Already uploaded profiles */}
            {profiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ig-grey uppercase tracking-wide">Uploaded profiles</p>
                {profiles.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-ig-dark bg-ig-pale rounded-lg px-3 py-2">
                    <span className="w-5 h-5 rounded-full bg-ig-mid text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Name this profile */}
            <div>
              <label className="block text-xs font-semibold text-ig-dark mb-1">
                {profiles.length === 0 ? 'Who is this profile for?' : 'Name this profile'}
              </label>
              <input
                type="text"
                className="w-full border border-ig-grey/30 rounded-lg px-4 py-2.5 text-sm text-ig-dark focus:outline-none focus:ring-2 focus:ring-ig-mid/30 focus:border-ig-mid"
                placeholder="e.g. Robert & Jane Malcolm"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {profiles.length === 0 && (
                <button
                  onClick={handleViewDashboard}
                  className="w-full py-3 bg-ig-dark text-white font-semibold rounded-lg hover:bg-ig-mid transition-colors"
                >
                  View dashboard
                </button>
              )}

              <button
                onClick={handleAddAnother}
                className="w-full py-3 bg-white text-ig-dark font-semibold rounded-lg border border-ig-grey/30 hover:border-ig-mid transition-colors"
              >
                Add another family member
              </button>

              {profiles.length > 0 && (
                <button
                  onClick={handleProceedToFamilySetup}
                  className="w-full py-3 bg-ig-dark text-white font-semibold rounded-lg hover:bg-ig-mid transition-colors"
                >
                  Define family structure ({profiles.length + 1} profiles)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Upload Step ───
  return (
    <div className="flex items-center justify-center min-h-screen bg-ig-pale">
      <div className="w-full max-w-xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-ig-dark mb-2">Net Worth Dashboard</h1>
          <p className="text-ig-grey text-sm">IG Wealth Management</p>
        </div>

        {/* Already uploaded profiles indicator */}
        {profiles.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold text-ig-grey uppercase tracking-wide">Uploaded profiles</p>
            {profiles.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-ig-dark bg-white rounded-lg px-3 py-2 border border-ig-grey/10">
                <span className="w-5 h-5 rounded-full bg-ig-mid text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="truncate">{p.name}</span>
              </div>
            ))}
          </div>
        )}

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
                {profiles.length > 0 ? 'Drop the next net worth CSV here' : 'Drop your net worth statement CSV here'}
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

            {/* If we have profiles already, offer to skip to family setup */}
            {profiles.length >= 2 && (
              <button
                onClick={() => setStep('family-setup')}
                className="mt-4 w-full py-3 bg-ig-dark text-white font-semibold rounded-lg hover:bg-ig-mid transition-colors"
              >
                Done uploading — define family structure ({profiles.length} profiles)
              </button>
            )}
          </>
        ) : (
          /* Loading state — real-time progress log */
          <div className="py-8 px-4">
            {/* Completed steps */}
            {statusLog.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {statusLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-ig-grey">
                    <span className={entry.fromLibrary ? 'text-ig-mid' : entry.verified !== false ? 'text-ig-green' : 'text-ig-amber'}>
                      {entry.verified !== false ? '✓' : '⚠'}
                    </span>
                    <span className={entry.fromLibrary ? 'text-ig-mid' : ''}>{entry.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Current in-progress step */}
            {currentStatus && (
              <div className="flex items-center gap-3 py-3">
                <div className="w-4 h-4 border-2 border-ig-mid border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-ig-dark font-semibold text-sm">{currentStatus}</p>
              </div>
            )}

            <p className="mt-4 text-ig-grey text-xs text-center">
              This may take a minute — we're looking up each holding individually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
