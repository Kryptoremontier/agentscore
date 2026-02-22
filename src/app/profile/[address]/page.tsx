'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { isAddress, getAddress } from 'viem'
import { motion } from 'framer-motion'
import {
  Shield, TrendingUp, Award, Copy, Check, ExternalLink,
  ArrowLeft, Calendar, Zap
} from 'lucide-react'
import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { MyAgents } from '@/components/profile/MyAgents'
import { MySupportedAgents } from '@/components/profile/MySupportedAgents'
import { MyBadges } from '@/components/profile/MyBadges'
import { BadgeDisplay } from '@/components/profile/BadgeDisplay'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserProfile } from '@/hooks/useUserProfile'
import { cn } from '@/lib/cn'

export default function PublicProfilePage() {
  const params = useParams()
  const rawAddress = params.address as string
  const { address: myAddress } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isValid = rawAddress && isAddress(rawAddress)
  const checksummed = isValid ? getAddress(rawAddress) as `0x${string}` : undefined

  const isOwnProfile = mounted && myAddress && checksummed
    && getAddress(myAddress) === checksummed

  const { profile, isLoading } = useUserProfile(checksummed)

  if (!isValid) {
    return (
      <PageBackground image="wave" opacity={0.25}>
        <div className="pt-24 pb-16">
          <div className="max-w-6xl mx-auto px-4 text-center py-20">
            <h1 className="text-2xl font-bold mb-3">Invalid Address</h1>
            <p className="text-slate-400 mb-6">The wallet address provided is not valid.</p>
            <Link href="/agents" className="text-primary hover:text-primary/80 transition-colors">
              Back to Explorer
            </Link>
          </div>
        </div>
      </PageBackground>
    )
  }

  if (isLoading || !mounted) {
    return <PublicProfileSkeleton />
  }

  return (
    <PageBackground image="wave" opacity={0.25}>
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Back + Own profile hint */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/agents"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Explorer
            </Link>
            {isOwnProfile && (
              <Link
                href="/profile"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Go to My Profile (edit mode)
              </Link>
            )}
          </div>

          {/* Public Header */}
          <PublicHeader profile={profile} />

          {/* Stats */}
          <ProfileStats stats={profile.stats} badges={profile.badges} />

          {/* Tabs (no Settings) */}
          <Tabs defaultValue="agents" className="mt-8">
            <TabsList className="glass p-1 mb-6">
              <TabsTrigger value="agents" className="data-[state=active]:bg-white/10">
                <Shield className="w-4 h-4 mr-2" />
                Agents
              </TabsTrigger>
              <TabsTrigger value="supporting" className="data-[state=active]:bg-white/10">
                <TrendingUp className="w-4 h-4 mr-2" />
                Supporting
              </TabsTrigger>
              <TabsTrigger value="badges" className="data-[state=active]:bg-white/10">
                <Award className="w-4 h-4 mr-2" />
                Badges
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agents">
              <MyAgents agents={profile.registeredAgents} />
            </TabsContent>
            <TabsContent value="supporting">
              <MySupportedAgents supports={profile.supportedAgents} />
            </TabsContent>
            <TabsContent value="badges">
              <MyBadges badges={profile.badges} expertLevel={profile.expertLevel} stats={profile.stats} />
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </PageBackground>
  )
}

function PublicHeader({ profile }: { profile: ReturnType<typeof useUserProfile>['profile'] }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(profile.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const formatStaked = (raw: bigint): string => {
    const val = Number(raw) / 1e18
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
    if (val >= 1) return val.toFixed(2)
    if (val > 0) return val.toFixed(4)
    return '0'
  }

  const topBadges = profile.badges.slice(0, 4)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8 mb-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent-cyan ring-2 ring-white/10">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold">
                {profile.name?.[0]?.toUpperCase() || profile.address.slice(2, 4).toUpperCase()}
              </div>
            )}
          </div>
          <div className={cn(
            'absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
            'bg-gradient-to-r text-white capitalize shadow-lg',
            getExpertBadgeColor(profile.expertLevel)
          )}>
            {profile.expertLevel}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">
            {profile.name || 'Anonymous User'}
          </h1>

          {profile.bio && (
            <p className="text-slate-400 mt-1 text-sm">{profile.bio}</p>
          )}

          {/* Address */}
          <div className="flex items-center gap-2 mt-3">
            <code className="text-sm text-slate-500 font-mono">
              {profile.address.slice(0, 6)}...{profile.address.slice(-4)}
            </code>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Copy address"
            >
              {copied
                ? <Check className="w-4 h-4 text-emerald-400" />
                : <Copy className="w-4 h-4 text-slate-400" />
              }
            </button>
            <a
              href={`https://base-sepolia.blockscout.com/address/${profile.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="View on explorer"
            >
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Socials */}
          {(profile.twitter || profile.farcaster || profile.website) && (
            <div className="flex items-center gap-3 mt-3">
              {profile.twitter && (
                <a
                  href={`https://twitter.com/${profile.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  @{profile.twitter}
                </a>
              )}
              {profile.farcaster && (
                <a
                  href={`https://warpcast.com/${profile.farcaster}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  /{profile.farcaster}
                </a>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}

          {/* Badges row */}
          {topBadges.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {topBadges.map(badge => (
                <BadgeDisplay key={badge.id} badge={badge} size="sm" />
              ))}
              {profile.badges.length > 4 && (
                <span className="text-xs text-slate-500">+{profile.badges.length - 4}</span>
              )}
            </div>
          )}

          {/* Member since + activity */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Member for {profile.stats.daysActive} day{profile.stats.daysActive !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {profile.stats.totalSignals} signals
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-6 text-center shrink-0">
          <div>
            <div className="text-2xl font-bold font-mono">{profile.stats.totalAgentsRegistered}</div>
            <div className="text-xs text-slate-500">Agents</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {formatStaked(profile.stats.totalTrustStaked)}
            </div>
            <div className="text-xs text-slate-500">tTRUST</div>
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

function PublicProfileSkeleton() {
  return (
    <PageBackground image="wave" opacity={0.25}>
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 animate-pulse">
          <div className="h-4 w-32 bg-white/10 rounded mb-6" />
          <div className="glass-card p-8 mb-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-white/10" />
              <div className="space-y-3 flex-1">
                <div className="h-8 w-48 bg-white/10 rounded" />
                <div className="h-4 w-64 bg-white/10 rounded" />
                <div className="h-4 w-32 bg-white/10 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="glass-card p-6 h-28 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </PageBackground>
  )
}
