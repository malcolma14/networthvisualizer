import { useState, useRef, useEffect } from 'react';
import { dashboardChat } from '../lib/claude';

export default function DashboardChat({ currentData, onDataUpdate }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text && !attachedFile) return;

    const userMsg = attachedFile
      ? `${text || 'Please extract fund data from this PDF.'} [Attached: ${attachedFile.name}]`
      : text;

    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    let pdfAttachment = null;
    if (attachedFile) {
      try {
        const base64 = await readFileAsBase64(attachedFile);
        pdfAttachment = { base64, filename: attachedFile.name };
      } catch (err) {
        console.error('Failed to read PDF:', err);
      }
      setAttachedFile(null);
    }

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await dashboardChat(currentData, history, text || 'Please extract fund data from this PDF.', pdfAttachment);

      setMessages((prev) => [...prev, { role: 'assistant', content: result.text }]);

      if (result.updatedData) {
        onDataUpdate(result.updatedData);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-6 right-6 px-5 py-3 bg-ig-mid text-white text-sm font-semibold rounded-full shadow-lg hover:bg-ig-dark transition-colors flex items-center gap-2 z-50"
      >
        <span>&#9998;</span> Edit / Ask
      </button>
    );
  }

  return (
    <div className="no-print fixed bottom-6 right-6 w-96 max-h-[500px] bg-white rounded-xl shadow-2xl border border-ig-grey/20 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-ig-dark text-white shrink-0">
        <span className="text-sm font-semibold">Edit Dashboard</span>
        <button onClick={() => setOpen(false)} className="text-ig-light hover:text-white text-lg leading-none">&times;</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
        {messages.length === 0 && (
          <div className="text-xs text-ig-grey text-center py-6">
            <p className="mb-2">Ask me to update the dashboard:</p>
            <p className="italic">"Change the RRSP owner to Jane"</p>
            <p className="italic">"DFA607 is 60% US equity, 40% intl"</p>
            <p className="italic">Upload a fund facts PDF</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-ig-mid text-white'
                : 'bg-ig-pale text-ig-dark'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-ig-pale text-ig-grey px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-ig-mid border-t-transparent rounded-full animate-spin" />
              Updating...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attached file indicator */}
      {attachedFile && (
        <div className="px-4 py-1.5 bg-ig-pale flex items-center justify-between text-xs shrink-0">
          <span className="text-ig-dark truncate">{attachedFile.name}</span>
          <button onClick={() => setAttachedFile(null)} className="text-ig-red ml-2">&times;</button>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-2.5 border-t border-ig-grey/10 flex items-center gap-2 shrink-0">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-ig-grey hover:text-ig-mid transition-colors shrink-0"
          title="Attach PDF"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) setAttachedFile(e.target.files[0]); }}
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a correction or question..."
          className="flex-1 text-xs text-ig-dark bg-ig-pale rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ig-mid"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || (!input.trim() && !attachedFile)}
          className="bg-ig-mid text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-ig-dark transition-colors disabled:opacity-40 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
