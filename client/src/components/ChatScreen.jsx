import { useState, useRef } from 'react';
import { submitChat } from '../lib/claude';

export default function ChatScreen({ data, onComplete, onSkipAll }) {
  const questions = data.clarifyingQuestions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(Array(questions.length).fill(''));
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  const isLastQuestion = currentIndex >= questions.length - 1;
  const allDone = currentIndex >= questions.length;
  const currentQuestion = questions[currentIndex];
  const isFundConfirm = currentQuestion?.type === 'fund_confirm';

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleAnswer() {
    const newAnswers = [...answers];
    const answer = inputValue.trim();

    if (attachedFile && isFundConfirm) {
      try {
        const base64 = await readFileAsBase64(attachedFile);
        newAnswers[currentIndex] = {
          text: answer,
          pdf: { base64, filename: attachedFile.name, mediaType: 'application/pdf' },
        };
      } catch {
        newAnswers[currentIndex] = answer || `[Could not read ${attachedFile.name}]`;
      }
    } else {
      newAnswers[currentIndex] = answer;
    }

    setAnswers(newAnswers);
    setInputValue('');
    setAttachedFile(null);
    setCurrentIndex((prev) => prev + 1);
  }

  function handleSkip() {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = '';
    setAnswers(newAnswers);
    setInputValue('');
    setAttachedFile(null);
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

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
  }

  if (questions.length === 0) {
    onSkipAll();
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-ig-pale">
      <div className="w-full max-w-2xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ig-dark mb-1">A few quick questions</h1>
          <p className="text-ig-grey text-sm">Help us refine the analysis with a bit more context.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-ig-grey/10 overflow-hidden">
          {/* Previous Q&A */}
          <div className="max-h-64 overflow-y-auto">
            {questions.slice(0, currentIndex).map((q, i) => (
              <div key={q.id || i} className="px-6 py-4 border-b border-ig-pale">
                <p className="text-sm text-ig-grey mb-1">Question {i + 1}</p>
                <p className="text-ig-dark text-sm font-medium mb-2">{q.question}</p>
                <p className="text-sm text-ig-mid">
                  {answers[i]
                    ? (typeof answers[i] === 'object' && answers[i].pdf
                      ? `${answers[i].text ? answers[i].text + ' ' : ''}[PDF: ${answers[i].pdf.filename}]`
                      : answers[i])
                    : <span className="italic text-ig-grey">Skipped</span>}
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
                        i < currentIndex ? 'bg-ig-green' : i === currentIndex ? 'bg-ig-mid' : 'bg-ig-grey/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-ig-dark font-medium mb-1">{currentQuestion.question}</p>
              {currentQuestion.context && (
                <p className="text-ig-grey text-xs mb-4">{currentQuestion.context}</p>
              )}

              {/* Fund confirmation helper */}
              {isFundConfirm && (
                <div className="mb-3 p-3 bg-ig-pale rounded-lg text-xs text-ig-grey">
                  <p className="font-medium text-ig-dark mb-1">You can:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Type the fund name and details below</li>
                    <li>Paste a public URL to the fund fact sheet</li>
                    <li>Attach a fund fact PDF</li>
                  </ul>
                </div>
              )}

              <div className="mt-4">
                <textarea
                  className="w-full border border-ig-grey/30 rounded-lg px-4 py-3 text-sm text-ig-dark focus:outline-none focus:ring-2 focus:ring-ig-mid/30 focus:border-ig-mid resize-none"
                  rows={isFundConfirm ? 3 : 2}
                  placeholder={isFundConfirm ? 'Type fund details or paste a URL…' : 'Type your answer…'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />

                {/* File attachment for fund confirm */}
                {isFundConfirm && (
                  <div className="mt-2">
                    {attachedFile ? (
                      <div className="flex items-center gap-2 text-xs text-ig-mid bg-ig-pale rounded-lg px-3 py-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="truncate flex-1">{attachedFile.name}</span>
                        <button onClick={() => setAttachedFile(null)} className="text-ig-grey hover:text-ig-red">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs text-ig-mid hover:text-ig-dark transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        Attach fund fact PDF
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.PDF"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                )}

                <div className="flex justify-between mt-3">
                  <button onClick={handleSkip} className="text-sm text-ig-grey hover:text-ig-dark transition-colors">
                    Skip / Not sure
                  </button>
                  <button
                    onClick={handleAnswer}
                    disabled={!inputValue.trim() && !attachedFile}
                    className="px-5 py-2 bg-ig-mid text-white text-sm font-semibold rounded-lg hover:bg-ig-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLastQuestion ? 'Submit' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* All done */}
          {allDone && (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-ig-green/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-ig-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-ig-dark font-semibold mb-1">All questions answered</p>
              <p className="text-ig-grey text-sm mb-6">Ready to generate the dashboard.</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-ig-red/20 rounded-lg text-ig-red text-sm">{error}</div>
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

        {!allDone && (
          <div className="text-center mt-4">
            <button onClick={onSkipAll} className="text-sm text-ig-grey hover:text-ig-dark transition-colors">
              Skip all questions and generate dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
