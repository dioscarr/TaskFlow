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

    return null;
}
