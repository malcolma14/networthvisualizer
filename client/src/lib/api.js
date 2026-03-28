const API_BASE = '/api';

export async function analyseCSV(csvData) {
  const response = await fetch(`${API_BASE}/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvData }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Analysis failed' }));
    throw new Error(error.error || 'Analysis failed');
  }

  return response.json();
}

export async function submitChat(currentData, questions, answers) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentData, questions, answers }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Chat failed' }));
    throw new Error(error.error || 'Chat failed');
  }

  return response.json();
}
