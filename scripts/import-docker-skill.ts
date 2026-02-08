#!/usr/bin/env tsx

/**
 * Import Docker DevOps Expert Skill
 *
 * Loads the Docker DevOps Expert skill into the database
 * Run: npx tsx scripts/import-docker-skill.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function importDockerSkill() {
    console.log('🐳 Importing Docker DevOps Expert Skill...\n');

    try {
        // Read skill definition
        const skillPath = join(process.cwd(), '.github/skills/docker-devops-expert.json');
        const skillData = JSON.parse(await readFile(skillPath, 'utf-8'));

        // Find demo user (or create if needed)
        let user = await prisma.user.findUnique({
            where: { email: 'demo@example.com' }
        });

        if (!user) {
            console.log('Creating demo user...');
            user = await prisma.user.create({
                data: {
                    email: 'demo@example.com',
                    name: 'Demo User'
                }
            });
        }

        // Check if skill already exists
        const existing = await prisma.skill.findFirst({
            where: {
                userId: user.id,
                name: skillData.name
            }
        });

        if (existing) {
            console.log(`✅ Skill "${skillData.name}" already exists (ID: ${existing.id})`);
            console.log('   Updating existing skill...\n');

            await prisma.skill.update({
                where: { id: existing.id },
                data: {
                    description: skillData.description,
                    category: skillData.category,
                    icon: skillData.icon,
                    enabled: skillData.enabled,
                    schema: skillData.schema,
                    capabilities: skillData.capabilities,
                    handlerType: skillData.handlerType,
                    handlerRef: skillData.handlerRef,
                    workflow: skillData.workflow,
                    tags: skillData.tags,
                    isBuiltin: skillData.isBuiltin
                }
            });

            console.log('✅ Skill updated successfully!\n');
        } else {
            console.log(`Creating new skill: "${skillData.name}"...\n`);

            const skill = await prisma.skill.create({
                data: {
                    userId: user.id,
                    name: skillData.name,
                    description: skillData.description,
                    category: skillData.category,
                    icon: skillData.icon,
                    enabled: skillData.enabled,
                    schema: skillData.schema,
                    capabilities: skillData.capabilities,
                    handlerType: skillData.handlerType,
                    handlerRef: skillData.handlerRef,
                    workflow: skillData.workflow,
                    tags: skillData.tags,
                    isBuiltin: skillData.isBuiltin
                }
            });

            console.log(`✅ Skill created successfully! (ID: ${skill.id})\n`);
        }

        // Display skill info
        console.log('📋 Skill Details:');
        console.log(`   Name: ${skillData.name}`);
        console.log(`   Category: ${skillData.category}`);
        console.log(`   Capabilities: ${skillData.capabilities.length} features`);
        console.log(`   Tags: ${skillData.tags.join(', ')}`);
        console.log(`   Handler: ${skillData.handlerRef}`);
        console.log(`   Enabled: ${skillData.enabled ? '✅ Yes' : '❌ No'}\n`);

        console.log('🎯 Usage:');
        console.log('   This skill can now be invoked in AI conversations to get expert');
        console.log('   assistance with Docker development workflows, container management,');
        console.log('   security hardening, and performance optimization.\n');

        console.log('📚 Documentation:');
        console.log(`   Agent: .github/agents/DockerDevOps.agent.md`);
        console.log(`   Skill: .github/skills/docker-devops-expert.json\n`);

    } catch (error) {
        console.error('❌ Error importing skill:', error);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

importDockerSkill();
