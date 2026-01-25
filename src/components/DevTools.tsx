'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Send, X, Sparkles } from 'lucide-react';
import { simulateIncomingEmail } from '@/app/actions';
import { toast } from 'sonner';

export default function DevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [emailData, setEmailData] = useState({
        from: 'client@example.com',
        subject: 'Urgent: Invoice pending for Q1 Design Work',
        body: 'Hi there,\n\nJust checking in on the invoice #1023 for the design work we completed last week. Please let me know if you need anything else.\n\nThanks,\nSarah'
    });

    const handleSimulate = async () => {
        setIsLoading(true);
        const loadingToast = toast.loading('Receiving email...');

        try {
            const result = await simulateIncomingEmail(emailData);
            if (result.success) {
                toast.success('New task created from email!', { id: loadingToast });
                setIsOpen(false);
            } else {
                toast.error('Failed to simulate', { id: loadingToast });
            }
        } catch (e) {
            toast.error('Error simulating email', { id: loadingToast });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed top-24 right-8 z-[9999]">
            <AnimatePresence>
                {isOpen ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-4 w-80 glass"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Terminal size={14} className="text-purple-400" />
                                Email Simulator
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <input
                                value={emailData.from}
                                onChange={e => setEmailData({ ...emailData, from: e.target.value })}
                                placeholder="From"
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                            />
                            <input
                                value={emailData.subject}
                                onChange={e => setEmailData({ ...emailData, subject: e.target.value })}
                                placeholder="Subject"
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white font-medium"
                            />
                            <textarea
                                value={emailData.body}
                                onChange={e => setEmailData({ ...emailData, body: e.target.value })}
                                placeholder="Body"
                                rows={4}
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white resize-none"
                            />

                            <button
                                onClick={handleSimulate}
                                disabled={isLoading}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
                            >
                                {isLoading ? <Sparkles size={12} className="animate-spin" /> : <Send size={12} />}
                                Simulate Incoming Email
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setIsOpen(true)}
                        className="bg-zinc-900 border border-white/10 text-purple-400 p-3 rounded-full shadow-xl"
                    >
                        <Terminal size={20} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
