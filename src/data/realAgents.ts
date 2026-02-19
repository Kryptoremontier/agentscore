/**
 * Real AI Agents to register on Intuition Testnet
 * These are well-known, production AI agents used by millions
 */

export interface RealAgent {
  name: string
  description: string
  category: string
  website?: string
  twitter?: string
  github?: string
  tags?: string[]
  emoji?: string
}

export const AGENTS_TO_REGISTER: RealAgent[] = [
  {
    name: "ChatGPT",
    description: "OpenAI's flagship conversational AI assistant. Used by millions worldwide for writing, coding, analysis and more.",
    category: "general",
    website: "https://chat.openai.com",
    twitter: "https://twitter.com/OpenAI",
    tags: ["openai", "conversational", "general-purpose"],
    emoji: "🤖"
  },
  {
    name: "Claude",
    description: "Anthropic's AI assistant focused on safety and helpfulness. Known for nuanced reasoning and following complex instructions.",
    category: "general",
    website: "https://claude.ai",
    twitter: "https://twitter.com/AnthropicAI",
    tags: ["anthropic", "safety", "reasoning"],
    emoji: "🧠"
  },
  {
    name: "Gemini",
    description: "Google DeepMind's multimodal AI model. Handles text, images, audio and video with deep Google integration.",
    category: "multimodal",
    website: "https://gemini.google.com",
    twitter: "https://twitter.com/GoogleDeepMind",
    tags: ["google", "multimodal", "search"],
    emoji: "💎"
  },
  {
    name: "Perplexity AI",
    description: "AI-powered search engine that provides real-time answers with citations. The future of web search.",
    category: "search",
    website: "https://perplexity.ai",
    twitter: "https://twitter.com/perplexity_ai",
    tags: ["search", "real-time", "citations"],
    emoji: "🔍"
  },
  {
    name: "Cursor",
    description: "AI-first code editor built on VS Code. Helps developers write, edit and debug code using natural language.",
    category: "coding",
    website: "https://cursor.sh",
    twitter: "https://twitter.com/cursor_ai",
    tags: ["coding", "ide", "developer-tools"],
    emoji: "⌨️"
  },
  {
    name: "Midjourney",
    description: "Leading AI image generation model known for artistic quality and stunning visual outputs.",
    category: "image-generation",
    website: "https://midjourney.com",
    twitter: "https://twitter.com/midjourney",
    tags: ["image", "art", "creative"],
    emoji: "🎨"
  },
  {
    name: "GitHub Copilot",
    description: "AI pair programmer by GitHub and OpenAI. Autocompletes code and suggests entire functions in real-time.",
    category: "coding",
    website: "https://github.com/features/copilot",
    twitter: "https://twitter.com/github",
    tags: ["coding", "github", "autocomplete"],
    emoji: "👨‍💻"
  },
  {
    name: "Devin",
    description: "World's first fully autonomous AI software engineer by Cognition. Can complete entire engineering tasks independently.",
    category: "coding",
    website: "https://cognition.ai",
    twitter: "https://twitter.com/cognition_labs",
    tags: ["autonomous", "engineering", "agentic"],
    emoji: "🦾"
  }
]

export const AGENT_CATEGORIES = [
  { id: "all", label: "All Agents" },
  { id: "general", label: "General Purpose" },
  { id: "coding", label: "Coding" },
  { id: "search", label: "Search" },
  { id: "multimodal", label: "Multimodal" },
  { id: "image-generation", label: "Image Generation" },
]
