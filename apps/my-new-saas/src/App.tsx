import { Helmet, HelmetProvider } from 'react-helmet-async';
import './styles/design-system.css';
import './App.css';

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>MyNewSaaS</title>
        <meta name="description" content="The future of SaaS, simplified." />
      </Helmet>
      <div className="page">
        <header className="hero">
          <nav className="nav">
            <div className="brand">MyNewSaaS</div>
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
              <p className="subhead">The future of SaaS, simplified.</p>
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
              <p className="price"><span>/mo</span></p>
              <ul>
                <li>Automated onboarding</li>
                <li>Client portal</li>
                <li>Basic analytics</li>
              </ul>
              <button className="ghost">Choose Launch</button>
            </div>
            <div className="price-card featured">
              <h3>Scale</h3>
              <p className="price"><span>/mo</span></p>
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
            <p>Everything you need to know before switching to MyNewSaaS.</p>
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
            <p>Launch a premium client experience with MyNewSaaS today.</p>
          </div>
          <button className="cta">Start free trial</button>
        </section>

        <footer className="footer">
          <div className="brand">MyNewSaaS</div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="#">Privacy</a>
          </div>
          <div className="footer-note">© 2026 MyNewSaaS. All rights reserved.</div>
        </footer>
      </div>
    </HelmetProvider>
  );
}

export default App;

// Self-Reflection
// Issues Found: The initial workflow documentation had an incorrect file path for the PowerShell script. The `rmdir` command failed, requiring a PowerShell alternative.
// Fixes Applied: The script path was corrected. The directory was removed using a PowerShell command.
// Remaining Risks: The background `npm run dev` command could potentially fail silently. It's also possible that the generated landing page might not fully meet the user's expectations for a "premium SaaS landing page" and might require further customization.
// Confidence Score: 0.8