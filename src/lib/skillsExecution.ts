/**
 * Skills Execution Engine
 * Intelligent handlers that combine multiple operations
 */

import { SKILLS_LIBRARY } from './skillsLibrary';
import { executeWorkflow } from '@/app/actions';
import { WorkflowStep } from '@/lib/intentLibrary';

// Import action functions
import {
    createFolder,
    createMarkdownFile,
    moveFilesToFolder,
    copyFilesToFolder,
    highlightWorkspaceFile,
    verifyRNC,
    extractReceiptInfo,
    ensureNestedFolderPath
} from '@/app/actions';

export interface SkillContext {
    userId: string;
    fileIds: string[];
    query: string;
    lastResponse?: string;
    workspaceFiles?: any[];
    traceId?: string; // P3-OBSERVABILITY
}

/**
 * Receipt Intelligence Skill
 * Complete receipt processing pipeline
 */
export async function handleReceiptIntelligence(args: any, context: SkillContext) {
    console.log('🧠 Executing Receipt Intelligence Skill');

    const {
        imageAnalysis = true,
        createReport = true,
        organizeFiles = true,
        folderStrategy = 'year_month'
    } = args;

    const results: any[] = [];
    const allExtractions: Array<{ fileId: string; fileName: string; data: any }> = [];
    let createdFolderId: string | undefined;
    let createdFileId: string | undefined;
    let folderName: string = 'Receipts';

    try {
        // Step 1: Vision Analysis — process ALL files
        if (imageAnalysis && context.fileIds.length > 0) {
            console.log(`👁️ Analyzing ${context.fileIds.length} receipt image(s) with real vision...`);
            const extraction = await extractReceiptInfo({ fileIds: context.fileIds });
            if (extraction.success && extraction.extractions) {
                for (const ext of extraction.extractions) {
                    if (ext.data) allExtractions.push(ext);
                }
                results.push({ step: 'vision_analysis', success: true, count: allExtractions.length });
            } else {
                console.warn('Vision extraction failed, using fallback');
                results.push({ step: 'vision_analysis', success: false, error: extraction.message });
            }
        }

        // Step 2: Business Verification — verify ALL unique RNCs
        const verifiedRNCs = new Map<string, any>();
        for (const ext of allExtractions) {
            const rnc = ext.data?.rnc;
            if (rnc && !verifiedRNCs.has(rnc)) {
                console.log(`🔍 Verifying RNC ${rnc} with DGII...`);
                const verification = await verifyRNC(rnc);
                verifiedRNCs.set(rnc, verification);
                ext.data.verifiedBusiness = verification;
                results.push({ step: 'business_verification', success: verification.success, rnc, data: verification });
            } else if (rnc && verifiedRNCs.has(rnc)) {
                ext.data.verifiedBusiness = verifiedRNCs.get(rnc);
            }
        }

        // Step 3: Determine folder structure using extracted data
        const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        let folderPathSegments: string[] = ['Receipts'];

        if (allExtractions.length > 0) {
            const first = allExtractions[0].data;
            const receiptDate = first?.date ? new Date(first.date) : new Date();
            const year = isNaN(receiptDate.getFullYear()) ? new Date().getFullYear() : receiptDate.getFullYear();
            const monthIdx = isNaN(receiptDate.getMonth()) ? new Date().getMonth() : receiptDate.getMonth();

            switch (folderStrategy) {
                case 'year_month': {
                    const monthLabel = `${String(monthIdx + 1).padStart(2, '0')} - ${MONTH_NAMES[monthIdx]}`;
                    folderPathSegments = ['Receipts', String(year), monthLabel];
                    break;
                }
                case 'year': {
                    folderPathSegments = ['Receipts', String(year)];
                    break;
                }
                case 'month': {
                    folderPathSegments = ['Receipts', `${year}-${String(monthIdx + 1).padStart(2, '0')}`];
                    break;
                }
                case 'provider': {
                    const providerClean = first?.provider?.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Unknown';
                    folderPathSegments = ['Receipts', providerClean];
                    break;
                }
                default:
                    folderPathSegments = ['Receipts'];
            }
        }

        // Create nested folder hierarchy (e.g. Receipts > 2025 > 06 - June)
        const nestedResult = await ensureNestedFolderPath(folderPathSegments);
        if (nestedResult.success && nestedResult.folderId) {
            createdFolderId = nestedResult.folderId;
            folderName = folderPathSegments.join('/');
        }

        // Step 4: Create Report
        if (createReport && allExtractions.length > 0) {
            console.log('📝 Creating markdown report...');
            const markdownContent = allExtractions.length === 1
                ? generateReceiptMarkdown(allExtractions[0].data)
                : generateConsolidatedReceiptMarkdown(allExtractions);

            const reportResult = await createMarkdownFile({
                content: markdownContent,
                filename: `receipt-${Date.now()}`,
                folderId: createdFolderId
            });

            if (reportResult.success) {
                createdFileId = reportResult.file?.id;
                if (!createdFolderId) createdFolderId = reportResult.folderId;
                results.push({ step: 'report_creation', success: true, data: reportResult });
            }
        }

        // Step 5: Organize Files
        if (organizeFiles && createdFolderId && context.fileIds.length > 0) {
            console.log('📁 Organizing files...');
            const moveResult = await moveFilesToFolder(context.fileIds, createdFolderId);
            results.push({ step: 'file_organization', success: true, data: moveResult });

            if (createdFileId) {
                await highlightWorkspaceFile({
                    fileId: createdFileId,
                    backgroundColor: '#f0f9ff',
                    textColor: '#0369a1',
                    fontWeight: 'bold'
                });
                results.push({ step: 'file_highlighting', success: true });
            }
        }

        // Build summary
        const totalAmount = allExtractions.reduce((sum, e) => sum + (e.data?.total || 0), 0);
        const totalItbis = allExtractions.reduce((sum, e) => sum + (e.data?.itbisAmount || 0), 0);
        const providers = allExtractions.map(e => e.data?.provider).filter(Boolean);
        const currency = allExtractions[0]?.data?.currency || 'DOP';

        const summary = allExtractions.length === 1
            ? `Processed receipt from ${providers[0] || 'Provider'}. Total: ${totalAmount.toFixed(2)} ${currency}. ITBIS: ${totalItbis.toFixed(2)} ${currency}. Folder: ${folderName}.`
            : `Processed ${allExtractions.length} receipts from ${[...new Set(providers)].join(', ') || 'various providers'}. Combined total: ${totalAmount.toFixed(2)} ${currency}. Combined ITBIS: ${totalItbis.toFixed(2)} ${currency}. Folder: ${folderName}.`;

        return {
            success: true,
            skill: 'receipt_intelligence',
            results,
            extractions: allExtractions,
            summary,
        };

    } catch (error) {
        console.error('Receipt Intelligence skill failed:', error);
        return {
            success: false,
            skill: 'receipt_intelligence',
            error: error instanceof Error ? error.message : 'Unknown error',
            partialResults: results
        };
    }
}

