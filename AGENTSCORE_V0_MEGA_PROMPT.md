# 🎨 AGENTSCORE - MEGA PROMPT DLA V0.DEV

## 📋 INSTRUKCJA UŻYCIA

1. Wejdź na https://v0.dev
2. Skopiuj CAŁY prompt poniżej (sekcja po sekcji lub całość)
3. Wklej do v0
4. Iteruj z follow-up promptami
5. Eksportuj kod do Cursora

---

# 🚀 GŁÓWNY MEGA PROMPT

```
Create a complete, production-ready Web3 dApp interface for "AgentScore" - a decentralized trust verification platform for AI Agents built on Intuition Protocol.

## PROJECT CONTEXT

AgentScore is the trust layer for AI agents. Think of it as a decentralized reputation system where:
- AI agents are registered as on-chain identities (Atoms)
- Users stake $TRUST tokens to vouch for or against agents
- Trust scores emerge from collective economic signals
- Reports and attestations are permanently recorded on blockchain

The visual language should feel like a fusion of:
- Intuition Protocol's clean, sophisticated aesthetic
- Modern DeFi dashboards (Aave, Uniswap)
- Futuristic AI interfaces (think Westworld, Ex Machina)
- Professional data visualization platforms

## DESIGN SYSTEM

### Color Palette (STRICT):
- Background: Deep space black (#0A0A0F) with subtle blue undertones
- Primary surfaces: Dark navy (#0D1117, #161B22)
- Glass surfaces: rgba(13, 17, 23, 0.8) with backdrop-blur-xl
- Primary accent: Electric blue (#0066FF) - Intuition brand color
- Secondary accent: Cyan (#00D4FF) for highlights
- Success: Emerald (#10B981)
- Warning: Amber (#F59E0B)  
- Danger: Rose (#EF4444)
- Trust gradient: from-blue-500 via-cyan-400 to-emerald-400
- Text primary: White (#FFFFFF)
- Text secondary: Slate (#94A3B8)
- Text muted: Gray (#64748B)

### Typography:
- Font family: Inter (primary), JetBrains Mono (code/numbers)
- Hero headlines: 4xl-6xl, font-bold, tracking-tight
- Section titles: 2xl-3xl, font-semibold
- Body: base-lg, font-normal, leading-relaxed
- Data/numbers: JetBrains Mono, tabular-nums
- Trust scores: Extra bold, with gradient text effect

### Visual Effects:
- Glassmorphism: backdrop-blur-xl bg-white/5 border border-white/10
- Glow effects: box-shadow with colored blur (0 0 40px rgba(0,102,255,0.3))
- Gradient borders: Using pseudo-elements or border-image
- Subtle grid pattern overlay on backgrounds
- Animated gradient meshes for hero sections
- Floating orbs with blur for depth
- Micro-animations on all interactive elements

### Component Style:
- Border radius: rounded-xl (12px) for cards, rounded-full for badges
- Shadows: Layered, with colored glow on hover
- Borders: 1px border-white/10, gradient on focus
- Cards: Glass effect with subtle inner shadow
- Buttons: Gradient backgrounds, glow on hover, scale on press
- Inputs: Dark backgrounds, glowing border on focus

---

## PAGE 1: LANDING PAGE / HERO

Create an immersive landing page with the following sections:

### 1.1 Navigation Bar (sticky):
- Logo: Shield icon + "AgentScore" text with gradient
- Nav links: Explore, Leaderboard, Docs, About
- Right side: Network indicator pill (showing "Base" with green dot), Connect Wallet button
- Glass background that appears on scroll
- Mobile: Hamburger menu with slide-out drawer

### 1.2 Hero Section:
- Full viewport height with animated gradient mesh background
- Floating geometric shapes (hexagons, circles) with parallax effect
- Main headline: "The Trust Layer for AI Agents" with animated gradient text
- Subheadline: "Verify reputation before interaction. Stake conviction. Build the decentralized knowledge graph."
- Two CTA buttons:
  - Primary: "Explore Agents" (gradient blue, with glow, arrow icon)
  - Secondary: "Register Your Agent" (glass style, outline)
- Live stats ticker below CTAs:
  - "1,247 Agents Registered"
  - "$2.4M Trust Staked"
  - "89,432 Attestations"
- Animated 3D-style trust score visualization floating on the right (large circular gauge showing "87" with orbiting particles)

### 1.3 How It Works Section:
- Section title: "Trust, Verified On-Chain"
- Three-step horizontal flow with connecting lines:
  1. "Register" - Icon: User plus, Description: "Create an Atom for your AI agent on Intuition Protocol"
  2. "Attest" - Icon: Shield check, Description: "Stake $TRUST to vouch for agents you trust"
  3. "Verify" - Icon: Search, Description: "Check any agent's reputation before interaction"
- Each step in a glass card with hover lift effect
- Animated dotted line connecting the steps

### 1.4 Featured Agents Section:
- Section title: "Top Trusted Agents"
- Horizontal scrollable row of agent cards (show 4, peek 5th)
- Each card shows:
  - Agent avatar (robot icon with unique color)
  - Agent name
  - Platform badge (e.g., "Moltbook", "OpenClaw")
  - Trust score ring (animated)
  - Verified checkmark if score > 80
  - Quick "View" button
- "View All" link at the end

### 1.5 Stats/Social Proof Section:
- Dark glass container spanning full width
- Four large stat boxes in a row:
  - Total Agents: "1,247" with agent icon
  - Trust Volume: "$2.4M" with lock icon
  - Attestations: "89K+" with check icon
  - Active Users: "3,892" with users icon
- Each with animated counter effect
- Subtle pulse glow animation

### 1.6 CTA Section:
- Gradient border card
- Headline: "Ready to verify trust?"
- Two buttons: "Connect Wallet", "Read Docs"
- Background: Subtle animated gradient

### 1.7 Footer:
- Dark section with grid layout
- Columns: Product (Explore, Register, API), Resources (Docs, GitHub, Blog), Community (Twitter, Discord, Farcaster), Legal
- Bottom: Logo, "Built on Intuition Protocol", "Powered by $TRUST"
- Social icons row

---

## PAGE 2: AGENT EXPLORER

### 2.1 Page Header:
- Title: "Explore Agents"
- Subtitle: "Discover and verify AI agents across the ecosystem"
- Search bar: Large, prominent, with search icon, placeholder "Search by name, address, or platform..."
- Filter pills: All, Verified (✓), New, Most Trusted, Most Staked

### 2.2 Stats Bar:
- Horizontal glass bar with key metrics:
  - Total Agents, Verified Agents, Trust Staked Today, New This Week

### 2.3 Agent Grid:
- Responsive grid: 3 columns desktop, 2 tablet, 1 mobile
- Agent Card design:
  ```
  ┌─────────────────────────────────────┐
  │ [Avatar]  Agent Name       [Score] │
  │           @platform         ████░░ │
  │                              78    │
  ├─────────────────────────────────────┤
  │ Stakes: $12.4K  │  Attestations: 47│
  ├─────────────────────────────────────┤
  │ [Trust ↑]  [View Details →]        │
  └─────────────────────────────────────┘
  ```
  - Glass card with gradient border on hover
  - Trust score as circular progress ring
  - Color coded: green (70+), yellow (40-69), red (<40)
  - Verified badge for high-trust agents
  - Hover: subtle lift + glow effect

### 2.4 Pagination:
- Modern pagination with: Previous, page numbers, Next
- Or infinite scroll with "Load More" button

### 2.5 Empty State (when no results):
- Robot looking through magnifying glass illustration
- "No agents found"
- "Try adjusting your search or filters"
- "Register New Agent" CTA

### 2.6 Floating Action Button:
- Bottom right corner
- "+ Register Agent" with plus icon
- Gradient background, pulsing glow

---

## PAGE 3: AGENT DETAIL PAGE

### 3.1 Agent Header:
- Large banner area with gradient background
- Agent avatar (large, 120px, with ring matching trust score color)
- Agent name (2xl, bold)
- Platform badge + Verified badge (if applicable)
- Wallet address (truncated, with copy button)
- "Created X days ago" timestamp

### 3.2 Trust Score Hero:
- Centered, prominent trust score display:
  - Large circular ring (200px) with animated progress
  - Big number in center (e.g., "87")
  - Label below: "Trust Score"
  - Glow effect matching score color
- Below the ring, breakdown bars:
  - Positive Stakes: green bar with "$45.2K"
  - Negative Stakes: red bar with "$12.1K"
  - Net: "+$33.1K"

### 3.3 Action Buttons Row:
- Three primary actions in a row:
  - "Trust" button (green gradient, shield-check icon)
  - "Distrust" button (yellow/amber, shield-x icon)
  - "Report" button (red outline, flag icon)
- Each opens a modal for staking/reporting

### 3.4 Tabs Section:
- Tab navigation: Overview, Attestations, Activity, Analytics
- Glass tab bar with animated indicator

### 3.5 Overview Tab Content:
- Two-column layout:
  - Left: Agent description, metadata, tags
  - Right: Quick stats cards (Total Stakes, Unique Stakers, Reports, Age)
- Recent attestations preview (last 5)

### 3.6 Attestations Tab:
- List of all attestations (triples) about this agent
- Each item shows:
  - Attester avatar + name
  - Attestation type: "trusts", "reported_for_scam", etc.
  - Stake amount
  - Timestamp
  - Transaction link (external icon)
- Filter by type: Positive, Negative, Reports

### 3.7 Activity Tab:
- Timeline view of all actions involving this agent
- Activity types: Stakes added, Stakes removed, Reports, Score changes
- Each with icon, description, timestamp, tx link

### 3.8 Analytics Tab:
- Trust score history chart (line chart, 30 days)
- Stake distribution pie chart
- Top stakers list
- Geographic/platform distribution (if available)

---

## PAGE 4: REGISTER AGENT

### 4.1 Page Header:
- Title: "Register New Agent"
- Subtitle: "Add your AI agent to the trust network"
- Progress indicator: Step 1 of 3

### 4.2 Registration Form:
- Step 1: Basic Info
  - Agent Name (input with character count)
  - Description (textarea, 500 char max)
  - Platform (dropdown: Moltbook, OpenClaw, Farcaster, Custom)
  - Website URL (optional)
  
- Step 2: Verification
  - Wallet Address (auto-filled from connected wallet, or manual input)
  - Social verification options (Twitter, Farcaster, GitHub)
  - Verification badges explained
  
- Step 3: Review & Submit
  - Summary card showing all entered info
  - Estimated gas fee
  - "Create Atom" button (prominent, gradient)
  - Terms acceptance checkbox

### 4.3 Form Styling:
- Dark inputs with glowing focus states
- Inline validation with success/error icons
- Helper text below each field
- Smooth transitions between steps

### 4.4 Success State:
- Celebration animation (confetti or particles)
- "Agent Registered Successfully!"
- Agent card preview
- Share buttons (Twitter, Farcaster)
- "View Agent Page" CTA

---

## PAGE 5: STAKING MODAL

### 5.1 Modal Container:
- Centered modal with glass background
- Backdrop blur + dark overlay
- Close button (X) top right
- Smooth enter/exit animations

### 5.2 Modal Content for "Trust" Action:
- Header: "Stake Trust on [Agent Name]"
- Agent mini-card (avatar, name, current score)
- Divider
- Amount input:
  - Large input field for stake amount
  - Token selector showing $TRUST balance
  - Quick amount buttons: 25%, 50%, 75%, Max
  - USD equivalent shown below
- Slider for visual amount selection
- Preview section:
  - "You will receive: X shares"
  - "New trust score: ~89 (+2)"
  - "Your position: $X.XX"
- Warning banner (amber): "Staked tokens are locked. Withdrawing may incur a fee."
- Action buttons:
  - "Cancel" (ghost button)
  - "Stake Trust" (green gradient, with loading state)

### 5.3 Modal for "Report" Action:
- Header: "Report Agent"
- Report type selection (radio buttons):
  - Scam / Fraud
  - Spam
  - Prompt Injection
  - Impersonation
  - Other
- Description textarea (required)
- Evidence upload (optional)
- Stake amount for report (adds weight)
- Warning: "False reports may result in stake loss"
- Submit button (red)

### 5.4 Transaction States:
- Pending: Spinner + "Waiting for wallet confirmation..."
- Confirming: Progress bar + "Transaction confirming..."
- Success: Checkmark animation + "Trust staked successfully!"
- Error: X icon + error message + "Try Again" button

---

## COMPONENT: TRUST SCORE BADGE

Create a reusable trust score badge component with variants:

### Variants:
- Size: sm (40px), md (60px), lg (100px), xl (160px)
- Style: minimal (just number), ring (with progress), full (with label and glow)

### Features:
- Animated SVG progress ring
- Color transitions based on score:
  - 0-29: Red (#EF4444) with red glow
  - 30-49: Orange (#F97316) with orange glow
  - 50-69: Yellow (#EAB308) with yellow glow
  - 70-89: Green (#22C55E) with green glow
  - 90-100: Cyan (#06B6D4) with cyan glow + sparkle effect
- Number animates counting up on mount
- Pulse glow on hover
- Optional: trend indicator arrow (↑ or ↓)

---

## COMPONENT: WALLET CONNECT BUTTON

### States:
1. Disconnected:
   - Button text: "Connect Wallet"
   - Wallet icon
   - Gradient background
   - Glow on hover

2. Connecting:
   - Spinner
   - "Connecting..."
   - Disabled state

3. Connected:
   - Truncated address (0x1234...5678)
   - Identicon/avatar
   - Balance pill showing $TRUST balance
   - Dropdown on click:
     - Copy address
     - View on explorer
     - My Stakes
     - My Agents
     - Disconnect (red)

---

## COMPONENT: ATTESTATION CARD

Card showing a single attestation:
- Left: Attester avatar (32px)
- Middle:
  - Attester name (linked)
  - Action text: "trusts" / "reported" / "vouched for"
  - Target: Agent name
- Right:
  - Stake amount in $TRUST
  - Timestamp (relative: "2h ago")
- Bottom (expanded on hover):
  - Transaction hash link
  - Block number

---

## RESPONSIVE BEHAVIOR

- Desktop (1200px+): Full layout, 3-column grids
- Tablet (768-1199px): 2-column grids, collapsible sidebar
- Mobile (< 768px): 
  - Single column
  - Bottom navigation bar
  - Hamburger menu
  - Full-width cards
  - Stacked form fields
  - Touch-optimized buttons (min 44px height)

---

## MICRO-INTERACTIONS & ANIMATIONS

1. Page transitions: Fade + slight upward slide
2. Card hover: translateY(-4px) + shadow increase + border glow
3. Button press: scale(0.98) + darker shade
4. Score changes: Number counts up/down with easing
5. Loading states: Skeleton shimmer (dark to slightly lighter)
6. Success states: Checkmark draws in with SVG animation
7. Error shake: Horizontal shake animation
8. Toast notifications: Slide in from top-right
9. Modal: Fade in backdrop, scale up content
10. Tabs: Sliding indicator follows selection

---

## ACCESSIBILITY

- All interactive elements keyboard accessible
- Focus visible states with blue ring
- Aria labels on icon-only buttons
- Color contrast meeting WCAG AA
- Reduced motion support
- Screen reader announcements for state changes

---

## TECH REQUIREMENTS

- Use shadcn/ui components as base
- Tailwind CSS for all styling
- Framer Motion syntax for animations (or CSS animations)
- Lucide React icons
- Responsive with Tailwind breakpoints
- Dark mode only (no light mode toggle needed)

Generate the complete React/Next.js code with TypeScript types.
```

