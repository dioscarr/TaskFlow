import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from '@/components/ClientProviders';
import { ensureAgentWorkerAvailable } from '@/lib/agentWorkerBootstrap';

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Premium Email Task Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  void ensureAgentWorkerAvailable();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
        suppressHydrationWarning
      >
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
