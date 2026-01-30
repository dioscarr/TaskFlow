'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CelebrationProps {
    emoji: string;
    onComplete: () => void;
}

export default function EmojiCelebration({ emoji, onComplete }: CelebrationProps) {
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; rotation: number; scale: number }>>([]);

    // Generate particles on mount
    useEffect(() => {
        const particleCount = emoji === '🎉' ? 50 : emoji === '❤️' ? 40 : 30;
        const newParticles = Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            x: Math.random() * 100 - 50, // -50 to 50
            y: Math.random() * 100 - 50,
            rotation: Math.random() * 720 - 360, // -360 to 360
            scale: Math.random() * 0.5 + 0.5 // 0.5 to 1
        }));
        setParticles(newParticles);

        // Auto-complete after animation
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, [emoji, onComplete]);

    // Get colors based on emoji
    const getColors = () => {
        switch (emoji) {
            case '👍':
                return {
                    primary: 'rgba(59, 130, 246, 0.6)', // Blue
                    secondary: 'rgba(96, 165, 250, 0.4)',
                    glow: 'rgba(59, 130, 246, 0.3)'
                };
            case '❤️':
                return {
                    primary: 'rgba(236, 72, 153, 0.6)', // Pink
                    secondary: 'rgba(244, 114, 182, 0.4)',
                    glow: 'rgba(236, 72, 153, 0.3)'
                };
            case '🎉':
                return {
                    primary: 'rgba(168, 85, 247, 0.6)', // Purple
                    secondary: 'rgba(192, 132, 252, 0.4)',
                    glow: 'rgba(168, 85, 247, 0.3)'
                };
            case '🤔':
                return {
                    primary: 'rgba(234, 179, 8, 0.6)', // Yellow
                    secondary: 'rgba(250, 204, 21, 0.4)',
                    glow: 'rgba(234, 179, 8, 0.3)'
                };
            default:
                return {
                    primary: 'rgba(59, 130, 246, 0.6)',
                    secondary: 'rgba(96, 165, 250, 0.4)',
                    glow: 'rgba(59, 130, 246, 0.3)'
                };
        }
    };

    const colors = getColors();

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {/* Central Emoji Burst */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                    scale: [0, 1.5, 1],
                    opacity: [0, 1, 0]
                }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
                <div className="text-[120px] drop-shadow-2xl">
                    {emoji}
                </div>
            </motion.div>

            {/* Radial Glow Pulse */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                    scale: [0, 3, 4],
                    opacity: [0, 0.6, 0]
                }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
                style={{
                    background: `radial-gradient(circle, ${colors.primary} 0%, ${colors.secondary} 30%, transparent 70%)`
                }}
            />

            {/* Particle Explosion */}
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    initial={{
                        x: '50vw',
                        y: '50vh',
                        scale: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: `calc(50vw + ${particle.x}vw)`,
                        y: `calc(50vh + ${particle.y}vh)`,
                        scale: particle.scale,
                        opacity: 0,
                        rotate: particle.rotation
                    }}
                    transition={{
                        duration: 1.5,
                        ease: "easeOut",
                        delay: Math.random() * 0.2
                    }}
                    className="absolute text-4xl"
                >
                    {emoji}
                </motion.div>
            ))}

            {/* Confetti Particles (for 🎉) */}
            {emoji === '🎉' && Array.from({ length: 30 }).map((_, i) => (
                <motion.div
                    key={`confetti-${i}`}
                    initial={{
                        x: '50vw',
                        y: '50vh',
                        scale: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: `calc(50vw + ${Math.random() * 100 - 50}vw)`,
                        y: `calc(50vh + ${Math.random() * 100 - 50}vh)`,
                        scale: Math.random() * 0.5 + 0.5,
                        opacity: 0,
                        rotate: Math.random() * 720
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeOut",
                        delay: Math.random() * 0.3
                    }}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                        background: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i % 5]
                    }}
                />
            ))}

            {/* Heart Particles (for ❤️) */}
            {emoji === '❤️' && Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                    key={`heart-${i}`}
                    initial={{
                        x: '50vw',
                        y: '50vh',
                        scale: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: `calc(50vw + ${Math.random() * 80 - 40}vw)`,
                        y: `calc(50vh - ${Math.random() * 60}vh)`, // Float upward
                        scale: Math.random() * 0.8 + 0.4,
                        opacity: 0,
                        rotate: Math.random() * 360
                    }}
                    transition={{
                        duration: 2.5,
                        ease: "easeOut",
                        delay: Math.random() * 0.2
                    }}
                    className="absolute text-2xl"
                >
                    ❤️
                </motion.div>
            ))}

            {/* Sparkles (for 👍 and 🤔) */}
            {(emoji === '👍' || emoji === '🤔') && Array.from({ length: 25 }).map((_, i) => (
                <motion.div
                    key={`sparkle-${i}`}
                    initial={{
                        x: '50vw',
                        y: '50vh',
                        scale: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: `calc(50vw + ${Math.random() * 100 - 50}vw)`,
                        y: `calc(50vh + ${Math.random() * 100 - 50}vh)`,
                        scale: [0, 1, 0],
                        opacity: [1, 1, 0],
                        rotate: [0, 180, 360]
                    }}
                    transition={{
                        duration: 1.5,
                        ease: "easeOut",
                        delay: Math.random() * 0.3
                    }}
                    className="absolute text-xl"
                >
                    ✨
                </motion.div>
            ))}

            {/* Ring Waves */}
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={`ring-${i}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                        scale: [0, 2 + i, 3 + i],
                        opacity: [0, 0.4, 0]
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeOut",
                        delay: i * 0.2
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border-4"
                    style={{
                        borderColor: colors.primary
                    }}
                />
            ))}

            {/* Flash Effect */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at center, ${colors.glow} 0%, transparent 70%)`
                }}
            />
        </div>
    );
}
