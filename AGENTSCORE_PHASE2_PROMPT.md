# 🚀 AGENTSCORE PHASE 2 - MEGA PROMPT DLA CURSOR

## 📋 INSTRUKCJA UŻYCIA

1. Umieść ten plik w głównym folderze projektu
2. W Cursor Composer (Ctrl+I) wpisz:
```
@AGENTSCORE_PHASE2_PROMPT.md

Przeczytaj cały dokument i zacznij implementację od MODUŁU 1.
Implementuj moduł po module, czekając na moje "kontynuuj".
```

---

# 🎯 KONTEKST PROJEKTU

AgentScore to zdecentralizowana platforma weryfikacji reputacji AI Agentów na Intuition Protocol.

## Obecny stan (Phase 1 - DONE):
- ✅ Landing Page z Hero, Stats
- ✅ Agent Explorer z podstawową listą
- ✅ Agent Details z trust score
- ✅ Registration System
- ✅ Premium glassmorphism UI
- ✅ Wallet connection (wagmi)

## Phase 2 - DO ZAIMPLEMENTOWANIA:
- 🔲 System profili użytkowników
- 🔲 Avatary dla profili i agentów
- 🔲 Zaawansowane filtrowanie (kategorie, trust level)
- 🔲 System odznak ekspertów
- 🔲 Tokenomics $TRUST (bonding curves, staking, fees)

---

# 📦 MODUŁ 1: SYSTEM PROFILI UŻYTKOWNIKÓW

## 1.1 Typy danych

Utwórz/zaktualizuj `src/types/user.ts`:

```typescript
export interface UserProfile {
  // Podstawowe dane
  address: `0x${string}`
  
  // Opcjonalne dane profilu
  name?: string
  bio?: string
  avatar?: string                    // IPFS hash lub URL
  website?: string
  twitter?: string
  farcaster?: string
  
  // Statystyki
  stats: UserStats
  
  // Odznaki
  badges: UserBadge[]
  expertLevel: ExpertLevel
  
  // Relacje
  registeredAgents: string[]         // Agent IDs które zarejestrował
  supportedAgents: AgentSupport[]    // Agenty które wspiera
  
  // Timestamps
  joinedAt: Date
  lastActiveAt: Date
}

export interface UserStats {
  totalAgentsRegistered: number
  totalTrustStaked: bigint           // Suma wszystkich stake'ów
  totalAttestations: number          // Ile razy atestował
  trustReceived: bigint              // Ile $TRUST otrzymał (jako agent owner)
  reputation: number                 // 0-100, wyliczane z aktywności
}

export interface AgentSupport {
  agentId: string
  stakedAmount: bigint
  shares: bigint                     // Udziały w bonding curve
  stakedAt: Date
  currentValue: bigint               // Aktualna wartość udziałów
  profitLoss: bigint                 // Zysk/strata
}

export interface UserBadge {
  id: string
  type: BadgeType
  name: string
  description: string
  icon: string
  earnedAt: Date
  level?: number                     // Dla badges z poziomami (Bronze, Silver, Gold)
}

export type BadgeType = 
  | 'early_adopter'                  // Pierwsi 1000 użytkowników
  | 'trusted_expert'                 // Trust score > 90
  | 'prolific_supporter'             // Wspiera > 50 agentów
  | 'agent_creator'                  // Stworzył agenta z score > 80
  | 'whale'                          // Stakuje > 10K $TRUST
  | 'community_pillar'               // > 100 attestations
  | 'verified_identity'              // Przeszedł KYC/social verification

export type ExpertLevel = 
  | 'newcomer'                       // Brak odznak
  | 'contributor'                    // 1-2 odznaki
  | 'expert'                         // 3-4 odznaki
  | 'master'                         // 5+ odznak
  | 'legend'                         // Wszystkie odznaki + top 1%

// Waga głosu eksperta przy attestations
export const EXPERT_WEIGHT: Record<ExpertLevel, number> = {
  newcomer: 1.0,
  contributor: 1.25,
  expert: 1.5,
  master: 2.0,
  legend: 3.0,
}
```

## 1.2 Strona Profilu

Utwórz `src/app/profile/page.tsx`:

