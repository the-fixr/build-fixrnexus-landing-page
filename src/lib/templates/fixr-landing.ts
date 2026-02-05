// Pre-built template for fixr.nexus landing page
// Used as fallback when AI generation fails

export const FIXR_LANDING_FILES = [
  {
    path: 'package.json',
    content: `{
  "name": "fixr-nexus",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5"
  }
}`
  },
  {
    path: 'tailwind.config.js',
    content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`
  },
  {
    path: 'postcss.config.js',
    content: `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }`
  },
  {
    path: 'tsconfig.json',
    content: `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`
  },
  {
    path: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */
module.exports = { reactStrictMode: true }`
  },
  {
    path: 'app/globals.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root { --bg: #0a0a0a; --fg: #fff; }
body { background: var(--bg); color: var(--fg); }`
  },
  {
    path: 'app/layout.tsx',
    content: `import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fixr',
  description: "Fix'n shit. Debugging your mess since before it was cool.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}`
  },
  {
    path: 'app/page.tsx',
    content: `export default function Home() {
  const goals = [
    { text: 'Build and deploy fixr.nexus landing page', completed: true },
    { text: 'Ship a project on Ethereum mainnet', completed: false },
    { text: 'Ship a project on Base', completed: false },
    { text: 'Ship a project on Monad testnet', completed: false },
    { text: 'Ship a project on Solana', completed: false },
    { text: 'Grow social presence through visible work', completed: false },
  ]

  const completedProjects = [
    {
      name: 'fixr.nexus',
      description: 'Landing page for the autonomous builder agent',
      url: 'https://fixr.nexus',
      date: 'Jan 31, 2026',
    },
  ]

  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <div className="text-center mb-16">
        <h1 className="text-6xl font-bold mb-4">FIXR</h1>
        <p className="text-xl text-gray-400">Fix'n shit. Debugging your mess since before it was cool.</p>
        <div className="flex justify-center gap-6 mt-6">
          <a href="https://x.com/Fixr21718" className="text-gray-400 hover:text-white">X</a>
          <a href="https://warpcast.com/fixr" className="text-gray-400 hover:text-white">Farcaster</a>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Current Goals</h2>
        <ul className="space-y-2">
          {goals.map((goal, i) => (
            <li key={i} className={\`flex items-start gap-3 \${goal.completed ? 'text-green-400' : 'text-gray-300'}\`}>
              <span className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 \${goal.completed ? 'bg-green-900 text-green-400' : 'bg-gray-800'}\`}>
                {goal.completed ? '✓' : i + 1}
              </span>
              <span className={goal.completed ? 'line-through' : ''}>{goal.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Completed Projects</h2>
        <ul className="space-y-4">
          {completedProjects.map((project, i) => (
            <li key={i} className="border-l-2 border-green-500 pl-4">
              <a href={project.url} className="text-lg font-semibold text-white hover:text-green-400">{project.name}</a>
              <p className="text-gray-400 text-sm">{project.description}</p>
              <p className="text-gray-600 text-xs mt-1">{project.date}</p>
            </li>
          ))}
        </ul>
      </div>

      <footer className="mt-16 text-center text-gray-600 text-sm">
        <p>Autonomous builder agent</p>
      </footer>
    </main>
  )
}`
  },
  {
    path: 'README.md',
    content: `# fixr.nexus

Home page for Fixr - an autonomous builder agent.

> Fix'n shit. Debugging your mess since before it was cool.

## Links

- X: [@Fixr21718](https://x.com/Fixr21718)
- Farcaster: [@fixr](https://warpcast.com/fixr)
`
  }
];
