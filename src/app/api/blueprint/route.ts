/**
 * Blueprint API
 * Generate, retrieve, and manage application blueprints
 */

import { NextRequest, NextResponse } from 'next/server';
import { BlueprintGenerator } from '@/lib/blueprintGenerator';
import { memory } from '@/lib/agents/memory';
import path from 'path';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const format = searchParams.get('format') || 'json'; // json or markdown
        const rootPath = path.resolve(process.cwd());

        if (action === 'latest') {
            // Get the latest blueprint
            const blueprint = await BlueprintGenerator.getLatestBlueprint(rootPath);

            if (!blueprint) {
                return NextResponse.json(
                    { error: 'No blueprint found. Generate one first.' },
                    { status: 404 }
                );
            }

            if (format === 'markdown') {
                const markdown = BlueprintGenerator.generateMarkdownSummary(blueprint);
                return new NextResponse(markdown, {
                    headers: {
                        'Content-Type': 'text/markdown',
                    },
                });
            }

            return NextResponse.json({ blueprint });
        }

        // Default: return latest blueprint
        const blueprint = await BlueprintGenerator.getLatestBlueprint(rootPath);
        return NextResponse.json({ blueprint });
    } catch (error: any) {
        console.error('Blueprint GET error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to retrieve blueprint' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;
        const rootPath = path.resolve(process.cwd());

        if (action === 'generate') {
            // Generate a new blueprint
            const generator = new BlueprintGenerator(rootPath);

            const blueprint = await generator.generateBlueprint();

            try {
                await memory.addJobSummary(`magic_blueprint_${Date.now()}`, `Generated Blueprint for: "${blueprint.metadata.name}"`);
            } catch (e) { }

            return NextResponse.json({
                success: true,
                message: 'Blueprint generated successfully',
                blueprint
            });
        }

        if (action === 'export') {
            // Export blueprint for recreation
            const blueprint = await BlueprintGenerator.getLatestBlueprint(rootPath);

            if (!blueprint) {
                return NextResponse.json(
                    { error: 'No blueprint found to export' },
                    { status: 404 }
                );
            }

            const exportData = {
                ...blueprint,
                recreationScript: generateRecreationScript(blueprint),
                instructions: generateRecreationInstructions(blueprint)
            };

            return NextResponse.json({
                success: true,
                export: exportData
            });
        }

        return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
        );
    } catch (error: any) {
        console.error('Blueprint POST error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process blueprint request' },
            { status: 500 }
        );
    }
}

/**
 * Generate a recreation script from blueprint
 */
function generateRecreationScript(blueprint: any): string {
    const script = `#!/bin/bash
# Application Recreation Script
# Generated from blueprint: ${blueprint.id}

echo "🚀 Recreating ${blueprint.metadata.name}..."

# Step 1: Create directory structure
mkdir -p src/{app,components,lib,hooks,utils}
mkdir -p prisma
mkdir -p public/uploads

# Step 2: Initialize project
npm init -y
npm install next@latest react@latest react-dom@latest typescript @types/react @types/node

# Step 3: Install dependencies
${Object.entries(blueprint.dependencies.production)
            .map(([pkg, ver]) => `npm install ${pkg}@${ver}`)
            .join('\n')}

${Object.entries(blueprint.dependencies.development)
            .map(([pkg, ver]) => `npm install -D ${pkg}@${ver}`)
            .join('\n')}

# Step 4: Create configuration files
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  }
}
EOF

# Step 5: Setup Prisma
${blueprint.database ? `
npx prisma init
# Copy schema from blueprint
cat > prisma/schema.prisma << 'EOF'
${blueprint.database.schema}
EOF

npx prisma generate
npx prisma db push
` : ''}

# Step 6: Create basic app structure
echo "✅ Project structure created!"
echo "📝 Next steps:"
echo "  1. Copy component files from blueprint"
echo "  2. Configure environment variables"
echo "  3. Run 'npm run dev' to start development server"
`;

    return script;
}

/**
 * Generate recreation instructions
 */
function generateRecreationInstructions(blueprint: any): string {
    return `
# Recreation Instructions for ${blueprint.metadata.name}

## Overview
This blueprint represents a **${blueprint.metadata.type}** application built with:
${blueprint.metadata.framework.map((f: string) => `- ${f}`).join('\n')}

## Automated Setup

1. **Run the recreation script:**
   \`\`\`bash
   chmod +x recreate.sh
   ./recreate.sh
   \`\`\`

2. **Manual steps required:**
   - Copy environment variables to \`.env\`
   - Update database connection strings
   - Copy component files from the blueprint

## Architecture

The application follows a **${blueprint.architecture.type}** architecture with these layers:

${blueprint.architecture.layers.map((layer: any) => `
### ${layer.name}
- **Location:** \`${layer.path}\`
- **Technologies:** ${layer.technologies.join(', ')}
- **Purpose:** ${layer.description}
`).join('\n')}

## Key Features to Implement

${blueprint.features.map((feature: any) => `
### ${feature.name}
**Status:** ${feature.status}

${feature.description}

**Required files:**
${feature.files.map((f: string) => `- \`${f}\``).join('\n')}
`).join('\n')}

## API Endpoints

${blueprint.apis.map((api: any) => `
- **${api.method}** \`${api.path}\`
  ${api.description || ''}
`).join('\n')}

## Database Setup

${blueprint.database ? `
The application uses **${blueprint.database.type}** with ${blueprint.database.models.length} models:

${blueprint.database.models.map((m: any) => `- ${m.name}`).join('\n')}

**Schema:** See \`prisma/schema.prisma\` in the blueprint
` : 'No database required'}

## HTML Projects

${blueprint.htmlProjects.length > 0 ? `
This application includes ${blueprint.htmlProjects.length} HTML projects:

${blueprint.htmlProjects.slice(0, 10).map((p: any) => `
- **${p.name}**
  - Pages: ${p.pages.join(', ')}
  - Path: \`${p.path}\`
`).join('\n')}
` : 'No HTML projects included'}

## Next Steps

1. ✅ Run the automated recreation script
2. 📋 Copy all component files listed in the components section
3. 🔧 Configure environment variables
4. 🗄️ Set up and migrate the database
5. 🎨 Copy HTML projects to \`public/uploads\`
6. 🚀 Start the development server: \`npm run dev\`
7. 🧪 Test all features listed in the Features section

---
*Blueprint Version: ${blueprint.version}*  
*Generated: ${new Date(blueprint.timestamp).toLocaleString()}*
`;
}