```tsx
'use client'

import { useAccount } from 'wagmi'
import { redirect } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  User, Settings, Shield, TrendingUp, Award,
  ExternalLink, Copy, Check, Camera, Edit
} from 'lucide-react'
import { useState } from 'react'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { MyAgents } from '@/components/profile/MyAgents'
import { MySupportedAgents } from '@/components/profile/MySupportedAgents'
import { MyBadges } from '@/components/profile/MyBadges'
import { ProfileSettings } from '@/components/profile/ProfileSettings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserProfile } from '@/hooks/useUserProfile'

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const { profile, isLoading, updateProfile } = useUserProfile(address)
  
  // Redirect jeśli nie połączony
  if (!isConnected) {
    redirect('/')
  }
  
  if (isLoading) {
    return <ProfileSkeleton />
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Profile Header */}
        <ProfileHeader profile={profile} onUpdate={updateProfile} />
        
        {/* Stats Overview */}
        <ProfileStats stats={profile.stats} badges={profile.badges} />
        
        {/* Tabs */}
        <Tabs defaultValue="agents" className="mt-8">
          <TabsList className="glass p-1 mb-6">
            <TabsTrigger value="agents" className="data-[state=active]:bg-white/10">
              <Shield className="w-4 h-4 mr-2" />
              My Agents
            </TabsTrigger>
            <TabsTrigger value="supporting" className="data-[state=active]:bg-white/10">
              <TrendingUp className="w-4 h-4 mr-2" />
              Supporting
            </TabsTrigger>
            <TabsTrigger value="badges" className="data-[state=active]:bg-white/10">
              <Award className="w-4 h-4 mr-2" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-white/10">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="agents">
            <MyAgents agents={profile.registeredAgents} />
          </TabsContent>
          
          <TabsContent value="supporting">
            <MySupportedAgents supports={profile.supportedAgents} />
          </TabsContent>
          
          <TabsContent value="badges">
            <MyBadges badges={profile.badges} expertLevel={profile.expertLevel} />
          </TabsContent>
          
          <TabsContent value="settings">
            <ProfileSettings profile={profile} onUpdate={updateProfile} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 animate-pulse">
        {/* Header skeleton */}
        <div className="glass-card p-8 mb-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/10" />
            <div className="space-y-3">
              <div className="h-8 w-48 bg-white/10 rounded" />
              <div className="h-4 w-32 bg-white/10 rounded" />
            </div>
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="glass-card p-6 h-24 bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  )
}
```

## 1.3 Profile Header Component