---

# 📝 FOLLOW-UP PROMPTS DLA ITERACJI

Po wygenerowaniu głównego designu, użyj tych promptów do dopracowania:

## Ulepszenia Hero:
```
Make the hero section more dramatic:
- Add animated particles floating upward
- Make the gradient mesh slowly morph and shift colors
- Add a subtle scan line effect overlay
- Make the trust score visualization 3D with depth
- Add a typing animation to the subheadline
```

## Ulepszenia Agent Card:
```
Improve the agent cards:
- Add a shine/shimmer effect on hover that sweeps across the card
- Make the trust score ring animate when card comes into view
- Add micro-interaction when clicking Trust button (pulse ripple)
- Show a mini chart sparkline of score history on hover
- Add skeleton loading state that matches the card layout
```

## Ulepszenia Score Display:
```
Make the trust score display more impressive:
- Add orbiting particles around the score ring
- Create a pulsing glow that intensifies based on score
- Add achievement badges around the score (e.g., "Top 10%", "Verified")
- Show score trend with animated arrow
- Add haptic-style pulse animation on score change
```

## Ulepszenia Form:
```
Improve the registration form UX:
- Add smooth step transitions with slide animation
- Show real-time validation as user types
- Add success checkmarks that animate in
- Create a more engaging progress bar
- Add helpful tooltips that appear on focus
```

