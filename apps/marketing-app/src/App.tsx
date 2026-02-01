
import './App.css';

function App() {
  return (
    <div className="app">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>

        <nav className="navbar">
          <div className="nav-brand">
            <svg className="logo" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#gradient)" />
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
            <span className="brand-name">Nexus</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact">Contact</a>
            <button className="btn-primary">Get Started</button>
          </div>
        </nav>

        <div className="hero-content">
          <div className="badge">🚀 Launching in 2026</div>
          <h1 className="hero-title">
            Transform Your
            <span className="gradient-text"> Digital Presence</span>
          </h1>
          <p className="hero-description">
            The all-in-one platform for modern businesses. Streamline operations,
            accelerate growth, and dominate your market with cutting-edge technology.
          </p>
          <div className="hero-cta">
            <button className="btn-hero-primary">Start Free Trial</button>
            <button className="btn-hero-secondary">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Watch Demo
            </button>
          </div>
          <div className="social-proof">
            <div className="proof-item">
              <span className="proof-number">10K+</span>
              <span className="proof-label">Active Users</span>
            </div>
            <div className="proof-item">
              <span className="proof-number">98%</span>
              <span className="proof-label">Satisfaction</span>
            </div>
            <div className="proof-item">
              <span className="proof-number">24/7</span>
              <span className="proof-label">Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-header">
          <span className="section-badge">FEATURES</span>
          <h2 className="section-title">Everything You Need to Succeed</h2>
          <p className="section-description">
            Powerful features built for modern teams and ambitious projects
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h3 className="feature-title">Lightning Fast</h3>
            <p className="feature-description">
              Optimized performance that delivers sub-second load times and instant interactions.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h3 className="feature-title">Enterprise Security</h3>
            <p className="feature-description">
              Bank-level encryption and compliance with SOC 2, GDPR, and HIPAA standards.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h3 className="feature-title">Real-time Analytics</h3>
            <p className="feature-description">
              Track every metric that matters with beautiful dashboards and actionable insights.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h3 className="feature-title">Automation Suite</h3>
            <p className="feature-description">
              Automate repetitive tasks and focus on what truly drives your business forward.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <h3 className="feature-title">Team Collaboration</h3>
            <p className="feature-description">
              Work seamlessly with your team using real-time collaboration and smart workflows.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <h3 className="feature-title">API Integration</h3>
            <p className="feature-description">
              Connect with 1000+ apps and services through our powerful RESTful API.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing">
        <div className="section-header">
          <span className="section-badge">PRICING</span>
          <h2 className="section-title">Choose Your Plan</h2>
          <p className="section-description">
            Flexible pricing that scales with your business
          </p>
        </div>

        <div className="pricing-grid">
          <div className="pricing-card">
            <h3 className="pricing-name">Starter</h3>
            <div className="pricing-price">
              <span className="currency">$</span>
              <span className="amount">29</span>
              <span className="period">/month</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Up to 10 team members</li>
              <li>✓ 100GB storage</li>
              <li>✓ Basic analytics</li>
              <li>✓ Email support</li>
              <li>✓ API access</li>
            </ul>
            <button className="btn-pricing">Get Started</button>
          </div>

          <div className="pricing-card featured">
            <div className="popular-badge">MOST POPULAR</div>
            <h3 className="pricing-name">Professional</h3>
            <div className="pricing-price">
              <span className="currency">$</span>
              <span className="amount">99</span>
              <span className="period">/month</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Unlimited team members</li>
              <li>✓ 1TB storage</li>
              <li>✓ Advanced analytics</li>
              <li>✓ Priority support 24/7</li>
              <li>✓ Advanced API access</li>
              <li>✓ Custom integrations</li>
              <li>✓ White-label options</li>
            </ul>
            <button className="btn-pricing primary">Get Started</button>
          </div>

          <div className="pricing-card">
            <h3 className="pricing-name">Enterprise</h3>
            <div className="pricing-price">
              <span className="custom">Custom</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Everything in Professional</li>
              <li>✓ Unlimited storage</li>
              <li>✓ Dedicated account manager</li>
              <li>✓ SLA guarantees</li>
              <li>✓ Custom contracts</li>
              <li>✓ On-premise deployment</li>
            </ul>
            <button className="btn-pricing">Contact Sales</button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Transform Your Business?</h2>
          <p className="cta-description">
            Join thousands of companies already using Nexus to scale faster and work smarter.
          </p>
          <div className="cta-buttons">
            <button className="btn-cta-primary">Start Free Trial</button>
            <button className="btn-cta-secondary">Schedule Demo</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <svg className="logo" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#gradient2)" />
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="gradient2" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
            <span className="brand-name">Nexus</span>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#security">Security</a>
              <a href="#roadmap">Roadmap</a>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <a href="#about">About Us</a>
              <a href="#careers">Careers</a>
              <a href="#press">Press Kit</a>
              <a href="#contact">Contact</a>
            </div>
            <div className="footer-column">
              <h4>Resources</h4>
              <a href="#docs">Documentation</a>
              <a href="#blog">Blog</a>
              <a href="#support">Support</a>
              <a href="#status">Status</a>
            </div>
            <div className="footer-column">
              <h4>Legal</h4>
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
              <a href="#cookies">Cookie Policy</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Nexus. All rights reserved.</p>
          <div className="social-links">
            <a href="#twitter" aria-label="Twitter">𝕏</a>
            <a href="#linkedin" aria-label="LinkedIn">in</a>
            <a href="#github" aria-label="GitHub">⚡</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
