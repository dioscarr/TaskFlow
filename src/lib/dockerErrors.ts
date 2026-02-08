/**
 * Actionable Error Messages
 *
 * Converts technical Docker errors into user-friendly, actionable messages
 * with specific next steps for resolution.
 *
 * Usage:
 * import { getActionableError } from '@/lib/dockerErrors';
 * const userError = getActionableError(error);
 */

export interface ActionableError {
    title: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    actions: Array<{
        label: string;
        type: 'primary' | 'secondary';
        action: 'open-docker' | 'fallback-local' | 'retry' | 'learn-more' | 'check-port' | 'restart';
        url?: string;
    }>;
    technicalDetails?: string;
    learnMoreUrl?: string;
}

export function getActionableError(error: any, context?: string): ActionableError {
    const errorMsg = (error?.message || error?.stderr || '').toString().toLowerCase();

    // Docker Daemon Not Running
    if (errorMsg.includes('pipe/docker') || errorMsg.includes('daemon') || errorMsg.includes('failed to connect')) {
        return {
            title: 'Docker Desktop is not running',
            message: 'To use containerized apps, Docker Desktop must be running on your machine.',
            severity: 'error',
            actions: [
                {
                    label: 'Open Docker Desktop',
                    type: 'primary',
                    action: 'open-docker'
                },
                {
                    label: 'Run Locally Instead',
                    type: 'secondary',
                    action: 'fallback-local'
                },
                {
                    label: 'Learn More',
                    type: 'secondary',
                    action: 'learn-more',
                    url: '/docs/docker-setup'
                }
            ],
            learnMoreUrl: '/docs/docker-setup',
            technicalDetails: error?.message
        };
    }

    // Docker Timeout
    if (error?.killed && error?.signal === 'SIGTERM') {
        return {
            title: 'Docker is taking too long to respond',
            message: 'Docker Desktop may be starting up or experiencing issues. Please wait or restart Docker.',
            severity: 'warning',
            actions: [
                {
                    label: 'Wait and Retry',
                    type: 'primary',
                    action: 'retry'
                },
                {
                    label: 'Restart Docker',
                    type: 'secondary',
                    action: 'restart'
                }
            ],
            learnMoreUrl: '/docs/docker-troubleshooting#timeout-issues',
            technicalDetails: `Command timed out after ${error.timeout || '30000'}ms`
        };
    }

    // Port Already in Use
    if (errorMsg.includes('eaddrinuse') || errorMsg.includes('port is already allocated')) {
        const portMatch = errorMsg.match(/port\s+(\d+)/i);
        const port = portMatch ? portMatch[1] : '5050';

        return {
            title: `Port ${port} is already in use`,
            message: `Another process is using port ${port}. This could be another app or a stuck container.`,
            severity: 'error',
            actions: [
                {
                    label: 'Stop Other Apps',
                    type: 'primary',
                    action: 'check-port'
                },
                {
                    label: 'Retry',
                    type: 'secondary',
                    action: 'retry'
                }
            ],
            learnMoreUrl: '/docs/docker-troubleshooting#port-conflicts',
            technicalDetails: error?.message
        };
    }

    // Build Failures
    if (errorMsg.includes('build') && (errorMsg.includes('failed') || errorMsg.includes('error'))) {
        return {
            title: 'Docker build failed',
            message: 'There was an error building your app container. This is usually due to missing dependencies or syntax errors.',
            severity: 'error',
            actions: [
                {
                    label: 'View Build Logs',
                    type: 'primary',
                    action: 'learn-more',
                    url: '#build-logs'
                },
                {
                    label: 'Run Locally',
                    type: 'secondary',
                    action: 'fallback-local'
                }
            ],
            learnMoreUrl: '/docs/docker-troubleshooting#build-failures',
            technicalDetails: error?.message
        };
    }

    // NPM Install Failures
    if (errorMsg.includes('npm') && errorMsg.includes('err')) {
        return {
            title: 'Dependency installation failed',
            message: 'NPM failed to install dependencies. Check your package.json for errors or conflicts.',
            severity: 'error',
            actions: [
                {
                    label: 'Clear Cache & Retry',
                    type: 'primary',
                    action: 'retry'
                },
                {
                    label: 'View Logs',
                    type: 'secondary',
                    action: 'learn-more',
                    url: '#npm-logs'
                }
            ],
            learnMoreUrl: '/docs/docker-troubleshooting#dependency-issues',
            technicalDetails: error?.message
        };
    }

    // Container Not Found
    if (errorMsg.includes('no such container') || errorMsg.includes('not found')) {
        return {
            title: 'Container not found',
            message: 'The Docker container may have been removed or never started successfully.',
            severity: 'warning',
            actions: [
                {
                    label: 'Rebuild Container',
                    type: 'primary',
                    action: 'retry'
                }
            ],
            technicalDetails: error?.message
        };
    }

    // Out of Memory
    if (errorMsg.includes('oom') || errorMsg.includes('out of memory')) {
        return {
            title: 'Container ran out of memory',
            message: 'Your app used more memory than allocated. Consider optimizing your code or increasing container limits.',
            severity: 'error',
            actions: [
                {
                    label: 'Restart Container',
                    type: 'primary',
                    action: 'retry'
                },
                {
                    label: 'Learn About Memory Limits',
                    type: 'secondary',
                    action: 'learn-more',
                    url: '/docs/docker-setup#resource-limits'
                }
            ],
            learnMoreUrl: '/docs/docker-setup#resource-limits',
            technicalDetails: error?.message
        };
    }

    // Generic Error
    return {
        title: context ? `Failed to ${context}` : 'An error occurred',
        message: 'An unexpected error occurred. Please check the details below and try again.',
        severity: 'error',
        actions: [
            {
                label: 'Retry',
                type: 'primary',
                action: 'retry'
            },
            {
                label: 'Get Help',
                type: 'secondary',
                action: 'learn-more',
                url: '/docs/docker-troubleshooting'
            }
        ],
        learnMoreUrl: '/docs/docker-troubleshooting',
        technicalDetails: error?.message || String(error)
    };
}

/**
 * Check if an error is Docker daemon unavailability
 */
export function isDockerDaemonError(error: any): boolean {
    const msg = (error?.stderr || error?.message || '').toString().toLowerCase();
    const isTimeout = error?.killed && error?.signal === 'SIGTERM';
    return isTimeout ||
        msg.includes('pipe/docker_engine') ||
        msg.includes('daemon') ||
        msg.includes('failed to connect to the docker api');
}

/**
 * Get user-friendly error title
 */
export function getErrorTitle(error: any): string {
    return getActionableError(error).title;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: any): string {
    return getActionableError(error).message;
}

/**
 * Format error for logging with context
 */
export function formatErrorForLog(error: any, context: string): string {
    const actionable = getActionableError(error, context);
    return `[${actionable.severity.toUpperCase()}] ${actionable.title}: ${actionable.message} (${actionable.technicalDetails || 'no details'})`;
}