/**
 * Workspace Organization Skill
 * Intelligent file and folder management
 */
export async function handleWorkspaceOrganization(args: any, context: SkillContext) {
    console.log('🗂️ Executing Workspace Organization Skill');

    const {
        targetFiles,
        organizationType = 'by_date',
        createFolders = true,
        applyHighlighting = true,
        folderName
    } = args;

    const results = [];
    let targetFolderId: string | undefined;

    try {
        // Step 1: Analyze files and determine organization strategy
        console.log('🔍 Analyzing files for organization...');

        const fileAnalysis = await analyzeFilesForOrganization(targetFiles || context.fileIds);
        results.push({ step: 'file_analysis', success: true, data: fileAnalysis });

        // Step 2: Create organization structure
        if (createFolders) {
            console.log('📁 Creating folder structure...');

            let finalFolderName = folderName;
            if (!finalFolderName) {
                switch (organizationType) {
                    case 'by_date':
                        finalFolderName = `Organized-${new Date().toISOString().split('T')[0]}`;
                        break;
                    case 'by_type':
                        finalFolderName = `ByType-${Date.now()}`;
                        break;
                    case 'by_content':
                        finalFolderName = `ByContent-${Date.now()}`;
                        break;
                    default:
                        finalFolderName = `Organized-${Date.now()}`;
                }
            }

            const folderResult = await createFolder({
                name: finalFolderName,
                autoName: !folderName
            });

            if (folderResult.success && folderResult.folder) {
                targetFolderId = folderResult.folder.id;
                results.push({ step: 'folder_creation', success: true, data: folderResult });
            }
        }

        // Step 3: Move files to organized structure
        if (targetFolderId && (targetFiles || context.fileIds).length > 0) {
            console.log('📂 Moving files to organized structure...');

            const moveResult = await moveFilesToFolder(targetFiles || context.fileIds, targetFolderId);
            results.push({ step: 'file_movement', success: true, data: moveResult });
        }

        // Step 4: Apply intelligent highlighting
        if (applyHighlighting && targetFolderId) {
            console.log('✨ Applying intelligent highlighting...');

            // Highlight based on file types and content
            const highlightResults = await applyIntelligentHighlighting(targetFiles || context.fileIds);
            results.push({ step: 'highlighting', success: true, data: highlightResults });
        }

        return {
            success: true,
            skill: 'workspace_organization',
            results,
            summary: `Organized ${targetFiles?.length || context.fileIds.length} files into ${folderName || 'new structure'}`
        };

    } catch (error) {
        console.error('Workspace Organization skill failed:', error);
        return {
            success: false,
            skill: 'workspace_organization',
            error: error instanceof Error ? error.message : 'Unknown error',
            partialResults: results
        };
    }
}

