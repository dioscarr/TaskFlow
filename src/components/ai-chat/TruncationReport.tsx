/**
 * TruncationReport Component - P3-CONTEXT-BUDGET
 * 
 * Displays truncation information when files are truncated due to context budget limits
 */

import React from 'react';
import { TruncationReport as TruncationReportType } from '@/lib/contextBudget';

interface TruncationReportProps {
    report: TruncationReportType;
    onDismiss?: () => void;
}

export function TruncationReport({ report, onDismiss }: TruncationReportProps) {
    if (report.truncatedFiles.length === 0) {
        return null;
    }

    const truncatedCount = report.truncatedFiles.length;
    const totalCount = report.totalFiles;
    const retentionPercentage = 100 - report.totalTruncatedPercentage;

    return (
        <div className="truncation-report">
            <div className="truncation-header">
                <div className="truncation-icon">✂️</div>
                <div className="truncation-title">
                    <strong>Context Budget Applied</strong>
                    <span className="truncation-subtitle">
                        {truncatedCount} of {totalCount} files were truncated
                    </span>
                </div>
                {onDismiss && (
                    <button
                        className="truncation-dismiss"
                        onClick={onDismiss}
                        aria-label="Dismiss"
                    >
                        ×
                    </button>
                )}
            </div>

            <div className="truncation-stats">
                <div className="stat">
                    <span className="stat-label">Average Retention</span>
                    <span className="stat-value">{retentionPercentage}%</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Files Processed</span>
                    <span className="stat-value">{totalCount}</span>
                </div>
            </div>

            {report.recommendation && (
                <div className="truncation-recommendation">
                    <div className="recommendation-icon">💡</div>
                    <div className="recommendation-text">{report.recommendation}</div>
                </div>
            )}

            <details className="truncation-details">
                <summary>View truncation details</summary>
                <div className="truncation-list">
                    {report.results.map((result, idx) => (
                        <div
                            key={idx}
                            className={`truncation-item ${result.truncated ? 'truncated' : 'full'}`}
                        >
                            <div className="item-header">
                                <span className="item-icon">
                                    {result.truncated ? '✂️' : '✓'}
                                </span>
                                <span className="item-filename">{result.filename}</span>
                                <span className="item-percentage">
                                    {result.percentage}%
                                </span>
                            </div>
                            {result.truncated && (
                                <div className="item-details">
                                    <span className="detail-label">Strategy:</span>
                                    <span className="detail-value">{result.strategy}</span>
                                    <span className="detail-separator">•</span>
                                    <span className="detail-label">Original:</span>
                                    <span className="detail-value">
                                        {(result.originalSize / 1024).toFixed(1)} KB
                                    </span>
                                    <span className="detail-separator">•</span>
                                    <span className="detail-label">Truncated:</span>
                                    <span className="detail-value">
                                        {(result.truncatedSize / 1024).toFixed(1)} KB
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </details>

            <style jsx>{`
                .truncation-report {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 16px;
                    margin: 12px 0;
                    color: white;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .truncation-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .truncation-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }

                .truncation-title {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .truncation-title strong {
                    font-size: 16px;
                    font-weight: 600;
                }

                .truncation-subtitle {
                    font-size: 14px;
                    opacity: 0.9;
                }

                .truncation-dismiss {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 24px;
                    line-height: 1;
                    padding: 4px 10px;
                    transition: background 0.2s;
                }

                .truncation-dismiss:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .truncation-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .stat {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .stat-label {
                    font-size: 12px;
                    opacity: 0.8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                }

                .truncation-recommendation {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    padding: 12px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 12px;
                }

                .recommendation-icon {
                    font-size: 20px;
                    flex-shrink: 0;
                }

                .recommendation-text {
                    font-size: 14px;
                    line-height: 1.5;
                }

                .truncation-details {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 12px;
                }

                .truncation-details summary {
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    user-select: none;
                    list-style: none;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .truncation-details summary::-webkit-details-marker {
                    display: none;
                }

                .truncation-details summary::before {
                    content: '▶';
                    display: inline-block;
                    transition: transform 0.2s;
                }

                .truncation-details[open] summary::before {
                    transform: rotate(90deg);
                }

                .truncation-list {
                    margin-top: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .truncation-item {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    padding: 10px;
                }

                .truncation-item.truncated {
                    background: rgba(255, 255, 255, 0.15);
                }

                .item-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                }

                .item-icon {
                    flex-shrink: 0;
                }

                .item-filename {
                    flex: 1;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                }

                .item-percentage {
                    font-weight: 600;
                    font-size: 13px;
                }

                .item-details {
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                    font-size: 12px;
                    opacity: 0.9;
                }

                .detail-label {
                    font-weight: 500;
                }

                .detail-value {
                    font-family: 'Courier New', monospace;
                }

                .detail-separator {
                    opacity: 0.5;
                }

                @media (max-width: 640px) {
                    .truncation-report {
                        padding: 12px;
                    }

                    .truncation-stats {
                        grid-template-columns: 1fr;
                    }

                    .item-details {
                        font-size: 11px;
                    }
                }
            `}</style>
        </div>
    );
}

export default TruncationReport;
