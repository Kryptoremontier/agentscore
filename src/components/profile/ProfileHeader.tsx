'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, Edit, Check, X, Copy, ExternalLink } from 'lucide-react'
import type { UserProfile } from '@/types/user'

const EXPERT_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  newcomer:    { label: 'Newcomer',    color: '#7A838D', bg: 'rgba(122,131,141,0.12)', border: 'rgba(122,131,141,0.25)' },
  contributor: { label: 'Contributor', color: '#2ECC71', bg: 'rgba(46,204,113,0.10)',  border: 'rgba(46,204,113,0.25)' },
  expert:      { label: 'Expert',      color: '#38B6FF', bg: 'rgba(56,182,255,0.10)',  border: 'rgba(56,182,255,0.25)' },
  master:      { label: 'Master',      color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)' },
  legend:      { label: 'Legend',      color: '#C8963C', bg: 'rgba(200,150,60,0.12)',  border: 'rgba(200,150,60,0.35)' },
}

interface ProfileHeaderProps {
  profile: UserProfile
  onUpdate: (data: Partial<UserProfile>) => Promise<void>
}

function formatStaked(raw: bigint): string {
  const val = Number(raw) / 1e18
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  if (val >= 1) return val.toFixed(2)
  if (val > 0) return val.toFixed(4)
  return '0'
}

export function ProfileHeader({ profile, onUpdate }: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(profile.name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const expertStyle = EXPERT_STYLES[profile.expertLevel] ?? EXPERT_STYLES.newcomer

  useEffect(() => {
    setName(profile.name || '')
    setBio(profile.bio || '')
  }, [profile.name, profile.bio])

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(profile.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onUpdate({ avatar: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    await onUpdate({ name, bio })
    setIsEditing(false)
  }

  const shortAddr = `${profile.address.slice(0, 6)}…${profile.address.slice(-4)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl mb-4 overflow-hidden"
      style={{ background: 'rgba(13,15,17,0.92)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 px-6 py-5">

        {/* Avatar */}
        <div className="relative group shrink-0">
          <div className="w-16 h-16 rounded-xl overflow-hidden"
            style={{ background: 'rgba(200,150,60,0.12)', border: '1.5px solid rgba(200,150,60,0.25)' }}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: '#C8963C' }}>
                {profile.name?.[0]?.toUpperCase() || profile.address.slice(2, 4).toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-4 h-4 text-white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-lg px-3 py-1.5 text-base font-bold focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,150,60,0.30)', color: '#E8E8E8' }}
              />
              <textarea
                value={bio} onChange={e => setBio(e.target.value)}
                placeholder="Short bio..." rows={2}
                className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#B5BDC6' }}
              />
              <div className="flex gap-2">
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(200,150,60,0.16)', border: '1px solid rgba(200,150,60,0.35)', color: '#C8963C' }}>
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#7A838D] hover:text-[#B5BDC6]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white leading-tight">
                  {profile.name || 'Anonymous User'}
                </h1>
                {/* Expert level — inline with name */}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{ background: expertStyle.bg, border: `1px solid ${expertStyle.border}`, color: expertStyle.color }}>
                  {expertStyle.label}
                </span>
                <button onClick={() => setIsEditing(true)}
                  className="p-1 rounded-md text-[#4A5260] hover:text-[#7A838D] hover:bg-white/[0.06] transition-colors">
                  <Edit className="w-3 h-3" />
                </button>
              </div>

              {profile.bio && (
                <p className="text-xs text-[#7A838D] mt-0.5 leading-relaxed">{profile.bio}</p>
              )}

              <div className="flex items-center gap-1.5 mt-1.5">
                <code className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {shortAddr}
                </code>
                <button onClick={handleCopyAddress} className="p-1 rounded hover:bg-white/[0.06] transition-colors" title="Copy address">
                  {copied
                    ? <Check className="w-3 h-3 text-[#2ECC71]" />
                    : <Copy className="w-3 h-3 text-[#4A5260] hover:text-[#7A838D]" />}
                </button>
                <a href={`https://base-sepolia.blockscout.com/address/${profile.address}`}
                  target="_blank" rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/[0.06] transition-colors" title="Explorer">
                  <ExternalLink className="w-3 h-3 text-[#4A5260] hover:text-[#7A838D]" />
                </a>
              </div>
            </>
          )}
        </div>

        {/* Quick stats — right side, subtle, monochrome */}
        <div className="flex items-center gap-0 shrink-0 sm:border-l sm:pl-5"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[
            { value: profile.stats.totalAgentsRegistered, label: 'Agents' },
            { value: formatStaked(profile.stats.totalTrustStaked), label: 'tTRUST' },
            { value: profile.badges.length, label: 'Badges' },
          ].map((stat, i) => (
            <div key={stat.label}
              className={`text-center px-4 ${i < 2 ? 'border-r' : ''}`}
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="text-lg font-bold font-mono text-white leading-none">{stat.value}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

      </div>
    </motion.div>
  )
}