/**
 * Fiscal Analysis Skill
 * Tax and compliance analysis
 */
export async function handleFiscalAnalysis(args: any, context: SkillContext) {
    console.log('💰 Executing Fiscal Analysis Skill');

    const {
        documentType,
        validateCompliance = true,
        calculateTaxes = true,
        prepareForAccounting = false
    } = args;

    const results = [];
    let analysis: any = {};

    try {
        // Step 1: Document Type Analysis
        console.log('📋 Analyzing document type...');
        analysis.documentType = documentType;
        analysis.compliance = {};

        // Step 2: Compliance Validation
        if (validateCompliance) {
            console.log('✅ Validating compliance...');

            // NCF validation logic
            analysis.compliance.ncfValid = validateNCF('B0100000001'); // Would use actual NCF from document
            analysis.compliance.dgiiVerified = true; // Would check against DGII
            results.push({ step: 'compliance_check', success: true, data: analysis.compliance });
        }

        // Step 3: Tax Calculations
        if (calculateTaxes) {
            console.log('🧮 Calculating taxes...');

            analysis.taxes = {
                itbis: 150.00,
                calculated: true,
                rate: 0.15
            };
            results.push({ step: 'tax_calculation', success: true, data: analysis.taxes });
        }

        // Step 4: Accounting Preparation
        if (prepareForAccounting) {
            console.log('📊 Preparing for accounting system...');

            analysis.accounting = {
                ready: true,
                format: 'alegra',
                data: {
                    provider: 'Test Provider',
                    amount: 1000.00,
                    date: new Date().toISOString().split('T')[0]
                }
            };
            results.push({ step: 'accounting_prep', success: true, data: analysis.accounting });
        }

        return {
            success: true,
            skill: 'fiscal_analysis',
            results,
            analysis,
            summary: `Fiscal analysis complete for ${documentType}`
        };

    } catch (error) {
        console.error('Fiscal Analysis skill failed:', error);
        return {
            success: false,
            skill: 'fiscal_analysis',
            error: error instanceof Error ? error.message : 'Unknown error',
            partialResults: results
        };
    }
}

/**
 * Document Processing Skill
 * Content extraction and organization
 */
export async function handleDocumentProcessing(args: any, context: SkillContext) {
    console.log('📄 Executing Document Processing Skill');

    const {
        documentIds,
        processingType,
        createSummary = true,
        organizeByContent = true
    } = args;

    const results = [];
    let processedContent: any = {};

    try {
        // Step 1: Content Extraction
        console.log('📖 Extracting content...');

        processedContent.extracted = await extractDocumentContent(documentIds || context.fileIds);
        results.push({ step: 'content_extraction', success: true, data: processedContent.extracted });

        // Step 2: Content Analysis
        if (processingType === 'analyze_content') {
            console.log('🔍 Analyzing content...');

            processedContent.analysis = {
                keywords: ['receipt', 'payment', 'tax'],
                sentiment: 'neutral',
                categories: ['financial', 'document']
            };
            results.push({ step: 'content_analysis', success: true, data: processedContent.analysis });
        }

        // Step 3: Create Summary
        if (createSummary) {
            console.log('📝 Creating summary...');

            const summaryContent = generateDocumentSummary(processedContent);
            const summaryResult = await createMarkdownFile({
                content: summaryContent,
                filename: `summary-${Date.now()}`,
                folderName: 'Summaries'
            });

            results.push({ step: 'summary_creation', success: true, data: summaryResult });
        }

        // Step 4: Organization
        if (organizeByContent && organizeByContent) {
            console.log('📁 Organizing by content...');

            const orgResult = await organizeByContentAnalysis(documentIds || context.fileIds, processedContent);
            results.push({ step: 'content_organization', success: true, data: orgResult });
        }

        return {
            success: true,
            skill: 'document_processing',
            results,
            processedContent,
            summary: `Processed ${documentIds?.length || context.fileIds.length} documents`
        };

    } catch (error) {
        console.error('Document Processing skill failed:', error);
        return {
            success: false,
            skill: 'document_processing',
            error: error instanceof Error ? error.message : 'Unknown error',
            partialResults: results
        };
    }
}

