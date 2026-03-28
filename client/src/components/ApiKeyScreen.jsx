import { useState } from 'react';
import { initClient } from '../lib/claude';

export default function ApiKeyScreen({ onReady }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;

    setTesting(true);
    setError(null);

    try {
      initClient(trimmed);
      // Store in sessionStorage so it survives page navigations but not browser close
      sessionStorage.setItem('nwd_api_key', trimmed);
      onReady();
    } catch (err) {
      setError(err.message || 'Invalid API key');
      setTesting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-ig-pale">
      <div className="w-full max-w-md mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ig-dark mb-2">Net Worth Dashboard</h1>
          <p className="text-ig-grey text-sm">IG Wealth Management</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-ig-grey/10 p-6">
          <h2 className="text-lg font-bold text-ig-dark mb-1">Enter your API key</h2>
          <p className="text-ig-grey text-sm mb-5">
            Your Anthropic API key is needed to power the AI analysis.
            It stays in your browser and is never stored on any server.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              className="w-full border border-ig-grey/30 rounded-lg px-4 py-3 text-sm text-ig-dark focus:outline-none focus:ring-2 focus:ring-ig-mid/30 focus:border-ig-mid"
              placeholder="sk-ant-..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
            />

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-ig-red/20 rounded-lg text-ig-red text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!key.trim() || testing}
              className="mt-4 w-full py-3 bg-ig-dark text-white font-semibold rounded-lg hover:bg-ig-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing ? 'Connecting…' : 'Continue'}
            </button>
          </form>

          <p className="mt-4 text-xs text-ig-grey text-center leading-relaxed">
            Need a key? Visit{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ig-mid underline"
            >
              console.anthropic.com
            </a>{' '}
            to create one.
          </p>
        </div>
      </div>
    </div>
  );
}
