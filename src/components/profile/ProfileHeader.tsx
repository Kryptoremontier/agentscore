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
