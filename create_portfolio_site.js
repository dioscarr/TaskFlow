// Create portfolio site directly
const { PrismaClient } = require('@prisma/client');
const { mkdir, writeFile } = require('fs/promises');
const { join } = require('path');

const prisma = new PrismaClient();

async function createPortfolioSite() {
    try {
        console.log('🎨 Creating portfolio site...');

        const user = await prisma.user.findUnique({
            where: { email: 'demo@example.com' }
        });

        if (!user) {
            console.error('❌ User not found');
            return;
        }

        // Create folder
        const folder = await prisma.workspaceFile.create({
            data: {
                name: 'portfolio-site',
                type: 'folder',
                size: '0 bytes',
                userId: user.id,
                parentId: null
            }
        });

        console.log('✅ Folder created:', folder.id);

        // Create directory
        const uploadsDir = join(process.cwd(), 'public', 'uploads', folder.id);
        await mkdir(uploadsDir, { recursive: true });

        // HTML content
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio - Dark Mode Glassmorphism</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
            color: #fff;
            overflow-x: hidden;
        }
        
        .hero {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            position: relative;
        }
        
        .hero::before {
            content: '';
            position: absolute;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(102,126,234,0.3) 0%, transparent 70%);
            top: 10%;
            left: 10%;
            filter: blur(100px);
            animation: float 8s ease-in-out infinite;
        }
        
        .hero::after {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(118,75,162,0.3) 0%, transparent 70%);
            bottom: 10%;
            right: 10%;
            filter: blur(100px);
            animation: float 10s ease-in-out infinite reverse;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-30px); }
        }
        
        .glass-card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(20px);
            border-radius: 2rem;
            border: 1px solid rgba(255,255,255,0.1);
            padding: 4rem;
            max-width: 800px;
            position: relative;
            z-index: 1;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        
        h1 {
            font-size: 4rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 1rem;
        }
        
        .subtitle {
            font-size: 1.5rem;
            color: rgba(255,255,255,0.7);
            margin-bottom: 2rem;
        }
        
        .description {
            color: rgba(255,255,255,0.8);
            line-height: 1.8;
            margin-bottom: 3rem;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        
        .feature {
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(10px);
            border-radius: 1rem;
            border: 1px solid rgba(255,255,255,0.08);
            padding: 2rem;
            transition: all 0.3s ease;
        }
        
        .feature:hover {
            transform: translateY(-5px);
            border-color: rgba(102,126,234,0.5);
            box-shadow: 0 10px 30px rgba(102,126,234,0.2);
        }
        
        .feature h3 {
            font-size: 1.3rem;
            margin-bottom: 0.5rem;
            color: #667eea;
        }
        
        .feature p {
            color: rgba(255,255,255,0.6);
            line-height: 1.6;
        }
        
        .cta {
            display: inline-block;
            margin-top: 2rem;
            padding: 1rem 2.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 2rem;
            text-decoration: none;
            color: white;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102,126,234,0.4);
        }
        
        .cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102,126,234,0.6);
        }
        
        @media (max-width: 768px) {
            h1 { font-size: 2.5rem; }
            .subtitle { font-size: 1.2rem; }
            .glass-card { padding: 2rem; }
        }
    </style>
</head>
<body>
    <div class="hero">
        <div class="glass-card">
            <h1>Portfolio</h1>
            <p class="subtitle">Dark Mode Glassmorphism Design</p>
            <p class="description">
                A modern, premium portfolio showcasing cutting-edge design with glassmorphic elements, 
                smooth animations, and a sophisticated dark theme. Built with attention to detail and 
                user experience.
            </p>
            
            <div class="features">
                <div class="feature">
                    <h3>🎨 Modern Design</h3>
                    <p>Glassmorphism effects with backdrop blur and subtle gradients for a premium look</p>
                </div>
                <div class="feature">
                    <h3>✨ Smooth Animations</h3>
                    <p>Floating elements and hover effects create engaging, interactive experiences</p>
                </div>
                <div class="feature">
                    <h3>🌙 Dark Theme</h3>
                    <p>Eye-friendly dark mode with vibrant purple-pink accent colors</p>
                </div>
            </div>
            
            <a href="#contact" class="cta">Get In Touch</a>
        </div>
    </div>
</body>
</html>`;

        // Write file
        const filePath = join(uploadsDir, 'index.html');
        await writeFile(filePath, html);
        console.log('✅ File written:', filePath);

        // Create database record
        const file = await prisma.workspaceFile.create({
            data: {
                name: 'index.html',
                type: 'html',
                size: `${Buffer.byteLength(html)} bytes`,
                userId: user.id,
                parentId: folder.id,
                storagePath: `${folder.id}/index.html`
            }
        });

        console.log('✅ File record created:', file.id);
        console.log('\n🎉 Portfolio site created successfully!');
        console.log('\n📁 Folder ID:', folder.id);
        console.log('📄 File ID:', file.id);
        console.log('\n🌐 View your portfolio at:');
        console.log('   http://localhost:3000/uploads/' + folder.id + '/index.html');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createPortfolioSite();
