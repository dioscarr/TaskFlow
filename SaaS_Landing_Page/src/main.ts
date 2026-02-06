import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="landing-page">
    <header>
      <h1>Premium SaaS Product</h1>
      <p>The best solution for your needs.</p>
      <button>Get Started</button>
    </header>
    <section class="features">
      <h2>Key Features</h2>
      <ul>
        <li>Feature 1</li>
        <li>Feature 2</li>
        <li>Feature 3</li>
      </ul>
    </section>
    <footer>
      <p>&copy; 2026</p>
    </footer>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
