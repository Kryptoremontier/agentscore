'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Globe, AtSign, User, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UserProfile } from '@/types/user'
import { cn } from '@/lib/cn'

interface ProfileSettingsProps {
  profile: UserProfile
  onUpdate: (data: Partial<UserProfile>) => Promise<void>
}

export function ProfileSettings({ profile, onUpdate }: ProfileSettingsProps) {
  const [name, setName] = useState(profile.name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [twitter, setTwitter] = useState(profile.twitter || '')
  const [farcaster, setFarcaster] = useState(profile.farcaster || '')
  const [website, setWebsite] = useState(profile.website || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate({ name, bio, twitter, farcaster, website })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    name !== (profile.name || '') ||
    bio !== (profile.bio || '') ||
    twitter !== (profile.twitter || '') ||
    farcaster !== (profile.farcaster || '') ||
    website !== (profile.website || '')

  return (
    <div className="space-y-6">
      {/* Profile Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Profile Information
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short description about yourself..."
              rows={3}
              className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>
        </div>
      </motion.div>

      {/* Social Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          Social Links
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1.5 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5" /> Twitter / X
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1.5 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5" /> Farcaster
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">/</span>
              <input
                type="text"
                value={farcaster}
                onChange={(e) => setFarcaster(e.target.value)}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1.5 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>
      </motion.div>

      {/* Account Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          Account
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-400">Wallet Address</span>
            <code className="text-sm font-mono text-slate-300">
              {profile.address.slice(0, 6)}...{profile.address.slice(-4)}
            </code>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-400">Network</span>
            <span className="text-sm text-slate-300">Intuition Testnet</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-400">Level</span>
            <span className="text-sm text-slate-300 capitalize">{profile.expertLevel}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-400">Badges Earned</span>
            <span className="text-sm text-slate-300">{profile.badges.length}</span>
          </div>
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-end"
      >
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={cn(
            'min-w-[160px]',
            saved && 'bg-emerald-600 hover:bg-emerald-600'
          )}
        >
          {saving ? (
            'Saving...'
          ) : saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </motion.div>
    </div>
  )
}
