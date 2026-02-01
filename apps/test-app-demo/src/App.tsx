import './styles/design-system.css';
import './App.css';
import Button from './components/Button';

function App() {
  return (
    <div className="app">
      <div className="stack-lg" style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-2xl)' }}>
        <div className="text-center">
          <h1 style={{
            fontSize: 'var(--font-4xl)',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 'var(--space-md)'
          }}>
            Test App Demo
          </h1>
          <p style={{
            fontSize: 'var(--font-lg)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-xl)'
          }}>
            Your premium React application is ready with a modern design system!
          </p>
        </div>

        <div className="card">
          <div className="stack-md">
            <h2 style={{ fontSize: 'var(--font-xl)', marginBottom: 'var(--space-sm)' }}>
              Design System Features
            </h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ padding: 'var(--space-sm) 0' }}>✅ Modern color palette with CSS variables</li>
              <li style={{ padding: 'var(--space-sm) 0' }}>✅ Fluid typography scale</li>
              <li style={{ padding: 'var(--space-sm) 0' }}>✅ Consistent spacing system</li>
              <li style={{ padding: 'var(--space-sm) 0' }}>✅ Pre-built component library</li>
              <li style={{ padding: 'var(--space-sm) 0' }}>✅ Dark mode ready</li>
            </ul>
          </div>
        </div>

        <div className="flex-center" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
          <Button variant="primary" size="medium" onClick={() => alert('Primary button clicked!')}>
            Primary Action
          </Button>
          <Button variant="secondary" size="medium" onClick={() => alert('Secondary button clicked!')}>
            Secondary Action
          </Button>
        </div>

        <div className="card" style={{ marginTop: 'var(--space-xl)', background: 'var(--color-surface)' }}>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
            🎨 Customize your design system in <code>src/styles/design-system.css</code>
          </p>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
            🧩 Build components in <code>src/components/</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
