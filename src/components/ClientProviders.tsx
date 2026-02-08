'use client';

import React from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeToaster() {
    const { theme } = useTheme();
    return (
        <Toaster
            position="top-right"
            richColors
            closeButton
            theme={theme}
        />
    );
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <ThemeToaster />
            {children}
        </ThemeProvider>
    );
}