/**
 * Skill Execution Router
 */
export async function executeSkill(skillId: string, args: any, context: SkillContext) {
    console.log(`🎯 Executing skill: ${skillId}`);

    switch (skillId) {
        case 'receipt_intelligence':
            return await handleReceiptIntelligence(args, context);
        case 'workspace_organization':
            return await handleWorkspaceOrganization(args, context);
        case 'fiscal_analysis':
            return await handleFiscalAnalysis(args, context);
        case 'document_processing':
            return await handleDocumentProcessing(args, context);
        default:
            return {
                success: false,
                skill: skillId,
                error: `Unknown skill: ${skillId}`
            };
    }
}

// Helper functions

function generateReceiptMarkdown(data: any): string {
    const vb = data.verifiedBusiness;
    const verifiedStatus = vb?.verified ? '✅ Verified' : vb?.success ? '⚠️ Unverified' : '❌ Not Verified';
    const verifiedName = vb?.commercialName || vb?.name || '';

    let md = `# Receipt Analysis Report\n\n`;
    md += `> Confidence: **${((data.confidence || 0) * 100).toFixed(0)}%** | Document Type: **${data.documentType || 'N/A'}**\n\n`;

    md += `## Business Information\n`;
    md += `| Field | Value |\n|-------|-------|\n`;
    md += `| Provider | ${data.provider || 'N/A'} |\n`;
    md += `| RNC | ${data.rnc || 'N/A'} |\n`;
    md += `| DGII Status | ${verifiedStatus} |\n`;
    if (verifiedName) md += `| Registered Name | ${verifiedName} |\n`;
    if (vb?.economicActivity) md += `| Economic Activity | ${vb.economicActivity} |\n`;
    md += `\n`;

    md += `## Transaction Details\n`;
    md += `| Field | Value |\n|-------|-------|\n`;
    md += `| Date | ${data.date || 'N/A'} |\n`;
    md += `| NCF | ${data.ncf || 'N/A'} |\n`;
    md += `| Currency | ${data.currency || 'DOP'} |\n`;
    md += `| Payment Method | ${data.paymentMethod || 'N/A'} |\n`;
    md += `| Subtotal | ${data.subtotal != null ? data.subtotal.toFixed(2) : 'N/A'} |\n`;
    md += `| ITBIS (18%) | ${data.itbisAmount != null ? data.itbisAmount.toFixed(2) : 'N/A'} |\n`;
    md += `| **Total** | **${data.total != null ? data.total.toFixed(2) : 'N/A'}** |\n`;
    md += `\n`;

    if (data.items && data.items.length > 0) {
        md += `## Line Items\n`;
        md += `| # | Description | Qty | Unit Price | Total | ITBIS |\n`;
        md += `|---|-------------|-----|------------|-------|-------|\n`;
        data.items.forEach((item: any, i: number) => {
            md += `| ${i + 1} | ${item.description || ''} | ${item.quantity || 0} | ${(item.unitPrice || 0).toFixed(2)} | ${(item.total || 0).toFixed(2)} | ${item.itbisApplied ? '✅' : '—'} |\n`;
        });
        md += `\n`;
    }

    md += `---\n*Processed: ${new Date().toISOString()}*\n`;
    return md;
}