Utwórz `src/components/profile/ProfileHeader.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Edit, Check, X, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { UserProfile } from '@/types/user'

interface ProfileHeaderProps {
  profile: UserProfile
  onUpdate: (data: Partial<UserProfile>) => Promise<void>
}

export function ProfileHeader({ profile, onUpdate }: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(profile.name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(profile.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // TODO: Upload to IPFS
    // const ipfsHash = await uploadToIPFS(file)
    // await onUpdate({ avatar: ipfsHash })
    
    // Tymczasowo: local preview
    const reader = new FileReader()
    reader.onload = (event) => {
      onUpdate({ avatar: event.target?.result as string })
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    await onUpdate({ name, bio })
    setIsEditing(false)
  }

  const getExpertBadgeColor = (level: string) => {
    switch (level) {
      case 'legend': return 'from-yellow-400 to-amber-600'
      case 'master': return 'from-purple-400 to-violet-600'
      case 'expert': return 'from-blue-400 to-cyan-600'
      case 'contributor': return 'from-emerald-400 to-green-600'
      default: return 'from-slate-400 to-slate-600'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8 mb-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        
        {/* Avatar */}
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent-cyan">
            {profile.avatar ? (
              <img 
                src={profile.avatar} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold">
                {profile.name?.[0] || profile.address.slice(2, 4).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* Avatar upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'absolute inset-0 rounded-full flex items-center justify-center',
              'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
              'cursor-pointer'
            )}
          >
            <Camera className="w-6 h-6" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          
          {/* Expert level badge */}
          <div className={cn(
            'absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold',
            'bg-gradient-to-r text-white capitalize',
            getExpertBadgeColor(profile.expertLevel)
          )}>
            {profile.expertLevel}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xl font-bold focus:outline-none focus:border-primary"
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short bio..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Check className="w-4 h-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  {profile.name || 'Anonymous User'}
                </h1>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              
              {profile.bio && (
                <p className="text-slate-400 mt-1">{profile.bio}</p>
              )}
              
              {/* Address */}
              <div className="flex items-center gap-2 mt-3">
                <code className="text-sm text-slate-500 font-mono">
                  {profile.address.slice(0, 6)}...{profile.address.slice(-4)}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <a
                  href={`https://basescan.org/address/${profile.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              </div>
              
              {/* Social links */}
              {(profile.twitter || profile.farcaster) && (
                <div className="flex items-center gap-3 mt-3">
                  {profile.twitter && (
                    <a
                      href={`https://twitter.com/${profile.twitter}`}
                      target="_blank"
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      @{profile.twitter}
                    </a>
                  )}
                  {profile.farcaster && (
                    <a
                      href={`https://warpcast.com/${profile.farcaster}`}
                      target="_blank"
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      /{profile.farcaster}
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-2xl font-bold font-mono">{profile.stats.totalAgentsRegistered}</div>
            <div className="text-xs text-slate-500">Agents</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {(Number(profile.stats.totalTrustStaked) / 1e18).toFixed(1)}K
            </div>
            <div className="text-xs text-slate-500">$TRUST Staked</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono">{profile.badges.length}</div>
            <div className="text-xs text-slate-500">Badges</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
```

## 1.4 Zaktualizuj Wallet Dropdown

Zaktualizuj `src/components/wallet/WalletButton.tsx` aby dodać link do profilu:

```tsx
// W DropdownMenuContent dodaj:

<DropdownMenuItem asChild>
  <Link href="/profile" className="flex items-center">
    <User className="w-4 h-4 mr-2" />
    My Profile
  </Link>
</DropdownMenuItem>

<DropdownMenuItem asChild>
  <Link href="/profile?tab=agents" className="flex items-center">
    <Shield className="w-4 h-4 mr-2" />
    My Agents
  </Link>
</DropdownMenuItem>

<DropdownMenuSeparator />
```

---

# 📦 MODUŁ 2: AVATARY DLA AGENTÓW

## 2.1 Zaktualizuj Agent Type

W `src/types/agent.ts` dodaj:

```typescript
export interface Agent {
  // ... existing fields ...
  
  // Avatar
  avatar?: string                    // IPFS hash lub URL
  
  // Owner info
  owner: {
    address: `0x${string}`
    name?: string
    avatar?: string
    expertLevel: ExpertLevel
  }
}
```

## 2.2 Agent Avatar Upload Component

Utwórz `src/components/agents/AgentAvatar.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { Camera, Shield, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface AgentAvatarProps {
  avatar?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  editable?: boolean
  onAvatarChange?: (avatarUrl: string) => Promise<void>
  trustScore?: number
  verified?: boolean
}

const sizeClasses = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-lg',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-32 h-32 text-4xl',
}

export function AgentAvatar({
  avatar,
  name,
  size = 'md',
  editable = false,
  onAvatarChange,
  trustScore,
  verified,
}: AgentAvatarProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onAvatarChange) return

    setIsUploading(true)
    try {
      // TODO: Upload to IPFS
      // const ipfsHash = await uploadToIPFS(file)
      // await onAvatarChange(`ipfs://${ipfsHash}`)
      
      // Tymczasowo: data URL
      const reader = new FileReader()
      reader.onload = async (event) => {
        await onAvatarChange(event.target?.result as string)
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Upload failed:', error)
      setIsUploading(false)
    }
  }

  const getTrustColor = () => {
    if (!trustScore) return 'from-primary to-accent-cyan'
    if (trustScore >= 70) return 'from-emerald-500 to-cyan-500'
    if (trustScore >= 50) return 'from-amber-500 to-orange-500'
    return 'from-red-500 to-rose-500'
  }

  return (
    <div className="relative group">
      {/* Avatar container */}
      <div
        className={cn(
          'rounded-xl overflow-hidden bg-gradient-to-br flex items-center justify-center',
          sizeClasses[size],
          getTrustColor()
        )}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Shield className="w-1/2 h-1/2 text-white" />
        )}
        
        {/* Upload overlay */}
        {editable && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              'absolute inset-0 rounded-xl flex items-center justify-center',
              'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
              'cursor-pointer'
            )}
          >
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Camera className="w-6 h-6" />
            )}
          </button>
        )}
      </div>
      
      {/* Verified badge */}
      {verified && (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[rgb(10,10,15)]">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      
      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </div>
  )
}
```

---

# 📦 MODUŁ 3: ZAAWANSOWANE FILTROWANIE AGENT EXPLORER

## 3.1 Typy kategorii

Dodaj do `src/types/agent.ts`:

```typescript
export type AgentCategory = 
  | 'coding'           // Coding assistants
  | 'writing'          // Content creation
  | 'data'             // Data analysis
  | 'trading'          // Trading bots
  | 'social'           // Social media
  | 'gaming'           // Gaming
  | 'defi'             // DeFi agents
  | 'nft'              // NFT tools
  | 'research'         // Research assistants
  | 'customer_service' // Support bots
  | 'other'            // Other

export const AGENT_CATEGORIES: Record<AgentCategory, { label: string; icon: string; color: string }> = {
  coding: { label: 'Coding', icon: 'Code', color: 'blue' },
  writing: { label: 'Writing', icon: 'PenTool', color: 'purple' },
  data: { label: 'Data', icon: 'BarChart', color: 'cyan' },
  trading: { label: 'Trading', icon: 'TrendingUp', color: 'green' },
  social: { label: 'Social', icon: 'MessageCircle', color: 'pink' },
  gaming: { label: 'Gaming', icon: 'Gamepad', color: 'orange' },
  defi: { label: 'DeFi', icon: 'Wallet', color: 'emerald' },
  nft: { label: 'NFT', icon: 'Image', color: 'violet' },
  research: { label: 'Research', icon: 'Search', color: 'yellow' },
  customer_service: { label: 'Support', icon: 'Headphones', color: 'teal' },
  other: { label: 'Other', icon: 'MoreHorizontal', color: 'slate' },
}

