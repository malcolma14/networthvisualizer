import { useState } from 'react';

const HASH = '5a8d4e2c'; // partial hash for obfuscation — actual check below

export default function PasswordScreen({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // Simple check — this is a deterrent, not cryptographic security
    if (password === 'a8pECuJ%7AHmDMc#Qtr%') {
      sessionStorage.setItem('nwd_auth', '1');
      onAuthenticated();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-ig-pale">
      <div className="w-full max-w-sm mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ig-dark mb-2">Net Worth Dashboard</h1>
          <p className="text-ig-grey text-sm">IG Wealth Management</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-ig-grey/10 p-6">
          <p className="text-ig-dark text-sm font-medium mb-4">Enter password to continue</p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              className={`w-full border rounded-lg px-4 py-3 text-sm text-ig-dark focus:outline-none focus:ring-2 focus:ring-ig-mid/30 focus:border-ig-mid transition-colors ${
                error ? 'border-ig-red bg-red-50' : 'border-ig-grey/30'
              }`}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />

            {error && (
              <p className="mt-2 text-ig-red text-xs">Incorrect password.</p>
            )}

            <button
              type="submit"
              disabled={!password}
              className="mt-4 w-full py-3 bg-ig-dark text-white font-semibold rounded-lg hover:bg-ig-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
