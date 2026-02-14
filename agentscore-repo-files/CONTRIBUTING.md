# Contributing to AgentScore

First off, thank you for considering contributing to AgentScore! 🎉

It's people like you that make AgentScore such a great tool for the AI agent ecosystem.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🤔 How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

When creating a bug report, include:
- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **Environment** (browser, OS, wallet)

### 💡 Suggesting Features

We love feature suggestions! Please:
- Check if the feature has already been suggested
- Provide a clear description of the feature
- Explain why this feature would be useful
- Include mockups or examples if possible

### 🔧 Code Contributions

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## 🛠️ Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/agentscore.git
cd agentscore

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Project Structure

```
agentscore/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions
│   └── types/         # TypeScript types
├── public/            # Static assets
└── ...config files
```

## 📝 Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features
3. **Ensure build passes**: `npm run build`
4. **Follow style guidelines** (see below)
5. **Get review** from at least one maintainer

### PR Title Format

```
type(scope): description

Examples:
feat(staking): add bonding curve preview
fix(wallet): resolve connection timeout
docs(readme): update installation steps
style(ui): improve card hover effects
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 🎨 Style Guidelines

### TypeScript

- Use **strict mode**
- Prefer **interfaces** over types for objects
- Use **descriptive variable names**
- Add **JSDoc comments** for public functions

```typescript
// ✅ Good
interface AgentCardProps {
  agent: Agent
  onTrust: (agentId: string) => void
}

// ❌ Bad
type Props = {
  a: any
  cb: Function
}
```

### React Components

- Use **functional components** with hooks
- Keep components **small and focused**
- Use **semantic HTML**
- Follow **accessibility** best practices

```tsx
// ✅ Good
export function AgentCard({ agent, onTrust }: AgentCardProps) {
  return (
    <article className="glass-card p-6">
      <h3>{agent.name}</h3>
      <button onClick={() => onTrust(agent.id)}>
        Trust
      </button>
    </article>
  )
}
```

### CSS / Tailwind

- Use **Tailwind utilities** when possible
- Create **custom classes** for repeated patterns
- Follow **mobile-first** approach
- Use **CSS variables** for theming

### Git Commits

- Use **present tense** ("Add feature" not "Added feature")
- Use **imperative mood** ("Move cursor to..." not "Moves cursor to...")
- Keep commits **atomic** and **focused**

## 🌐 Community

- **Twitter**: [@Kryptoremontier](https://twitter.com/Kryptoremontier)
- **Farcaster**: [/Kryptoremontier](https://warpcast.com/Kryptoremontier)
- **Discord**: Coming soon

## ❓ Questions?

Feel free to open an issue with the `question` label or reach out on social media.

---

**Thank you for contributing to the future of AI trust!** 🛡️
