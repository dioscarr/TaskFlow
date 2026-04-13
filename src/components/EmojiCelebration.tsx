'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CelebrationProps {
    emoji: string;
    onComplete: () => void;
}

export default function EmojiCelebration({ emoji, onComplete }: CelebrationProps) {
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; rotation: number; scale: number }>>([]);
    const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; rotation: number; scale: number; delay: number }>>([]);
    const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number; rotation: number; scale: number; delay: number }>>([]);
    const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

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

        setConfetti(
            emoji === '🎉'
                ? Array.from({ length: 30 }, (_, i) => ({
                    id: i,
                    x: Math.random() * 100 - 50,
                    y: Math.random() * 100 - 50,
                    scale: Math.random() * 0.5 + 0.5,
                    rotation: Math.random() * 720,
                    delay: Math.random() * 0.3
                }))
                : []
        );

        setHearts(
            emoji === '❤️'
                ? Array.from({ length: 20 }, (_, i) => ({
                    id: i,
                    x: Math.random() * 80 - 40,
                    y: Math.random() * 60,
                    scale: Math.random() * 0.8 + 0.4,
                    rotation: Math.random() * 360,
                    delay: Math.random() * 0.2
                }))
                : []
        );

        setSparkles(
            emoji === '👍' || emoji === '🤔'
                ? Array.from({ length: 25 }, (_, i) => ({
                    id: i,
                    x: Math.random() * 100 - 50,
                    y: Math.random() * 100 - 50,
                    delay: Math.random() * 0.3
                }))
                : []
        );

        // Auto-complete after animation
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, [emoji, onComplete]);

    // Get colors based on emoji
    const getColors = () => {
        switch (emoji) {
            case '👍':
                return {
                    primary: 'rgba(56, 189, 248, 0.6)', // Sky
                    secondary: 'rgba(125, 211, 252, 0.4)',
                    glow: 'rgba(56, 189, 248, 0.3)'
                };
            case '❤️':
                return {
                    primary: 'rgba(236, 72, 153, 0.6)', // Pink
                    secondary: 'rgba(244, 114, 182, 0.4)',
                    glow: 'rgba(236, 72, 153, 0.3)'
                };
            case '🎉':
                return {
                    primary: 'rgba(16, 185, 129, 0.6)', // Emerald
                    secondary: 'rgba(52, 211, 153, 0.4)',
                    glow: 'rgba(16, 185, 129, 0.3)'
                };
            case '🤔':
                return {
                    primary: 'rgba(234, 179, 8, 0.6)', // Yellow
                    secondary: 'rgba(250, 204, 21, 0.4)',
                    glow: 'rgba(234, 179, 8, 0.3)'
                };
            default:
                return {
                    primary: 'rgba(56, 189, 248, 0.6)',
                    secondary: 'rgba(125, 211, 252, 0.4)',
                    glow: 'rgba(56, 189, 248, 0.3)'
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
                        delay: particle.scale * 0.2
                    }}
                    className="absolute text-4xl"
                >
                    {emoji}
                </motion.div>
            ))}

            {/* Confetti Particles (for 🎉) */}
            {emoji === '🎉' && confetti.map((particle) => (
                <motion.div
                    key={`confetti-${particle.id}`}
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
                        duration: 2,
                        ease: "easeOut",
                        delay: particle.delay
                    }}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                        background: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][particle.id % 5]
                    }}
                />
            ))}

            {/* Heart Particles (for ❤️) */}
            {emoji === '❤️' && hearts.map((particle) => (
                <motion.div
                    key={`heart-${particle.id}`}
                    initial={{
                        x: '50vw',
                        y: '50vh',
                        scale: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: `calc(50vw + ${particle.x}vw)`,
                        y: `calc(50vh - ${particle.y}vh)`, // Float upward
                        scale: particle.scale,
                        opacity: 0,
                        rotate: particle.rotation
                    }}
                    transition={{
                        duration: 2.5,
                        ease: "easeOut",
                        delay: particle.delay
                    }}
                    className="absolute text-2xl"
                >
                    ❤️
                </motion.div>
            ))}

            {/* Sparkles (for 👍 and 🤔) */}
            {(emoji === '👍' || emoji === '🤔') && sparkles.map((particle) => (
                <motion.div
                    key={`sparkle-${particle.id}`}
                    initial={{
                        x: '50vw',
                        y: '50vh',
                        scale: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: `calc(50vw + ${particle.x}vw)`,
                        y: `calc(50vh + ${particle.y}vh)`,
                        scale: [0, 1, 0],
                        opacity: [1, 1, 0],
                        rotate: [0, 180, 360]
                    }}
                    transition={{
                        duration: 1.5,
                        ease: "easeOut",
                        delay: particle.delay
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
