'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti, { EmojiCelebration } from './Confetti';

interface BuildProgress {
    stage: 'preparing' | 'pulling' | 'installing' | 'copying' | 'building' | 'complete' | 'success' | 'error' | 'failed';
    message: string;
    progress: number;
    step?: number;
    totalSteps?: number;
    timestamp: string;
    error?: boolean;
    raw?: boolean;
}

interface DockerBuildProgressProps {
    appName: string;
    dockerfilePath: string;
    context: string;
    imageName: string;
    onComplete?: (success: boolean) => void;
    onClose?: () => void;
}

const stageConfig = {
    preparing: {
        icon: '🔧',
        title: 'Preparing',
        color: 'from-blue-500 to-blue-600',
        description: 'Setting up build environment...'
    },
    pulling: {
        icon: '📦',
        title: 'Pulling Image',
        color: 'from-purple-500 to-purple-600',
        description: 'Downloading base image from registry...'
    },
    installing: {
        icon: '⚙️',
        title: 'Installing',
        color: 'from-yellow-500 to-yellow-600',
        description: 'Installing npm dependencies...'
    },
    copying: {
        icon: '📋',
        title: 'Copying Files',
        color: 'from-cyan-500 to-cyan-600',
        description: 'Copying source code into container...'
    },
    building: {
        icon: '🏗️',
        title: 'Building',
        color: 'from-orange-500 to-orange-600',
        description: 'Compiling and configuring app...'
    },
    complete: {
        icon: '✅',
        title: 'Complete',
        color: 'from-green-500 to-green-600',
        description: 'Build finished successfully!'
    },
    success: {
        icon: '🎉',
        title: 'Success',
        color: 'from-green-500 to-green-600',
        description: 'Container ready to run!'
    },
    error: {
        icon: '❌',
        title: 'Error',
        color: 'from-red-500 to-red-600',
        description: 'Build encountered an error'
    },
    failed: {
        icon: '💔',
        title: 'Failed',
        color: 'from-red-500 to-red-600',
        description: 'Build failed'
    }
};

