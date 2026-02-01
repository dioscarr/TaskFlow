/**
 * Blueprint Generator System
 * Generates structured blueprints of the application for context, recreation, and AI understanding
 */

import fs from 'fs';
import path from 'path';

export interface Blueprint {
    id: string;
    version: string;
    timestamp: Date;
    metadata: {
        name: string;
        description: string;
        type: 'fullstack' | 'frontend' | 'backend' | 'component';
        framework: string[];
        database?: string;
        deployment?: string;
    };
    architecture: {
        type: 'monolithic' | 'microservices' | 'serverless' | 'hybrid';
        layers: {
            name: string;
            description: string;
            path: string;
            technologies: string[];
        }[];
        patterns: string[];
    };
    structure: FileNode[];
    dependencies: {
        production: Record<string, string>;
        development: Record<string, string>;
    };
    database?: {
        type: string;
        schema: any;
        models: any[];
    };
    apis: {
        name: string;
        path: string;
        method: string;
        description: string;
    }[];
    components: {
        name: string;
        path: string;
        type: 'page' | 'component' | 'layout' | 'utility';
        dependencies: string[];
        exports: string[];
    }[];
    features: {
        name: string;
        description: string;
        files: string[];
        status: 'implemented' | 'in-progress' | 'planned';
    }[];
    htmlProjects: {
        name: string;
        path: string;
        pages: string[];
        assets: string[];
    }[];
}

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    extension?: string;
    size?: number;
    children?: FileNode[];
    content?: string; // For small/important files
    summary?: string; // AI-generated summary
}

