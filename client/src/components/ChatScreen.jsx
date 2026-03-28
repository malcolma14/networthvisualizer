import { useState } from 'react';
import { submitChat } from '../lib/api';

export default function ChatScreen({ data, onComplete, onSkipAll }) {
  const questions = data.clarifyingQuestions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(Array(questions.length).fill(''));
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isLastQuestion = currentIndex >= questions.length - 1;
  const allDone = currentIndex >= questions.length;

  function handleAnswer() {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = inputValue.trim();
    setAnswers(newAnswers);
    setInputValue('');
    setCurrentIndex((prev) => prev + 1);
  }

  function handleSkip() {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = '';
    setAnswers(newAnswers);
    setInputValue('');
    setCurrentIndex((prev) => prev + 1);
  }

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitChat(data, questions, answers);
      onComplete(result.data);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
      e.preventDefault();
      handleAnswer();
    }
  }

  if (questions.length === 0) {
    onSkipAll();
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-ig-pale">
      <div className="w-full max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ig-dark mb-1">A few quick questions</h1>
          <p className="text-ig-grey text-sm">
            Help us refine the analysis with a bit more context.
          </p>
        </div>

        {/* Chat area */}
        <div className="bg-white rounded-xl shadow-sm border border-ig-grey/10 overflow-hidden">
          {/* Previous Q&A */}
          <div className="max-h-64 overflow-y-auto">
            {questions.slice(0, currentIndex).map((q, i) => (
              <div key={q.id || i} className="px-6 py-4 border-b border-ig-pale">
                <p className="text-sm text-ig-grey mb-1">Question {i + 1}</p>
                <p className="text-ig-dark text-sm font-medium mb-2">{q.question}</p>
                <p className="text-sm text-ig-mid">
                  {answers[i] || <span className="italic text-ig-grey">Skipped</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Current question */}
          {!allDone && (
            <div className="px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-ig-mid uppercase tracking-wide">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < currentIndex
                          ? 'bg-ig-green'
                          : i === currentIndex
                          ? 'bg-ig-mid'
                          : 'bg-ig-grey/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-ig-dark font-medium mb-1">
                {questions[currentIndex].question}
              </p>
              {questions[currentIndex].context && (
                <p className="text-ig-grey text-xs mb-4">
                  {questions[currentIndex].context}
                </p>
              )}

              <div className="mt-4">
                <textarea
                  className="w-full border border-ig-grey/30 rounded-lg px-4 py-3 text-sm text-ig-dark focus:outline-none focus:ring-2 focus:ring-ig-mid/30 focus:border-ig-mid resize-none"
                  rows={2}
                  placeholder="Type your answer…"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <div className="flex justify-between mt-3">
                  <button
                    onClick={handleSkip}
                    className="text-sm text-ig-grey hover:text-ig-dark transition-colors"
                  >
                    Skip / Not sure
                  </button>
                  <button
                    onClick={handleAnswer}
                    disabled={!inputValue.trim()}
                    className="px-5 py-2 bg-ig-mid text-white text-sm font-semibold rounded-lg hover:bg-ig-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLastQuestion ? 'Submit' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* All done — generate */}
          {allDone && (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-ig-green/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-ig-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-ig-dark font-semibold mb-1">All questions answered</p>
              <p className="text-ig-grey text-sm mb-6">
                Ready to generate the dashboard.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-ig-red/20 rounded-lg text-ig-red text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={submitting}
                className="px-8 py-3 bg-ig-dark text-white font-semibold rounded-lg hover:bg-ig-mid transition-colors disabled:opacity-60"
              >
                {submitting ? 'Generating…' : 'Generate dashboard'}
              </button>
            </div>
          )}
        </div>

        {/* Skip all */}
        {!allDone && (
          <div className="text-center mt-4">
            <button
              onClick={onSkipAll}
              className="text-sm text-ig-grey hover:text-ig-dark transition-colors"
            >
              Skip all questions and generate dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