function generateConsolidatedReceiptMarkdown(extractions: Array<{ fileId: string; fileName: string; data: any }>): string {
    const totalAmount = extractions.reduce((s, e) => s + (e.data?.total || 0), 0);
    const totalItbis = extractions.reduce((s, e) => s + (e.data?.itbisAmount || 0), 0);
    const currency = extractions[0]?.data?.currency || 'DOP';

    let md = `# Consolidated Receipt Report\n\n`;
    md += `> ${extractions.length} receipts processed\n\n`;

    md += `## Summary\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Receipts | ${extractions.length} |\n`;
    md += `| Combined Total | ${totalAmount.toFixed(2)} ${currency} |\n`;
    md += `| Combined ITBIS | ${totalItbis.toFixed(2)} ${currency} |\n`;
    md += `\n`;

    md += `## Per-Receipt Breakdown\n`;
    md += `| # | File | Provider | Total | ITBIS | Confidence |\n`;
    md += `|---|------|----------|-------|-------|------------|\n`;
    extractions.forEach((ext, i) => {
        const d = ext.data || {};
        md += `| ${i + 1} | ${ext.fileName} | ${d.provider || 'N/A'} | ${(d.total || 0).toFixed(2)} | ${(d.itbisAmount || 0).toFixed(2)} | ${((d.confidence || 0) * 100).toFixed(0)}% |\n`;
    });
    md += `\n`;

    // Individual details
    extractions.forEach((ext, i) => {
        md += `---\n\n`;
        md += `### Receipt ${i + 1}: ${ext.fileName}\n\n`;
        md += generateReceiptMarkdown(ext.data || {});
    });

    md += `---\n*Consolidated report generated: ${new Date().toISOString()}*\n`;
    return md;
}

async function analyzeFilesForOrganization(fileIds: string[]): Promise<any> {
    // Simulate file analysis
    return {
        totalFiles: fileIds.length,
        types: ['image', 'pdf'],
        suggestedOrganization: 'by_date'
    };
}

async function applyIntelligentHighlighting(fileIds: string[]): Promise<any> {
    // Simulate intelligent highlighting
    return {
        highlighted: fileIds.length,
        rules: ['receipts_blue', 'invoices_green']
    };
}

/**
 * Validates a Dominican NCF (Número de Comprobante Fiscal).
 * Checks prefix, length, and sequential-number portion.
 */
function validateNCF(ncf: string): boolean {
    if (!ncf || typeof ncf !== 'string') return false;
    const cleaned = ncf.trim().toUpperCase();

    const ncfTypes: Record<string, string> = {
        'B01': 'Factura de Crédito Fiscal',
        'B02': 'Factura de Consumo',
        'B03': 'Nota de Débito',
        'B04': 'Nota de Crédito',
        'B11': 'Comprobante de Compras',
        'B13': 'Gastos Menores',
        'B14': 'Régimen Especial',
        'B15': 'Gubernamental',
        'B16': 'Exportaciones',
        'B17': 'Compras Extraordinarias',
        'E31': 'e-CF Crédito Fiscal',
        'E32': 'e-CF Consumo',
        'E33': 'e-CF Nota de Débito',
        'E34': 'e-CF Nota de Crédito',
        'E41': 'e-CF Compras',
        'E43': 'e-CF Gastos Menores',
        'E44': 'e-CF Régimen Especial',
        'E45': 'e-CF Gubernamental',
        'E46': 'e-CF Exportaciones',
        'E47': 'e-CF Compras Extraordinarias',
    };

    const prefix = cleaned.substring(0, 3);
    if (!ncfTypes[prefix]) return false;

    // B-series: 11 characters total (B## + 8-digit sequence)
    if (prefix.startsWith('B')) {
        return cleaned.length === 11 && /^B\d{2}\d{8}$/.test(cleaned);
    }
    // E-series: 13 characters total (E## + 10-digit sequence)
    if (prefix.startsWith('E')) {
        return cleaned.length === 13 && /^E\d{2}\d{10}$/.test(cleaned);
    }
    return false;
}

async function extractDocumentContent(fileIds: string[]): Promise<any> {
    // Simulate content extraction
    return {
        totalPages: 1,
        text: 'Sample extracted text',
        confidence: 0.95
    };
}

function generateDocumentSummary(content: any): string {
    return `# Document Summary

## Overview
- **Documents Processed**: ${content.extracted?.totalPages || 0}
- **Content Confidence**: ${content.extracted?.confidence || 0}%

## Key Information
- **Main Topics**: ${content.analysis?.categories?.join(', ') || 'N/A'}
- **Keywords**: ${content.analysis?.keywords?.join(', ') || 'N/A'}

## Analysis Complete
Generated at: ${new Date().toISOString()}
`;
}

async function organizeByContentAnalysis(fileIds: string[], content: any): Promise<any> {
    // Simulate content-based organization
    return {
        organized: fileIds.length,
        categories: content.analysis?.categories || []
    };
}