export class BlueprintGenerator {
    private rootPath: string;
    private ignorePaths: Set<string>;
    private blueprintPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
        this.blueprintPath = path.join(rootPath, '.agent', 'blueprint.json');
        this.ignorePaths = new Set([
            'node_modules',
            '.next',
            '.git',
            'dist',
            'build',
            '.firebase',
            'coverage',
            'tsconfig.tsbuildinfo'
        ]);
    }

    /**
     * Generate a complete application blueprint
     */
    async generateBlueprint(): Promise<Blueprint> {
        console.log('🔍 Generating application blueprint...');

        const packageJson = await this.readPackageJson();
        const prismaSchema = await this.readPrismaSchema();
        const structure = await this.scanDirectory(this.rootPath);

        const blueprint: Blueprint = {
            id: `blueprint-${Date.now()}`,
            version: packageJson?.version || '1.0.0',
            timestamp: new Date(),
            metadata: {
                name: packageJson?.name || 'TaskFlow',
                description: packageJson?.description || 'Advanced AI-powered task management system',
                type: 'fullstack',
                framework: this.detectFrameworks(packageJson),
                database: prismaSchema ? 'PostgreSQL (via Prisma)' : undefined,
                deployment: 'Vercel/Firebase'
            },
            architecture: {
                type: 'hybrid',
                layers: [
                    {
                        name: 'Frontend',
                        description: 'Next.js + React + TypeScript',
                        path: '/src/app',
                        technologies: ['Next.js 14', 'React', 'TypeScript', 'Tailwind CSS']
                    },
                    {
                        name: 'Backend',
                        description: 'Next.js API Routes + Server Actions',
                        path: '/src/app/api',
                        technologies: ['Next.js API', 'Server Actions', 'Prisma ORM']
                    },
                    {
                        name: 'Database',
                        description: 'PostgreSQL with Prisma',
                        path: '/prisma',
                        technologies: ['PostgreSQL', 'Prisma']
                    },
                    {
                        name: 'AI Layer',
                        description: 'AI agents and workflows',
                        path: '/src/lib',
                        technologies: ['Google AI', 'Custom Agents']
                    }
                ],
                patterns: ['Server-Side Rendering', 'API Routes', 'Server Actions', 'Real-time Updates']
            },
            structure,
            dependencies: {
                production: packageJson?.dependencies || {},
                development: packageJson?.devDependencies || {}
            },
            database: prismaSchema ? await this.extractDatabaseInfo(prismaSchema) : undefined,
            apis: await this.discoverApiRoutes(),
            components: await this.discoverComponents(),
            features: await this.identifyFeatures(),
            htmlProjects: await this.scanHtmlProjects()
        };

        // Save blueprint to file
        await this.saveBlueprint(blueprint);

        console.log('✅ Blueprint generated successfully!');
        return blueprint;
    }

    /**
     * Scan directory structure recursively
     */
    private async scanDirectory(dirPath: string, relativePath = ''): Promise<FileNode[]> {
        const nodes: FileNode[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relPath = path.join(relativePath, entry.name);

                // Skip ignored paths
                if (this.ignorePaths.has(entry.name)) continue;

                if (entry.isDirectory()) {
                    const children = await this.scanDirectory(fullPath, relPath);
                    nodes.push({
                        name: entry.name,
                        path: relPath,
                        type: 'directory',
                        children
                    });
                } else {
                    const stats = fs.statSync(fullPath);
                    const ext = path.extname(entry.name);

                    const node: FileNode = {
                        name: entry.name,
                        path: relPath,
                        type: 'file',
                        extension: ext,
                        size: stats.size
                    };

                    // Include content for important config files
                    if (this.isImportantFile(entry.name)) {
                        try {
                            node.content = fs.readFileSync(fullPath, 'utf-8');
                        } catch (err) {
                            console.warn(`Could not read ${entry.name}`);
                        }
                    }

                    nodes.push(node);
                }
            }
        } catch (err) {
            console.error(`Error scanning ${dirPath}:`, err);
        }

        return nodes;
    }

    /**
     * Determine if file should have content included
     */
    private isImportantFile(filename: string): boolean {
        const importantFiles = [
            'package.json',
            'tsconfig.json',
            'next.config.ts',
            'tailwind.config.ts',
            'prisma/schema.prisma',
            '.env.example',
            'README.md'
        ];
        return importantFiles.some(f => filename.endsWith(f));
    }

    /**
     * Read and parse package.json
     */
    private async readPackageJson(): Promise<any> {
        try {
            const pkgPath = path.join(this.rootPath, 'package.json');
            const content = fs.readFileSync(pkgPath, 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            console.warn('Could not read package.json');
            return null;
        }
    }

    /**
     * Read Prisma schema
     */
    private async readPrismaSchema(): Promise<string | null> {
        try {
            const schemaPath = path.join(this.rootPath, 'prisma', 'schema.prisma');
            return fs.readFileSync(schemaPath, 'utf-8');
        } catch (err) {
            return null;
        }
    }

    /**
     * Detect frameworks from package.json
     */
    private detectFrameworks(packageJson: any): string[] {
        const frameworks: string[] = [];
        const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };

        if (deps?.next) frameworks.push('Next.js');
        if (deps?.react) frameworks.push('React');
        if (deps?.typescript) frameworks.push('TypeScript');
        if (deps?.tailwindcss) frameworks.push('Tailwind CSS');
        if (deps?.['@prisma/client']) frameworks.push('Prisma');

        return frameworks;
    }

    /**
     * Extract database models from Prisma schema
     */
    private async extractDatabaseInfo(schema: string): Promise<any> {
        const models: any[] = [];
        const modelRegex = /model\s+(\w+)\s*{([^}]*)}/g;
        let match;

        while ((match = modelRegex.exec(schema)) !== null) {
            const [, modelName, fields] = match;
            models.push({
                name: modelName,
                fields: fields.trim().split('\n').map(f => f.trim()).filter(f => f && !f.startsWith('//'))
            });
        }

        return {
            type: 'PostgreSQL',
            schema: schema,
            models
        };
    }

    /**
     * Discover API routes
     */
    private async discoverApiRoutes(): Promise<Blueprint['apis']> {
        const apis: Blueprint['apis'] = [];
        const apiPath = path.join(this.rootPath, 'src', 'app', 'api');

        try {
            if (fs.existsSync(apiPath)) {
                const scanApis = (dir: string, basePath = '') => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });

                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);

                        if (entry.isDirectory()) {
                            scanApis(fullPath, `${basePath}/${entry.name}`);
                        } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            const methods = this.extractHttpMethods(content);

                            for (const method of methods) {
                                apis.push({
                                    name: basePath || '/',
                                    path: `/api${basePath}`,
                                    method,
                                    description: this.extractApiDescription(content)
                                });
                            }
                        }
                    }
                };

                scanApis(apiPath);
            }
        } catch (err) {
            console.warn('Could not scan API routes');
        }

        return apis;
    }

    /**
     * Extract HTTP methods from route file
     */
    private extractHttpMethods(content: string): string[] {
        const methods: string[] = [];
        const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/g;
        let match;

        while ((match = methodRegex.exec(content)) !== null) {
            methods.push(match[1]);
        }

        return methods;
    }

    /**
     * Extract API description from comments
     */
    private extractApiDescription(content: string): string {
        const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\n/);
        return descMatch ? descMatch[1] : '';
    }

    /**
     * Discover React components
     */
    private async discoverComponents(): Promise<Blueprint['components']> {
        const components: Blueprint['components'] = [];
        const componentsPath = path.join(this.rootPath, 'src', 'components');

        try {
            if (fs.existsSync(componentsPath)) {
                const files = fs.readdirSync(componentsPath);

                for (const file of files) {
                    if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
                        const fullPath = path.join(componentsPath, file);
                        const content = fs.readFileSync(fullPath, 'utf-8');

                        components.push({
                            name: file.replace(/\.(tsx|jsx)$/, ''),
                            path: `src/components/${file}`,
                            type: 'component',
                            dependencies: this.extractImports(content),
                            exports: this.extractExports(content)
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('Could not scan components');
        }

        return components;
    }

    /**
     * Extract imports from file content
     */
    private extractImports(content: string): string[] {
        const imports: string[] = [];
        const importRegex = /import\s+(?:{[^}]+}|[\w]+)\s+from\s+['"]([^'"]+)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    }

    /**
     * Extract exports from file content
     */
    private extractExports(content: string): string[] {
        const exports: string[] = [];
        const exportRegex = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g;
        let match;

        while ((match = exportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }

        return exports;
    }

    /**
     * Identify application features
     */
    private async identifyFeatures(): Promise<Blueprint['features']> {
        return [
            {
                name: 'AI Chat Assistant',
                description: 'Advanced AI-powered chat with context awareness, tool calling, and  streaming responses',
                files: ['src/components/AIChat.tsx', 'src/lib/toolLibrary.ts', 'src/app/api/ai/chat/route.ts'],
                status: 'implemented'
            },
            {
                name: 'File Management',
                description: 'Drag-and-drop file manager with folders, previews, and AI-powered organization',
                files: ['src/components/FileManager.tsx', 'src/app/api/files/route.ts'],
                status: 'implemented'
            },
            {
                name: 'Task Management',
                description: 'Task creation, tracking, and organization',
                files: ['src/components/TaskList.tsx', 'src/app/api/tasks/route.ts'],
                status: 'implemented'
            },
            {
                name: 'Agent Workflows',
                description: 'Custom AI agent archetypes with specialized workflows',
                files: ['src/lib/agentArchetypes.ts', 'src/components/PromptEditorModal.tsx'],
                status: 'implemented'
            },
            {
                name: 'Magic Folders',
                description: 'Automated folder workflows with AI processing',
                files: ['src/lib/magicFolders.ts'],
                status: 'implemented'
            },
            {
                name: 'Document Synthesis',
                description: 'AI-powered document generation from multiple sources',
                files: ['src/lib/documentSynthesis.ts'],
                status: 'implemented'
            },
            {
                name: 'Blueprint System',
                description: 'Application blueprint generation for context and recreation',
                files: ['src/lib/blueprintGenerator.ts', 'src/app/api/blueprint/route.ts'],
                status: 'implemented'
            }
        ];
    }

    /**
     * Scan HTML projects
     */
    private async scanHtmlProjects(): Promise<Blueprint['htmlProjects']> {
        const projects: Blueprint['htmlProjects'] = [];
        const uploadsPath = path.join(this.rootPath, 'public', 'uploads');

        try {
            if (fs.existsSync(uploadsPath)) {
                const entries = fs.readdirSync(uploadsPath, { withFileTypes: true });

                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const projectPath = path.join(uploadsPath, entry.name);
                        const files = fs.readdirSync(projectPath);
                        const htmlFiles = files.filter(f => f.endsWith('.html'));
                        const assetFiles = files.filter(f => !f.endsWith('.html'));

                        if (htmlFiles.length > 0) {
                            projects.push({
                                name: entry.name,
                                path: `public/uploads/${entry.name}`,
                                pages: htmlFiles,
                                assets: assetFiles
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Could not scan HTML projects');
        }

        return projects;
    }

    /**
     * Save blueprint to file
     */
    private async saveBlueprint(blueprint: Blueprint): Promise<void> {
        try {
            // Ensure .agent directory exists
            const agentDir = path.dirname(this.blueprintPath);
            if (!fs.existsSync(agentDir)) {
                fs.mkdirSync(agentDir, { recursive: true });
            }

            // Write blueprint to file
            fs.writeFileSync(this.blueprintPath, JSON.stringify(blueprint, null, 2), 'utf-8');
            console.log(`📝 Blueprint saved to ${this.blueprintPath}`);
        } catch (err) {
            console.error('Error saving blueprint:', err);
        }
    }

    /**
     * Get latest blueprint from file
     */
    static async getLatestBlueprint(rootPath: string): Promise<Blueprint | null> {
        try {
            const blueprintPath = path.join(rootPath, '.agent', 'blueprint.json');

            if (fs.existsSync(blueprintPath)) {
                const content = fs.readFileSync(blueprintPath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (err) {
            console.error('Error retrieving blueprint:', err);
        }

        return null;
    }

    /**
     * Generate markdown summary of blueprint
     */
    static generateMarkdownSummary(blueprint: Blueprint): string {
        return `
# ${blueprint.metadata.name} Blueprint

**Version:** ${blueprint.version}  
**Generated:** ${new Date(blueprint.timestamp).toISOString()}  
**Type:** ${blueprint.metadata.type}

## Overview
${blueprint.metadata.description}

## Technology Stack
${blueprint.metadata.framework.map(f => `- ${f}`).join('\n')}

## Architecture
**Type:** ${blueprint.architecture.type}

### Layers
${blueprint.architecture.layers.map(layer => `
#### ${layer.name}
- **Path:** \`${layer.path}\`
- **Technologies:** ${layer.technologies.join(', ')}
- ${layer.description}
`).join('\n')}

## Features
${blueprint.features.map(f => `
### ${f.name} (${f.status})
${f.description}

**Files:**
${f.files.map(file => `- \`${file}\``).join('\n')}
`).join('\n')}

## API Endpoints
${blueprint.apis.map(api => `- **${api.method}** \`${api.path}\` - ${api.description || 'N/A'}`).join('\n')}

## Components (${blueprint.components.length})
${blueprint.components.slice(0, 10).map(c => `- \`${c.name}\` (${c.type})`).join('\n')}
${blueprint.components.length > 10 ? `\n...and ${blueprint.components.length - 10} more` : ''}

## HTML Projects (${blueprint.htmlProjects.length})
${blueprint.htmlProjects.slice(0, 5).map(p => `- ${p.name} (${p.pages.length} pages)`).join('\n')}
${blueprint.htmlProjects.length > 5 ? `\n...and ${blueprint.htmlProjects.length - 5} more` : ''}

## Database Models
${blueprint.database?.models.map(m => `- ${m.name}`).join('\n') || 'No database schema found'}

---
*This blueprint can be used to recreate the application structure and provides context for AI assistants.*
`;
    }
}
