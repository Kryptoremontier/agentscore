'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, Edit, Check, X, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { UserProfile } from '@/types/user'
import { BadgeDisplay } from './BadgeDisplay'

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

  useEffect(() => {
    setName(profile.name || '')
    setBio(profile.bio || '')
  }, [profile.name, profile.bio])

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(profile.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
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

  const formatStaked = (raw: bigint): string => {
    const val = Number(raw) / 1e18
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
    if (val >= 1) return val.toFixed(2)
    if (val > 0) return val.toFixed(4)
    return '0'
  }

  const topBadges = profile.badges.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8 mb-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">

        {/* Avatar */}
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent-cyan ring-2 ring-white/10">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold">
                {profile.name?.[0]?.toUpperCase() || profile.address.slice(2, 4).toUpperCase()}
              </div>
            )}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'absolute inset-0 rounded-full flex items-center justify-center',
              'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer'
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
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
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
                <h1 className="text-2xl font-bold truncate">
                  {profile.name || 'Anonymous User'}
                </h1>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white shrink-0"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {profile.bio && (
                <p className="text-slate-400 mt-1 text-sm">{profile.bio}</p>
              )}

              {/* Address */}
              <div className="flex items-center gap-2 mt-3">
                <code className="text-sm text-slate-500 font-mono">
                  {profile.address.slice(0, 6)}...{profile.address.slice(-4)}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
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

              {/* Badge row */}
              {topBadges.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {topBadges.map(badge => (
                    <BadgeDisplay key={badge.id} badge={badge} size="sm" />
                  ))}
                  {profile.badges.length > 3 && (
                    <span className="text-xs text-slate-500">
                      +{profile.badges.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </>
          )}
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
