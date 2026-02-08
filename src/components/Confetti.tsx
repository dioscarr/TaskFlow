'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ConfettiProps {
    onComplete?: () => void;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    rotation: number;
    color: string;
    size: number;
    velocity: {
        x: number;
        y: number;
    };
}

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

export default function Confetti({ onComplete }: ConfettiProps) {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        // Generate confetti particles
        const newParticles: Particle[] = [];
        for (let i = 0; i < 100; i++) {
            newParticles.push({
                id: i,
                x: Math.random() * window.innerWidth,
                y: -20,
                rotation: Math.random() * 360,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 10 + 5,
                velocity: {
                    x: (Math.random() - 0.5) * 200,
                    y: Math.random() * 300 + 200
                }
            });
        }
        setParticles(newParticles);

        // Auto-cleanup after animation
        const timer = setTimeout(() => {
            onComplete?.();
        }, 4000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute"
                    style={{
                        width: particle.size,
                        height: particle.size,
                        backgroundColor: particle.color,
                        borderRadius: Math.random() > 0.5 ? '50%' : '0%',
                    }}
                    initial={{
                        x: particle.x,
                        y: particle.y,
                        rotate: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: particle.x + particle.velocity.x,
                        y: window.innerHeight + 100,
                        rotate: particle.rotation + 720,
                        opacity: [1, 1, 0]
                    }}
                    transition={{
                        duration: 3,
                        ease: [0.25, 0.1, 0.25, 1]
                    }}
                />
            ))}
        </div>
    );
}

// Emoji Celebration Component
export function EmojiCelebration({ emojis = ['🎉', '✨', '🚀', '⭐', '🎊'], onComplete }: { emojis?: string[]; onComplete?: () => void }) {
    const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number; y: number }>>([]);

    useEffect(() => {
        const newParticles = Array.from({ length: 30 }, (_, i) => ({
            id: i,
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            x: Math.random() * window.innerWidth,
            y: window.innerHeight / 2
        }));
        setParticles(newParticles);

        const timer = setTimeout(() => {
            onComplete?.();
        }, 3000);

        return () => clearTimeout(timer);
    }, [emojis, onComplete]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute text-4xl"
                    initial={{
                        x: particle.x,
                        y: particle.y,
                        scale: 0,
                        opacity: 0
                    }}
                    animate={{
                        x: particle.x + (Math.random() - 0.5) * 400,
                        y: particle.y - Math.random() * 300 - 100,
                        scale: [0, 1.5, 1, 0],
                        opacity: [0, 1, 1, 0],
                        rotate: (Math.random() - 0.5) * 720
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeOut"
                    }}
                >
                    {particle.emoji}
                </motion.div>
            ))}
        </div>
    );
}
