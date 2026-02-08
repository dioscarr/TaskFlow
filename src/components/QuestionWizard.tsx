import React, { useState, useEffect } from 'react';

interface QuestionWizardProps {
  questions: string[];
  onSubmit: (answers: string[]) => void;
  onCancel?: () => void;
}

export default function QuestionWizard({ questions, onSubmit, onCancel }: QuestionWizardProps) {
  const [answers, setAnswers] = useState<string[]>(new Array(questions.length).fill(''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(answers);
  };

  const handleChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  if (questions.length === 0) return null;

  return (
    <div className="w-full mb-4 animate-in fade-in slide-in-from-bottom-4 duration-300 z-30 relative">
      <div className="glass-card rounded-2xl overflow-hidden flex flex-col border border-sky-500/20 shadow-xl shadow-sky-900/5">
        {/* Header */}
        <div className="px-5 py-3 border-b theme-border-subtle bg-gradient-to-r from-sky-900/20 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-sky-400 z-10 relative" />
                    <div className="absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-50" />
                </div>
                <h3 className="text-xs font-bold text-sky-200 uppercase tracking-widest">
                    Information Required
                </h3>
            </div>
            {onCancel && (
                <button onClick={onCancel} className="theme-text-quaternary hover:text-white transition-colors p-1 hover:theme-overlay-medium rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            )}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto bg-black/40">
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                The AI assistant needs additional details to complete your request. Please fill out the items below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
                {questions.map((question, idx) => (
                    <div key={idx} className="space-y-2">
                        <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">
                            {idx + 1}. {question}
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={answers[idx]}
                                onChange={(e) => handleChange(idx, e.target.value)}
                                className="w-full bg-black/40 border theme-border-medium rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:bg-white/[0.03] transition-all placeholder:text-white/10"
                                placeholder={`Answer for "${question}"...`}
                                autoFocus={idx === 0}
                                required
                            />
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-sky-500/5 to-emerald-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity" />
                        </div>
                    </div>
                ))}

                <div className="pt-2">
                    <button
                        type="submit"
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-sky-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group border-t theme-border-medium"
                    >
                        <span>Submit Answers</span>
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
}