## Mobile Optimization:
```
Optimize for mobile:
- Create a sticky bottom action bar for main CTAs
- Add pull-to-refresh animation
- Create swipeable agent cards
- Add haptic feedback indicators (visual pulse)
- Optimize touch targets (min 44px)
```

## Dark Mode Polish:
```
Enhance the dark theme:
- Add very subtle noise texture to backgrounds
- Create depth with multiple gradient layers
- Add ambient glow behind key elements
- Improve contrast for better readability
- Add subtle vignette effect on page edges
```

---

# 🎯 STRATEGIA UŻYCIA

## Krok 1: Landing Page
Zacznij od Landing Page - to pierwsze wrażenie.
Wklej sekcję "PAGE 1: LANDING PAGE" do v0.

## Krok 2: Komponenty Core
Następnie wygeneruj:
- Trust Score Badge
- Agent Card
- Wallet Connect Button

## Krok 3: Pozostałe strony
- Agent Explorer
- Agent Detail
- Register Form
- Staking Modal

## Krok 4: Integracja w Cursorze
Dla każdego wygenerowanego komponentu:
1. Skopiuj kod z v0
2. Wklej do Cursora
3. Poproś Claude'a o:
   - Dodanie TypeScript typów
   - Integrację z wagmi (wallet)
   - Integrację z Intuition SDK (real data)
   - Obsługę loading/error states

---

# 💡 PRO TIPS

1. **Generuj sekcjami** - v0 lepiej radzi sobie z mniejszymi, szczegółowymi promptami
2. **Iteruj** - nie próbuj uzyskać perfekcji za pierwszym razem
3. **Używaj follow-up** - v0 pamięta kontekst poprzednich generacji
4. **Testuj responsywność** - używaj preview w różnych rozmiarach
5. **Eksportuj z dependencies** - v0 pokaże jakie shadcn komponenty potrzebujesz

---

**Powodzenia! Stwórz coś pięknego! 🚀🎨**
