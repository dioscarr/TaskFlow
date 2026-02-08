'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ContainerStartProgressProps {
    appName: string;
    containerName: string;
    onComplete?: () => void;
}

const startupStages = [
    { icon: '🚀', label: 'Starting container', duration: 2000 },
    { icon: '📦', label: 'Loading dependencies', duration: 3000 },
    { icon: '⚡', label: 'Initializing server', duration: 2000 },
    { icon: '🌐', label: 'Binding to port 5050', duration: 1000 },
    { icon: '✅', label: 'Ready!', duration: 1000 }
];

export default function ContainerStartProgress({
    appName,
    containerName,
    onComplete
}: ContainerStartProgressProps) {
    const [currentStage, setCurrentStage] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let elapsed = 0;
        const totalDuration = startupStages.reduce((sum, stage) => sum + stage.duration, 0);

        const interval = setInterval(() => {
            elapsed += 100;
            const newProgress = Math.min((elapsed / totalDuration) * 100, 100);
            setProgress(newProgress);

            // Calculate current stage based on elapsed time
            let accumulatedDuration = 0;
            for (let i = 0; i < startupStages.length; i++) {
                accumulatedDuration += startupStages[i].duration;
                if (elapsed < accumulatedDuration) {
                    setCurrentStage(i);
                    break;
                }
            }

            if (elapsed >= totalDuration) {
                clearInterval(interval);
                setTimeout(() => onComplete?.(), 500);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [onComplete]);

    const current = startupStages[currentStage];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
            >
                {/* Animated Icon */}
                <div className="flex justify-center mb-6">
                    <motion.div
                        key={currentStage}
                        initial={{ scale: 0.5, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="text-7xl"
                    >
                        {current.icon}
                    </motion.div>
                </div>

                {/* App Name */}
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
                    Starting {appName}
                </h2>

                {/* Current Stage */}
                <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
                    {current.label}
                </p>

                {/* Progress Bar */}
                <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                    <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.1 }}
                    />
                    <motion.div
                        className="absolute inset-y-0 w-20 bg-white/30"
                        animate={{
                            x: ['-100%', '400%']
                        }}
                        transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                    />
                </div>

                {/* Progress Percentage */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(progress)}%
                </div>

                {/* Stage Dots */}
                <div className="flex justify-center gap-2 mt-6">
                    {startupStages.map((stage, index) => (
                        <motion.div
                            key={index}
                            className={`w-2 h-2 rounded-full ${
                                index <= currentStage
                                    ? 'bg-blue-500'
                                    : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            initial={{ scale: 0 }}
                            animate={{ scale: index === currentStage ? 1.5 : 1 }}
                            transition={{ duration: 0.2 }}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