export default function DockerBuildProgress({
    appName,
    dockerfilePath,
    context,
    imageName,
    onComplete,
    onClose
}: DockerBuildProgressProps) {
    const [progress, setProgress] = useState<BuildProgress>({
        stage: 'preparing',
        message: 'Initializing...',
        progress: 0,
        timestamp: new Date().toISOString()
    });
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const startTimeRef = useRef<number>(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (!startTimeRef.current) {
            startTimeRef.current = Date.now();
        }
        const timer = setInterval(() => {
            const startTime = startTimeRef.current || Date.now();
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams({
            app: appName,
            dockerfile: dockerfilePath,
            context,
            image: imageName
        });

        const eventSource = new EventSource(`/api/docker/build-stream?${params}`);

        eventSource.onmessage = (event) => {
            try {
                const data: BuildProgress = JSON.parse(event.data);
                setProgress(data);

                // Add to logs if it's a raw output
                if (data.raw && data.message) {
                    setLogs(prev => [...prev, data.message]);
                }

                // Handle completion
                if (data.stage === 'success' || data.stage === 'complete') {
                    setShowConfetti(true); // Trigger confetti!

                    // Record success metrics
                    const duration = Date.now() - (startTimeRef.current || Date.now());
                    fetch('/api/metrics/build', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            appName,
                            imageName,
                            duration,
                            success: true,
                            stage: data.stage
                        })
                    }).catch(console.error);

                    setTimeout(() => {
                        onComplete?.(true);
                    }, 2000);
                } else if (data.stage === 'failed' || (data.stage === 'error' && !data.raw)) {
                    // Record failure metrics
                    const duration = Date.now() - (startTimeRef.current || Date.now());
                    fetch('/api/metrics/build', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            appName,
                            imageName,
                            duration,
                            success: false,
                            stage: data.stage,
                            error: data.message
                        })
                    }).catch(console.error);

                    setTimeout(() => {
                        onComplete?.(false);
                    }, 3000);
                }
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [appName, dockerfilePath, context, imageName, onComplete]);

    const currentStageConfig = stageConfig[progress.stage] || stageConfig.building;
    const isError = progress.stage === 'error' || progress.stage === 'failed';
    const isSuccess = progress.stage === 'success' || progress.stage === 'complete';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                    scale: 1,
                    opacity: 1,
                    // Shake animation on error
                    x: isError ? [0, -10, 10, -10, 10, 0] : 0
                }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{
                    x: { duration: 0.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
                }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
            >
                {/* Header */}
                <div className={`bg-gradient-to-r ${currentStageConfig.color} p-6 text-white`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{
                                    rotate: isSuccess ? 0 : 360,
                                    scale: isSuccess ? [1, 1.2, 1] : 1
                                }}
                                transition={{
                                    rotate: { duration: 2, repeat: isSuccess ? 0 : Infinity, ease: "linear" },
                                    scale: { duration: 0.5 }
                                }}
                                className="text-4xl"
                            >
                                {currentStageConfig.icon}
                            </motion.div>
                            <div>
                                <h2 className="text-2xl font-bold">{currentStageConfig.title}</h2>
                                <p className="text-white/80 text-sm">{appName}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">{progress.progress}%</div>
                            <div className="text-white/80 text-sm">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</div>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 bg-gray-200 dark:bg-gray-700">
                    <motion.div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${currentStageConfig.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                    {!isSuccess && !isError && (
                        <motion.div
                            className="absolute inset-y-0 w-32 bg-white/30"
                            animate={{
                                x: ['-100%', '500%']
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        />
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Current Stage Info */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {currentStageConfig.description}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm font-mono">
                            {progress.message}
                        </p>
                        {progress.step && progress.totalSteps && (
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                Step {progress.step} of {progress.totalSteps}
                            </p>
                        )}
                    </div>

                    {/* Stage Indicators */}
                    <div className="flex justify-between items-center mb-6">
                        {['preparing', 'pulling', 'installing', 'copying', 'complete'].map((stage, index) => {
                            const stageIndex = ['preparing', 'pulling', 'installing', 'copying', 'building', 'complete'].indexOf(progress.stage);
                            const currentIndex = ['preparing', 'pulling', 'installing', 'copying', 'building', 'complete'].indexOf(stage);
                            const isActive = currentIndex <= stageIndex;
                            const isCurrent = stage === progress.stage;

                            return (
                                <div key={stage} className="flex items-center">
                                    <motion.div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                                            isActive
                                                ? 'bg-gradient-to-r ' + stageConfig[stage as keyof typeof stageConfig].color + ' text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                        }`}
                                        animate={isCurrent ? {
                                            scale: [1, 1.1, 1],
                                        } : {}}
                                        transition={{
                                            duration: 1,
                                            repeat: isCurrent ? Infinity : 0
                                        }}
                                    >
                                        {stageConfig[stage as keyof typeof stageConfig].icon}
                                    </motion.div>
                                    {index < 4 && (
                                        <div className={`h-1 w-12 ${isActive ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Build Logs Toggle */}
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
                    >
                        {showLogs ? '🔼 Hide' : '🔽 Show'} Build Logs ({logs.length})
                    </button>

                    {/* Build Logs */}
                    <AnimatePresence>
                        {showLogs && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 200, opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-y-auto"
                            >
                                {logs.map((log, index) => (
                                    <div key={index} className="whitespace-pre-wrap">
                                        {log}
                                    </div>
                                ))}
                                {logs.length === 0 && (
                                    <div className="text-gray-500">No detailed logs yet...</div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Actions */}
                {(isSuccess || isError) && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        {isSuccess && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold"
                            >
                                ✨ Container built in {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                            </motion.div>
                        )}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Close
                            </button>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Success Animations */}
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            {showConfetti && <EmojiCelebration emojis={['🎉', '✨', '🚀', '⭐', '🎊', '💫']} />}
        </div>
    );
}
