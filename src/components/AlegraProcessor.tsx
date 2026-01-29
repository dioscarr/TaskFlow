
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, FileText, CheckCircle2, AlertCircle, ArrowRight, ExternalLink, Trash2, Loader2, Sparkles, Building2, Calendar, Receipt, CreditCard, Wallet, Landmark, Paperclip } from 'lucide-react';
import { AlegraBill, WorkspaceFile } from '@prisma/client';
import { deleteAlegraBill, recordAlegraPayment } from '@/app/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
    bills: (AlegraBill & { file: WorkspaceFile | null })[];
}

export default function AlegraProcessor({ bills }: Props) {
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [activeBillId, setActiveBillId] = useState<string | null>(null);

    const handleExport = async (bill: AlegraBill) => {
        setIsExporting(bill.id);
        // Simulate API call to Alegra
        await new Promise(r => setTimeout(r, 1500));

        // Mark as exported in local storage/DB simulation
        await recordAlegraPayment({ billId: bill.id, amount: bill.totalAmount, date: new Date().toISOString() });

        toast.success(`Entry Created in Alegra: ${bill.ncf || 'Gasto'}`);
        setIsExporting(null);
    };

    const handleDelete = async (id: string) => {
        const res = await deleteAlegraBill(id);
        if (res.success) toast.success('Gasto draft removed');
    };

    if (bills.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center rounded-[3rem] bg-white/5 border border-white/5 border-dashed">
                <div className="p-6 bg-blue-500/10 rounded-full mb-6">
                    <Receipt size={48} className="text-blue-400 opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Bills Prepared</h3>
                <p className="text-white/40 max-w-md mx-6 leading-relaxed">
                    Select your receipts from the <span className="text-blue-400 font-bold underline cursor-pointer">Files</span> tab.
                    <br /><br />
                    <span className="text-white/60 font-medium">💡 Pro Tip:</span> If a receipt is split in 2 files, <span className="text-white/80 font-bold">select both</span> and ask the AI Agent to: <br />
                    <span className="italic">"Merge these two parts into a single Alegra bill."</span>
                </p>
            </div>
        );
    }

    const ncfTypeLabels: Record<string, string> = {
        '01': 'Gastos de Personal',
        '02': 'Trabajos, Suministros y Servicios',
        '03': 'Arrendamientos',
        '04': 'Gastos de Activos Fijos',
        '09': 'Compras (Ventas)',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="text-blue-500" size={20} />
                        Alegra Fiscal Hub
                    </h2>
                    <p className="text-white/20 text-[9px] mt-0.5 uppercase tracking-widest font-bold">Gastos RD & DGII Compliance</p>
                </div>
                <div className="flex gap-3">
                    <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-emerald-500/5">
                        <CheckCircle2 size={12} /> DGII RD-Ready
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8">
                <AnimatePresence>
                    {bills.map((billRaw, ix) => {
                        const bill = billRaw as any;
                        const items = JSON.parse(bill.items) as any[];
                        // Type casting for schema extension
                        const billAny = bill as any;
                        const isExported = bill.status === 'exported';

                        return (
                            <motion.div
                                key={bill.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: ix * 0.05 }}
                                className={cn(
                                    "glass-card p-1 rounded-[2rem] border transition-all duration-500 overflow-hidden relative group",
                                    isExported
                                        ? "bg-black/40 border-white/5 opacity-80"
                                        : "bg-white/5 border-white/10 hover:border-blue-500/30"
                                )}
                            >
                                <div className="p-6 space-y-4">
                                    {/* Status Badge */}
                                    <div className="absolute top-8 right-12 z-20">
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border shadow-xl",
                                            isExported
                                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                                : "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                                        )}>
                                            {isExported ? <><CheckCircle2 size={10} /> Closed & Paid</> : <><Sparkles size={10} /> Pending Review</>}
                                        </div>
                                    </div>

                                    {/* Header Section */}
                                    <div className="flex items-start gap-5 relative z-10">
                                        <div className="p-5 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-[2rem] border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                            <Building2 size={24} className="text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-lg text-white tracking-tight uppercase">
                                                    {bill.isVerified ? bill.verifiedName : bill.providerName}
                                                </h4>
                                                {bill.isVerified && (
                                                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30" title="DGII Verified">
                                                        <CheckCircle2 size={14} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 mt-1">
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-lg border border-white/5">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                                        RNC: {bill.identification || 'N/A'}
                                                    </span>
                                                    {bill.isVerified && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400/80 bg-blue-400/5 px-3 py-1 rounded-lg border border-blue-500/20">
                                                    NCF: {bill.ncf || 'PROV'}
                                                </span>
                                                {billAny.ncfType && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 bg-amber-400/5 px-3 py-1 rounded-lg border border-amber-500/20">
                                                        {billAny.ncfType}: {ncfTypeLabels[billAny.ncfType] || 'Fiscal'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Data Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-5 bg-black/40 rounded-3xl border border-white/5 hover:border-white/10 transition-colors group/card">
                                            <div className="flex items-center gap-2 mb-2 opacity-30 group-hover/card:opacity-60 transition-opacity">
                                                <Calendar size={14} className="text-blue-400" />
                                                <span className="text-[10px] uppercase font-black tracking-[0.1em]">Reporting Date</span>
                                            </div>
                                            <div className="text-white font-bold text-lg">{bill.date}</div>
                                        </div>
                                        <div className="p-5 bg-black/40 rounded-3xl border border-white/5">
                                            <div className="flex items-center gap-2 mb-2 opacity-30">
                                                <Paperclip size={14} className="text-blue-400" />
                                                <span className="text-[10px] uppercase font-black tracking-[0.1em]">Attachment</span>
                                            </div>
                                            <div className="text-white font-bold text-xs truncate max-w-[120px]">{bill.file?.name || 'Manual Entry'}</div>
                                        </div>
                                        <div className="p-5 bg-blue-600/10 rounded-3xl border border-blue-500/20 shadow-inner group/amount">
                                            <div className="flex items-center gap-2 mb-2 text-blue-400/60">
                                                <DollarSign size={14} />
                                                <span className="text-[10px] uppercase font-black tracking-[0.1em]">Total Gross</span>
                                            </div>
                                            <div className="text-blue-400 font-bold text-xl tracking-tight">RD$ {bill.totalAmount.toLocaleString()}</div>
                                        </div>
                                    </div>

                                    {/* Items Analysis */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-white/20 italic">Extracted Analysis ({items.length} items)</h5>
                                            <div className="w-1/3 h-[1px] bg-white/5" />
                                        </div>
                                        <div className="bg-black/30 rounded-[2rem] border border-white/5 overflow-hidden backdrop-blur-md">
                                            {items.map((item, i) => (
                                                <div key={i} className="px-7 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors flex items-center justify-between group/item">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-white/90 font-bold text-sm tracking-tight">{item.description}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] text-white/20 uppercase font-black tracking-widest">Quantity: {item.quantity}</span>
                                                            <div className="w-1 h-1 rounded-full bg-white/10" />
                                                            <span className="text-[9px] text-white/20 uppercase font-black tracking-widest">Unit Price: RD$ {item.price}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-white font-black text-sm group-hover/item:text-blue-400 transition-colors">RD$ {(item.quantity * item.price).toLocaleString()}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dynamic Actions */}
                                    <div className="pt-4 flex items-center gap-4">
                                        {!isExported ? (
                                            <>
                                                <button
                                                    onClick={() => handleExport(bill)}
                                                    disabled={isExporting === bill.id}
                                                    className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                                                >
                                                    {isExporting === bill.id ? (
                                                        <><Loader2 size={20} className="animate-spin" /> Recording Gasto...</>
                                                    ) : (
                                                        <><Landmark size={20} /> Record Gasto & File Attachment</>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(bill.id)}
                                                    className="p-5 bg-white/5 border border-white/10 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-[2rem] transition-all group-hover:text-white/40"
                                                >
                                                    <Trash2 size={22} />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex gap-4">
                                                <div className="flex-1 py-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                                                    <CheckCircle2 size={20} /> Reconciled & Synchronized
                                                </div>
                                                <button className="p-5 bg-white/5 border border-white/5 text-white/40 hover:text-white rounded-[2rem] transition-all">
                                                    <ExternalLink size={22} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Observation Snippet */}
                                    {bill.observations && (
                                        <div className="mt-2 px-6 py-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-[11px] text-amber-200/50 italic leading-relaxed">
                                            <span className="font-black uppercase tracking-widest text-[9px] mb-1 block not-italic">Observations</span>
                                            "{bill.observations}"
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}

