param(
    [Parameter(Mandatory = $true)]
    [string]$AppName,

    [Parameter(Mandatory = $true)]
    [string]$ProductName,

    [string]$Tagline = "Premium SaaS platform for modern teams.",

    [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'

$AppName = $AppName.Trim().ToLower()
if ($AppName -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    Write-Error "Invalid app name. Use kebab-case like 'premium-saas'."
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $repoRoot ("apps\\" + $AppName)

if (Test-Path $appDir) {
    Write-Error "Target folder already exists: $appDir"
    exit 1
}

$scaffoldScript = Join-Path $repoRoot "scripts\\scaffold-vite.ps1"
& powershell -ExecutionPolicy Bypass -File $scaffoldScript -AppName $AppName

Push-Location $appDir
try {
    npm install react-helmet-async --legacy-peer-deps

    if (-not (Test-Path "src\\styles")) { New-Item -ItemType Directory -Path "src\\styles" | Out-Null }
    if (-not (Test-Path "src\\lib")) { New-Item -ItemType Directory -Path "src\\lib" | Out-Null }
    if (-not (Test-Path "src\\components")) { New-Item -ItemType Directory -Path "src\\components" | Out-Null }

    $templatesRoot = Join-Path $repoRoot ".agent\\workflows\\templates"

    Copy-Item (Join-Path $templatesRoot "design-system.css") "src\\styles\\design-system.css"
    Copy-Item (Join-Path $templatesRoot "seo-config.ts") "src\\lib\\seo-config.ts"
    Copy-Item (Join-Path $templatesRoot "component-template.tsx") "src\\components\\Button.tsx"

    @"
import { Helmet, HelmetProvider } from 'react-helmet-async';
import './styles/design-system.css';
import './App.css';

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>$ProductName</title>
        <meta name="description" content="$Tagline" />
      </Helmet>
      <div className="page">
        <header className="hero">
          <nav className="nav">
            <div className="brand">$ProductName</div>
            <div className="nav-links">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
            <button className="cta">Start free trial</button>
          </nav>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Premium SaaS</p>
              <h1>Turn web services into revenue for your business</h1>
              <p className="subhead">$Tagline</p>
              <div className="hero-actions">
                <button className="cta">Get started</button>
                <button className="ghost">Book a demo</button>
              </div>
              <div className="hero-meta">Trusted by modern ops teams across 20+ countries.</div>
            </div>
            <div className="hero-card">
              <div className="stat">
                <span className="label">Revenue lift</span>
                <span className="value">+38%</span>
              </div>
              <div className="stat">
                <span className="label">Launch time</span>
                <span className="value">2 weeks</span>
              </div>
              <div className="stat">
                <span className="label">NPS</span>
                <span className="value">72</span>
              </div>
              <div className="card-note">Automate every stage from discovery to delivery.</div>
            </div>
          </div>
        </header>

        <section id="features" className="section">
          <div className="section-head">
            <h2>Built for teams that scale fast</h2>
            <p>Everything you need to launch, sell, and operate premium web services in one system.</p>
          </div>
          <div className="bento">
            <article className="tile">
              <h3>Workflow automation</h3>
              <p>Streamline handoffs with AI-guided playbooks and real-time visibility.</p>
            </article>
            <article className="tile">
              <h3>Revenue insights</h3>
              <p>Track every deal stage with predictive forecasting and smart alerts.</p>
            </article>
            <article className="tile">
              <h3>Client portals</h3>
              <p>Give customers a polished, self-serve experience with branded portals.</p>
            </article>
            <article className="tile">
              <h3>Security ready</h3>
              <p>Enterprise-grade encryption, audit trails, and role-based access.</p>
            </article>
          </div>
        </section>

        <section id="pricing" className="section pricing">
          <div className="section-head">
            <h2>Pricing that grows with you</h2>
            <p>Start free, upgrade when your revenue takes off.</p>
          </div>
          <div className="pricing-grid">
            <div className="price-card">
              <h3>Launch</h3>
              <p className="price">$49<span>/mo</span></p>
              <ul>
                <li>Automated onboarding</li>
                <li>Client portal</li>
                <li>Basic analytics</li>
              </ul>
              <button className="ghost">Choose Launch</button>
            </div>
            <div className="price-card featured">
              <h3>Scale</h3>
              <p className="price">$149<span>/mo</span></p>
              <ul>
                <li>Everything in Launch</li>
                <li>AI playbooks</li>
                <li>Advanced reporting</li>
              </ul>
              <button className="cta">Choose Scale</button>
            </div>
            <div className="price-card">
              <h3>Enterprise</h3>
              <p className="price">Custom</p>
              <ul>
                <li>Dedicated success</li>
                <li>Custom security</li>
                <li>Priority support</li>
              </ul>
              <button className="ghost">Talk to sales</button>
            </div>
          </div>
        </section>

        <section id="faq" className="section faq">
          <div className="section-head">
            <h2>Questions, answered</h2>
            <p>Everything you need to know before switching to $ProductName.</p>
          </div>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>How fast can we launch?</h4>
              <p>Most teams are live in under two weeks, with guided onboarding and migration.</p>
            </div>
            <div className="faq-item">
              <h4>Does it work with our tools?</h4>
              <p>Yes. Connect your CRM, billing, analytics, and support stack in minutes.</p>
            </div>
            <div className="faq-item">
              <h4>What about security reviews?</h4>
              <p>We provide SOC 2 reports, SSO, and custom controls for enterprise teams.</p>
            </div>
            <div className="faq-item">
              <h4>Is there a free trial?</h4>
              <p>Every plan starts with a 14-day free trial, no credit card required.</p>
            </div>
          </div>
        </section>

        <section className="cta-band">
          <div>
            <h2>Ready to elevate your web services?</h2>
            <p>Launch a premium client experience with $ProductName today.</p>
          </div>
          <button className="cta">Start free trial</button>
        </section>

        <footer className="footer">
          <div className="brand">$ProductName</div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="#">Privacy</a>
          </div>
          <div className="footer-note">© 2026 $ProductName. All rights reserved.</div>
        </footer>
      </div>
    </HelmetProvider>
  );
}

export default App;
"@ | Set-Content -Path "src\\App.tsx"

    @"
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

:root {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  background: #f4f2ed;
  color: #12110f;
}

a {
  color: inherit;
  text-decoration: none;
}

.page {
  background: radial-gradient(circle at top left, #fbe6c3 0%, #f4f2ed 45%, #e2e8f0 100%);
  min-height: 100vh;
}

.hero {
  padding: 48px 6vw 32px;
  position: relative;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  top: -120px;
  right: -120px;
  width: 320px;
  height: 320px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 208, 128, 0.7), rgba(255, 208, 128, 0));
  filter: blur(2px);
  z-index: 0;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.brand {
  font-family: 'Fraunces', serif;
  font-size: 1.4rem;
  font-weight: 700;
}

.nav-links {
  display: flex;
  gap: 18px;
  font-weight: 500;
}

.cta,
.ghost {
  border-radius: 999px;
  padding: 12px 22px;
  font-weight: 600;
  border: 1px solid #111;
  background: #111;
  color: #fefaf4;
}

.ghost {
  background: transparent;
  color: #111;
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  margin-top: 48px;
  position: relative;
  z-index: 1;
}

.hero-copy h1 {
  font-family: 'Fraunces', serif;
  font-size: clamp(2.4rem, 3vw + 1rem, 3.8rem);
  margin: 16px 0;
}

.subhead {
  font-size: 1.1rem;
  max-width: 480px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin: 24px 0 12px;
  flex-wrap: wrap;
}

.hero-meta {
  font-size: 0.95rem;
  opacity: 0.7;
}

.hero-card {
  background: #111;
  color: #fefaf4;
  padding: 28px;
  border-radius: 28px;
  display: grid;
  gap: 18px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
}

.stat {
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
}

.stat .value {
  font-weight: 700;
}

.card-note {
  font-size: 0.95rem;
  opacity: 0.7;
}

.section {
  padding: 56px 6vw;
}

.section-head {
  max-width: 680px;
}

.section-head h2 {
  font-family: 'Fraunces', serif;
  font-size: clamp(2rem, 2vw + 1rem, 2.8rem);
  margin-bottom: 12px;
}

.bento {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
  margin-top: 32px;
}

.tile {
  background: #fffaf0;
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(18, 17, 15, 0.1);
  box-shadow: 0 16px 30px rgba(17, 16, 15, 0.08);
}

.pricing {
  background: #111;
  color: #fefaf4;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
  margin-top: 32px;
}

.price-card {
  background: #1b1a18;
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.price-card.featured {
  background: #fefaf4;
  color: #111;
}

.price {
  font-size: 2rem;
  font-weight: 700;
}

.price span {
  font-size: 1rem;
  opacity: 0.7;
}

.price-card ul {
  list-style: none;
  padding: 0;
  margin: 16px 0 24px;
  display: grid;
  gap: 8px;
}

.faq {
  background: #fefaf4;
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
  margin-top: 24px;
}

.faq-item {
  background: #fff;
  border-radius: 18px;
  padding: 18px;
  border: 1px solid rgba(17, 16, 15, 0.08);
}

.cta-band {
  margin: 56px 6vw;
  padding: 32px;
  border-radius: 24px;
  background: linear-gradient(120deg, #fbd38d, #fefaf4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.footer {
  padding: 32px 6vw 48px;
  display: grid;
  gap: 16px;
}

.footer-links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.footer-note {
  font-size: 0.85rem;
  opacity: 0.6;
}

@media (max-width: 720px) {
  .nav {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-card {
    order: -1;
  }

  .cta-band {
    text-align: left;
  }
}
"@ | Set-Content -Path "src\\App.css"

    Write-Output "Landing page scaffolded. Next steps: npm run dev (http://localhost:5173) or dockerize on port $Port."
} finally {
    Pop-Location
}
