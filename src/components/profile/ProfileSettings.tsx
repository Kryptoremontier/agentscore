'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Globe, AtSign, User, Check, ExternalLink, Loader2 } from 'lucide-react'
import type { UserProfile } from '@/types/user'

interface ProfileSettingsProps {
  profile: UserProfile
  onUpdate: (data: Partial<UserProfile>) => Promise<void>
}

const CARD_STYLE = {
  background: 'rgba(15,17,19,0.85)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const INPUT_STYLE = {
  background: '#12151A',
  border: '1px solid rgba(255,255,255,0.09)',
  color: 'rgba(255,255,255,0.85)',
  borderRadius: '10px',
  outline: 'none',
}

const LABEL_STYLE = { color: 'rgba(255,255,255,0.45)' } as const

function SectionHeader({ icon: Icon, label }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <h3 className="text-sm font-semibold mb-5 flex items-center gap-2.5">
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="text-white">{label}</span>
    </h3>
  )
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
    <div className="space-y-4">
      {/* Profile Info */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5"
        style={CARD_STYLE}
      >
        <SectionHeader icon={User} label="Profile Information" />
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1.5 block" style={LABEL_STYLE}>Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              className="w-full px-4 py-3 text-sm transition-colors"
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={LABEL_STYLE}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short description about yourself..."
              rows={3}
              className="w-full px-4 py-3 text-sm transition-colors resize-none"
              style={INPUT_STYLE}
            />
          </div>
        </div>
      </motion.div>

      {/* Social Links */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
        className="rounded-2xl p-5"
        style={CARD_STYLE}
      >
        <SectionHeader icon={Globe} label="Social Links" />
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1.5 flex items-center gap-1.5" style={LABEL_STYLE}>
              <AtSign className="w-3 h-3" /> Twitter / X
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm select-none" style={{ color: 'rgba(255,255,255,0.25)' }}>@</span>
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 text-sm transition-colors"
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1.5 flex items-center gap-1.5" style={LABEL_STYLE}>
              <AtSign className="w-3 h-3" /> Farcaster
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm select-none" style={{ color: 'rgba(255,255,255,0.25)' }}>/</span>
              <input
                type="text"
                value={farcaster}
                onChange={(e) => setFarcaster(e.target.value)}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 text-sm transition-colors"
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1.5 flex items-center gap-1.5" style={LABEL_STYLE}>
              <ExternalLink className="w-3 h-3" /> Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 text-sm transition-colors"
              style={INPUT_STYLE}
            />
          </div>
        </div>
      </motion.div>

      {/* Account Info */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="rounded-2xl p-5"
        style={CARD_STYLE}
      >
        <SectionHeader icon={Settings} label="Account" />
        <div className="space-y-1">
          {[
            { label: 'Wallet Address', value: `${profile.address.slice(0, 6)}...${profile.address.slice(-4)}`, mono: true },
            { label: 'Network', value: 'Intuition Testnet', mono: false },
            { label: 'Level', value: profile.expertLevel, mono: false, capitalize: true },
            { label: 'Badges Earned', value: String(profile.badges.length), mono: false },
          ].map(row => (
            <div
              key={row.label}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>{row.label}</span>
              <span className={`text-sm ${row.mono ? 'font-mono' : ''} ${row.capitalize ? 'capitalize' : ''}`}
                style={{ color: 'rgba(255,255,255,0.75)' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-end"
      >
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={saved
            ? { background: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.35)', color: '#2ECC71' }
            : { background: 'rgba(200,150,60,0.15)', border: '1px solid rgba(200,150,60,0.35)', color: '#C8963C' }
          }
        >
          {saving ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="w-3.5 h-3.5" /> Saved</>
          ) : (
            'Save Changes'
          )}
        </button>
      </motion.div>
    </div>
  )
}