export interface AgentFilters {
  search: string
  categories: AgentCategory[]
  trustRange: [number, number]      // [min, max]
  verifiedOnly: boolean
  sortBy: 'trust' | 'staked' | 'newest' | 'attestations'
  sortOrder: 'asc' | 'desc'
}
```

## 3.2 Filter Component

Utwórz `src/components/agents/AgentFilters.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Filter, X, ChevronDown, Check,
  Code, PenTool, BarChart, TrendingUp, MessageCircle,
  Gamepad, Wallet, Image, Headphones, MoreHorizontal
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { AGENT_CATEGORIES, type AgentCategory, type AgentFilters } from '@/types/agent'
import { Slider } from '@/components/ui/slider'

interface AgentFiltersProps {
  filters: AgentFilters
  onChange: (filters: AgentFilters) => void
  totalResults: number
}

const categoryIcons: Record<AgentCategory, React.ComponentType<{ className?: string }>> = {
  coding: Code,
  writing: PenTool,
  data: BarChart,
  trading: TrendingUp,
  social: MessageCircle,
  gaming: Gamepad,
  defi: Wallet,
  nft: Image,
  research: Search,
  customer_service: Headphones,
  other: MoreHorizontal,
}

export function AgentFilters({ filters, onChange, totalResults }: AgentFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)

  const updateFilter = <K extends keyof AgentFilters>(key: K, value: AgentFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleCategory = (category: AgentCategory) => {
    const current = filters.categories
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category]
    updateFilter('categories', updated)
  }

  const clearFilters = () => {
    onChange({
      search: '',
      categories: [],
      trustRange: [0, 100],
      verifiedOnly: false,
      sortBy: 'trust',
      sortOrder: 'desc',
    })
  }

  const hasActiveFilters = 
    filters.categories.length > 0 ||
    filters.trustRange[0] > 0 ||
    filters.trustRange[1] < 100 ||
    filters.verifiedOnly

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search agents by name, description, or address..."
            className={cn(
              'w-full pl-12 pr-4 py-3 rounded-xl',
              'bg-white/5 border border-white/10',
              'focus:outline-none focus:border-primary focus:bg-white/10',
              'transition-all duration-200'
            )}
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl',
            'border transition-all duration-200',
            showFilters || hasActiveFilters
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          )}
        >
          <Filter className="w-5 h-5" />
          Filters
          {hasActiveFilters && (
            <span className="w-5 h-5 rounded-full bg-primary text-xs flex items-center justify-center">
              {filters.categories.length + (filters.verifiedOnly ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-6 space-y-6">
              
              {/* Categories */}
              <div>
                <label className="text-sm font-medium text-slate-400 mb-3 block">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(AGENT_CATEGORIES) as [AgentCategory, typeof AGENT_CATEGORIES[AgentCategory]][]).map(
                    ([key, { label }]) => {
                      const Icon = categoryIcons[key]
                      const isActive = filters.categories.includes(key)
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCategory(key)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                            'border transition-all duration-200',
                            isActive
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                          {isActive && <Check className="w-3 h-3" />}
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              {/* Trust Score Range */}
              <div>
                <label className="text-sm font-medium text-slate-400 mb-3 block">
                  Trust Score: {filters.trustRange[0]} - {filters.trustRange[1]}
                </label>
                <div className="px-2">
                  <Slider
                    value={filters.trustRange}
                    onValueChange={(value) => updateFilter('trustRange', value as [number, number])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>0 (Critical)</span>
                  <span>50 (Moderate)</span>
                  <span>100 (Excellent)</span>
                </div>
              </div>

              {/* Verified Only Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-400">
                  Verified agents only
                </label>
                <button
                  onClick={() => updateFilter('verifiedOnly', !filters.verifiedOnly)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors duration-200',
                    filters.verifiedOnly ? 'bg-primary' : 'bg-white/10'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white transition-transform duration-200',
                      filters.verifiedOnly ? 'translate-x-6' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-slate-400">Sort by:</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value as AgentFilters['sortBy'])}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="trust">Trust Score</option>
                  <option value="staked">Total Staked</option>
                  <option value="newest">Newest</option>
                  <option value="attestations">Attestations</option>
                </select>
                
                <button
                  onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {filters.sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="text-sm text-slate-400">
        Showing <span className="text-white font-medium">{totalResults}</span> agents
        {hasActiveFilters && ' (filtered)'}
      </div>
    </div>
  )
}
```

---

# 📦 MODUŁ 4: SYSTEM ODZNAK EKSPERTÓW

## 4.1 Definicje odznak

Utwórz `src/lib/badges.ts`:

```typescript
import type { BadgeType, UserBadge, UserStats, ExpertLevel } from '@/types/user'

export interface BadgeDefinition {
  id: BadgeType
  name: string
  description: string
  icon: string                       // Lucide icon name
  color: string                      // Tailwind color
  requirement: (stats: UserStats) => boolean
  progress?: (stats: UserStats) => number  // 0-100 progress to earning
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined during beta phase',
    icon: 'Sparkles',
    color: 'amber',
    requirement: () => false,        // Manually granted
  },
  {
    id: 'trusted_expert',
    name: 'Trusted Expert',
    description: 'Personal reputation score above 90',
    icon: 'Award',
    color: 'emerald',
    requirement: (stats) => stats.reputation >= 90,
    progress: (stats) => Math.min(100, (stats.reputation / 90) * 100),
  },
  {
    id: 'prolific_supporter',
    name: 'Prolific Supporter',
    description: 'Supporting more than 50 agents',
    icon: 'Heart',
    color: 'pink',
    requirement: (stats) => stats.totalAttestations >= 50,
    progress: (stats) => Math.min(100, (stats.totalAttestations / 50) * 100),
  },
  {
    id: 'agent_creator',
    name: 'Agent Creator',
    description: 'Created an agent with trust score above 80',
    icon: 'Cpu',
    color: 'cyan',
    requirement: (stats) => stats.totalAgentsRegistered > 0, // Simplified
  },
  {
    id: 'whale',
    name: 'Whale',
    description: 'Staked more than 10,000 $TRUST',
    icon: 'Coins',
    color: 'blue',
    requirement: (stats) => Number(stats.totalTrustStaked) / 1e18 >= 10000,
    progress: (stats) => Math.min(100, (Number(stats.totalTrustStaked) / 1e18 / 10000) * 100),
  },
  {
    id: 'community_pillar',
    name: 'Community Pillar',
    description: 'Made more than 100 attestations',
    icon: 'Users',
    color: 'violet',
    requirement: (stats) => stats.totalAttestations >= 100,
    progress: (stats) => Math.min(100, (stats.totalAttestations / 100) * 100),
  },
  {
    id: 'verified_identity',
    name: 'Verified Identity',
    description: 'Completed identity verification',
    icon: 'ShieldCheck',
    color: 'green',
    requirement: () => false,        // Manually verified
  },
]

export function calculateExpertLevel(badges: UserBadge[]): ExpertLevel {
  const count = badges.length
  if (count >= 6) return 'legend'
  if (count >= 5) return 'master'
  if (count >= 3) return 'expert'
  if (count >= 1) return 'contributor'
  return 'newcomer'
}

export function checkEarnedBadges(stats: UserStats, currentBadges: UserBadge[]): BadgeType[] {
  const earnedIds = currentBadges.map(b => b.id)
  return BADGE_DEFINITIONS
    .filter(def => !earnedIds.includes(def.id) && def.requirement(stats))
    .map(def => def.id)
}
```

## 4.2 Badge Display Component

Utwórz `src/components/profile/BadgeDisplay.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import { 
  Sparkles, Award, Heart, Cpu, Coins, Users, ShieldCheck,
  Lock
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { BADGE_DEFINITIONS, type BadgeDefinition } from '@/lib/badges'
import type { UserBadge } from '@/types/user'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles, Award, Heart, Cpu, Coins, Users, ShieldCheck,
}

interface BadgeDisplayProps {
  badge: UserBadge
  size?: 'sm' | 'md' | 'lg'
}

export function BadgeDisplay({ badge, size = 'md' }: BadgeDisplayProps) {
  const definition = BADGE_DEFINITIONS.find(d => d.id === badge.type)
  if (!definition) return null
  
  const Icon = iconComponents[definition.icon] || Award
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }
  
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={cn(
              'rounded-xl flex items-center justify-center',
              `bg-${definition.color}-500/20 border border-${definition.color}-500/30`,
              sizeClasses[size]
            )}
          >
            <Icon className={cn(iconSizes[size], `text-${definition.color}-400`)} />
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-semibold">{definition.name}</p>
            <p className="text-xs text-slate-400">{definition.description}</p>
            <p className="text-xs text-slate-500 mt-1">
              Earned {new Date(badge.earnedAt).toLocaleDateString()}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface BadgeGridProps {
  earnedBadges: UserBadge[]
  showLocked?: boolean
  stats?: any                        // UserStats for progress
}

export function BadgeGrid({ earnedBadges, showLocked = true, stats }: BadgeGridProps) {
  const earnedIds = earnedBadges.map(b => b.type)
  
  return (
    <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
      {BADGE_DEFINITIONS.map((def) => {
        const earned = earnedBadges.find(b => b.type === def.id)
        const Icon = iconComponents[def.icon] || Award
        
        if (earned) {
          return <BadgeDisplay key={def.id} badge={earned} />
        }
        
        if (!showLocked) return null
        
        // Locked badge
        const progress = stats && def.progress ? def.progress(stats) : 0
        
        return (
          <TooltipProvider key={def.id}>
            <Tooltip>
              <TooltipTrigger>
                <div className="relative">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    'bg-white/5 border border-white/10 opacity-40'
                  )}>
                    <Lock className="w-5 h-5 text-slate-500" />
                  </div>
                  {progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-semibold text-slate-400">{def.name}</p>
                  <p className="text-xs text-slate-500">{def.description}</p>
                  {progress > 0 && (
                    <p className="text-xs text-primary mt-1">{Math.round(progress)}% complete</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}
```

## 4.3 Expert Weight w Attestations

Zaktualizuj wyświetlanie attestations aby pokazywać wagę eksperta:

```tsx
// W komponencie AttestationCard dodaj:

import { EXPERT_WEIGHT } from '@/types/user'

// W renderze:
<div className="flex items-center gap-2">
  <span className="text-sm">{attestation.staker.name}</span>
  {attestation.staker.expertLevel !== 'newcomer' && (
    <span className={cn(
      'px-1.5 py-0.5 text-xs rounded-full font-medium',
      'bg-gradient-to-r text-white capitalize',
      attestation.staker.expertLevel === 'legend' ? 'from-yellow-400 to-amber-600' :
      attestation.staker.expertLevel === 'master' ? 'from-purple-400 to-violet-600' :
      attestation.staker.expertLevel === 'expert' ? 'from-blue-400 to-cyan-600' :
      'from-emerald-400 to-green-600'
    )}>
      {EXPERT_WEIGHT[attestation.staker.expertLevel]}x
    </span>
  )}
</div>
```

---

# 📦 MODUŁ 5: TOKENOMICS $TRUST - BONDING CURVES

## 5.1 Opis ekonomii (NIE KOD - do zrozumienia)

```
BONDING CURVE DLA AGENT TOKENS:

Każdy zarejestrowany agent ma swoją "bonding curve" - krzywą cenową.

1. TWORZENIE AGENTA:
   - User płaci FEE (np. 0.01 ETH) → idzie do protocol treasury
   - Powstaje nowy "Agent Vault" z własną krzywą

2. STAKING $TRUST NA AGENTA:
   - User stakuje X $TRUST na agenta
   - Otrzymuje "shares" w Agent Vault
   - Im więcej $TRUST w vault, tym droższe kolejne shares (bonding curve)
   
   Formuła: price = basePrice * (totalSupply / initialSupply)^exponent
   
3. EARLY SUPPORTERS BENEFIT:
   - Wcześni stakujący kupują shares tanio
   - Późniejsi płacą więcej za każdy share
   - Wartość shares wczesnych rośnie!

4. UNSTAKING:
   - User może wycofać $TRUST
   - Sprzedaje shares po aktualnej cenie (minus fee)
   - Fee idzie do protocol (np. 1-2%)

5. TRUST SCORE CALCULATION:
   - Net = positive_shares_value - negative_shares_value
   - Score = normalize(Net, 0, 100)
   - Expert weight multiplier dla attestations od experts
```

## 5.2 Typy dla Tokenomics

Utwórz `src/types/tokenomics.ts`:

```typescript
export interface AgentVault {
  agentId: string
  
  // Bonding curve state
  totalShares: bigint               // Łączna liczba shares
  totalStaked: bigint               // Łączna ilość $TRUST w vault
  
  // Curve parameters
  basePrice: bigint                 // Cena początkowa za share
  exponent: number                  // Wykładnik krzywej (np. 1.5)
  
  // Positions
  positions: VaultPosition[]
  
  // Fees collected
  feesCollected: bigint
}

export interface VaultPosition {
  owner: `0x${string}`
  shares: bigint
  stakedAmount: bigint              // Ile $TRUST zainwestował
  entryPrice: bigint                // Średnia cena zakupu
  timestamp: Date
}

export interface StakeQuote {
  trustAmount: bigint               // Ile $TRUST chce stakować
  sharesReceived: bigint            // Ile shares dostanie
  pricePerShare: bigint             // Aktualna cena za share
  slippage: number                  // Estimated slippage %
  fee: bigint                       // Platform fee
}

export interface UnstakeQuote {
  sharesToSell: bigint
  trustReceived: bigint
  fee: bigint
  priceImpact: number               // % spadku ceny po transakcji
}

// Platform fees
export const PLATFORM_FEES = {
  agentRegistration: BigInt(0.01e18),   // 0.01 ETH
  stakingFee: 100,                       // 1% (basis points)
  unstakingFee: 150,                     // 1.5%
  minStake: BigInt(1e18),               // Min 1 $TRUST
}

// Bonding curve math
export function calculateSharePrice(
  totalShares: bigint,
  basePrice: bigint,
  exponent: number = 1.5
): bigint {
  if (totalShares === 0n) return basePrice
  const multiplier = Math.pow(Number(totalShares) / 1e18, exponent)
  return BigInt(Math.floor(Number(basePrice) * multiplier))
}

export function calculateSharesForStake(
  stakeAmount: bigint,
  totalShares: bigint,
  totalStaked: bigint,
  basePrice: bigint
): bigint {
  // Simplified: shares = stakeAmount / currentPrice
  const price = calculateSharePrice(totalShares, basePrice)
  return (stakeAmount * BigInt(1e18)) / price
}

export function calculateStakeForShares(
  sharesAmount: bigint,
  totalShares: bigint,
  basePrice: bigint
): bigint {
  const price = calculateSharePrice(totalShares, basePrice)
  return (sharesAmount * price) / BigInt(1e18)
}
```

## 5.3 Staking Modal z Bonding Curve Info

Zaktualizuj `src/components/trust/StakingModal.tsx`:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { useAccount, useBalance } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/cn'
import { 
  calculateSharePrice, 
  calculateSharesForStake,
  PLATFORM_FEES 
} from '@/types/tokenomics'
import type { Agent } from '@/types/agent'

interface StakingModalProps {
  agent: Agent
  type: 'trust' | 'distrust'
  open: boolean
  onClose: () => void
  onSubmit: (amount: bigint) => Promise<void>
}

export function StakingModal({ agent, type, open, onClose, onSubmit }: StakingModalProps) {
  const { address } = useAccount()
  const { data: balance } = useBalance({ address, token: TRUST_TOKEN_ADDRESS })
  
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const amountBigInt = useMemo(() => {
    try {
      return parseEther(amount || '0')
    } catch {
      return 0n
    }
  }, [amount])
  
  // Mock vault data - replace with real data
  const vaultData = {
    totalShares: BigInt(1000e18),
    totalStaked: BigInt(5000e18),
    basePrice: BigInt(1e18),
  }
  
  const quote = useMemo(() => {
    if (amountBigInt === 0n) return null
    
    const shares = calculateSharesForStake(
      amountBigInt,
      vaultData.totalShares,
      vaultData.totalStaked,
      vaultData.basePrice
    )
    
    const currentPrice = calculateSharePrice(vaultData.totalShares, vaultData.basePrice)
    const fee = (amountBigInt * BigInt(PLATFORM_FEES.stakingFee)) / 10000n
    
    return {
      shares,
      pricePerShare: currentPrice,
      fee,
      netAmount: amountBigInt - fee,
    }
  }, [amountBigInt, vaultData])
  
  const handleSubmit = async () => {
    if (!quote) return
    setIsSubmitting(true)
    try {
      await onSubmit(amountBigInt)
      onClose()
    } catch (error) {
      console.error('Staking failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const setPercentage = (percent: number) => {
    if (!balance) return
    const value = (BigInt(balance.value) * BigInt(percent)) / 100n
    setAmount(formatEther(value))
  }

  const isTrust = type === 'trust'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-50"
          >
            <div className="glass-card overflow-hidden">
              {/* Header */}
              <div className={cn(
                'flex items-center justify-between p-4 border-b border-white/10',
                isTrust ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              )}>
                <h2 className="text-lg font-semibold">
                  {isTrust ? 'Stake Trust' : 'Stake Distrust'} on {agent.name}
                </h2>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                
                {/* Agent Mini Card */}
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-slate-400">
                      Current score: <span className={cn(
                        'font-mono font-bold',
                        agent.trustScore >= 70 ? 'text-emerald-400' : 'text-amber-400'
                      )}>{agent.trustScore}</span>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-3">
                  <label className="text-sm text-slate-400">Amount to stake</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      className={cn(
                        'w-full px-4 py-4 pr-24 rounded-xl text-2xl font-mono',
                        'bg-white/5 border border-white/10',
                        'focus:outline-none focus:border-primary'
                      )}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      $TRUST
                    </div>
                  </div>
                  
                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setPercentage(pct)}
                        className="flex-1 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  
                  {/* Balance */}
                  <div className="text-sm text-slate-500">
                    Balance: {balance ? formatEther(balance.value) : '0'} $TRUST
                  </div>
                </div>

                {/* Quote Preview */}
                {quote && quote.shares > 0n && (
                  <div className="space-y-3 p-4 bg-white/5 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">You will receive</span>
                      <span className="font-mono font-medium">
                        {Number(formatEther(quote.shares)).toFixed(4)} shares
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Price per share</span>
                      <span className="font-mono">
                        {Number(formatEther(quote.pricePerShare)).toFixed(4)} $TRUST
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Platform fee ({PLATFORM_FEES.stakingFee / 100}%)</span>
                      <span className="font-mono text-slate-500">
                        -{Number(formatEther(quote.fee)).toFixed(4)} $TRUST
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between">
                      <span className="text-slate-400">Net amount staked</span>
                      <span className="font-mono font-medium text-emerald-400">
                        {Number(formatEther(quote.netAmount)).toFixed(4)} $TRUST
                      </span>
                    </div>
                  </div>
                )}

                {/* Bonding Curve Info */}
                <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-300">
                    <p className="font-medium text-primary">Bonding Curve</p>
                    <p className="mt-1">
                      Early supporters get more shares per $TRUST. As more people stake, 
                      share price increases, making your position more valuable.
                    </p>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-300">
                    Staked tokens are locked. Withdrawing early may incur additional fees 
                    and you may receive less than you staked if price drops.
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!quote || quote.shares === 0n || isSubmitting}
                  className={cn(
                    'w-full py-4 text-lg',
                    isTrust 
                      ? 'bg-emerald-500 hover:bg-emerald-600' 
                      : 'bg-amber-500 hover:bg-amber-600'
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Staking...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5 mr-2" />
                      {isTrust ? 'Stake Trust' : 'Stake Distrust'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Placeholder - replace with actual token address
const TRUST_TOKEN_ADDRESS = '0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3' as `0x${string}`
```

---

# 📦 MODUŁ 6: HOOK useUserProfile

## 6.1 Utwórz `src/hooks/useUserProfile.ts`:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile } from '@/types/user'
import { calculateExpertLevel } from '@/lib/badges'

// Mock data - replace with Intuition SDK calls
const mockProfile: UserProfile = {
  address: '0x0000000000000000000000000000000000000000',
  name: undefined,
  bio: undefined,
  avatar: undefined,
  stats: {
    totalAgentsRegistered: 0,
    totalTrustStaked: 0n,
    totalAttestations: 0,
    trustReceived: 0n,
    reputation: 50,
  },
  badges: [],
  expertLevel: 'newcomer',
  registeredAgents: [],
  supportedAgents: [],
  joinedAt: new Date(),
  lastActiveAt: new Date(),
}

export function useUserProfile(address?: `0x${string}`) {
  const queryClient = useQueryClient()

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['userProfile', address],
    queryFn: async () => {
      if (!address) return null
      
      // TODO: Fetch from Intuition Protocol
      // const atoms = await getAtomsForAddress(address)
      // const attestations = await getAttestationsBy(address)
      // ...
      
      // Return mock for now
      return {
        ...mockProfile,
        address,
        expertLevel: calculateExpertLevel(mockProfile.badges),
      } as UserProfile
    },
    enabled: !!address,
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      // TODO: Update on Intuition (create/update Atom)
      // await updateUserAtom(address, updates)
      
      return { ...profile, ...updates }
    },
    onSuccess: (newProfile) => {
      queryClient.setQueryData(['userProfile', address], newProfile)
    },
  })

  return {
    profile: profile || { ...mockProfile, address: address || '0x0' as `0x${string}` },
    isLoading,
    error,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
```

---

# ✅ CHECKLIST IMPLEMENTACJI

## Moduł 1: Profile System
- [ ] Typy UserProfile, UserStats, UserBadge
- [ ] Strona /profile
- [ ] ProfileHeader z avatar upload
- [ ] ProfileStats component
- [ ] MyAgents tab
- [ ] MySupportedAgents tab
- [ ] Link do profilu w wallet dropdown

## Moduł 2: Agent Avatars
- [ ] Avatar field w Agent type
- [ ] AgentAvatar component z upload
- [ ] Integracja w AgentCard
- [ ] Integracja w AgentDetail

## Moduł 3: Advanced Filtering
- [ ] AgentCategory types
- [ ] AgentFilters types
- [ ] AgentFilters component
- [ ] Slider dla trust range
- [ ] Category pills
- [ ] Integracja z Agent Explorer

## Moduł 4: Expert Badges
- [ ] Badge definitions
- [ ] BadgeDisplay component
- [ ] BadgeGrid component
- [ ] Expert weight w attestations
- [ ] Badge progress tracking

## Moduł 5: Tokenomics
- [ ] Tokenomics types
- [ ] Bonding curve math
- [ ] StakingModal z quote preview
- [ ] Fee display
- [ ] Shares calculation

## Moduł 6: Hooks
- [ ] useUserProfile hook
- [ ] Integration z Intuition SDK (placeholder)

---

# 🚀 START

Aby rozpocząć implementację, powiedz w Cursorze:

```
Zaczynam MODUŁ 1 - System Profili.
Najpierw wygeneruj src/types/user.ts z wszystkimi typami.
```

Po każdym module powiedz "MODUŁ X" aby kontynuować.

---

**Ten prompt da Ci kompletny Phase 2 AgentScore! 🚀**
