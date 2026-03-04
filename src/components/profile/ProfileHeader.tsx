'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, Edit, Check, X, Copy, ExternalLink, Bot, TrendingUp, Award } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { UserProfile } from '@/types/user'
import { BadgeDisplay } from './BadgeDisplay'

interface ProfileHeaderProps {
  profile: UserProfile
  onUpdate: (data: Partial<UserProfile>) => Promise<void>
}

const EXPERT_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  newcomer:    { label: 'Newcomer',    color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.30)' },
  contributor: { label: 'Contributor', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.30)' },
  expert:      { label: 'Expert',      color: '#38B6FF', bg: 'rgba(56,182,255,0.12)',  border: 'rgba(56,182,255,0.30)' },
  master:      { label: 'Master',      color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.30)' },
  legend:      { label: 'Legend',      color: '#C8963C', bg: 'rgba(200,150,60,0.15)',  border: 'rgba(200,150,60,0.40)' },
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

  const formatStaked = (raw: bigint): string => {
    const val = Number(raw) / 1e18
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
    if (val >= 1) return val.toFixed(2)
    if (val > 0) return val.toFixed(4)
    return '0'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6 mb-6"
      style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.20)' }}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">

        {/* Avatar */}
        <div className="relative group shrink-0">
          <div className="w-20 h-20 rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg,rgba(200,150,60,0.3),rgba(46,230,214,0.2))', border: '2px solid rgba(200,150,60,0.30)' }}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#C8963C]">
                {profile.name?.[0]?.toUpperCase() || profile.address.slice(2, 4).toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <Camera className="w-5 h-5 text-white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />

          {/* Expert badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize whitespace-nowrap"
            style={{ background: expertStyle.bg, border: `1px solid ${expertStyle.border}`, color: expertStyle.color }}>
            {expertStyle.label}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-xl px-4 py-2 text-lg font-bold focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,150,60,0.35)', color: '#E8E8E8' }}
              />
              <textarea
                value={bio} onChange={e => setBio(e.target.value)}
                placeholder="Short bio..." rows={2}
                className="w-full rounded-xl px-4 py-2 text-sm focus:outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#B5BDC6' }}
              />
              <div className="flex gap-2">
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'rgba(200,150,60,0.20)', border: '1px solid rgba(200,150,60,0.40)', color: '#C8963C' }}>
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all text-[#7A838D] hover:text-[#B5BDC6]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white truncate">
                  {profile.name || 'Anonymous User'}
                </h1>
                <button onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg transition-colors text-[#7A838D] hover:text-white hover:bg-white/10 shrink-0">
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>

              {profile.bio && (
                <p className="text-sm text-[#7A838D] mt-1">{profile.bio}</p>
              )}

              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs text-[#7A838D] font-mono">
                  {profile.address.slice(0, 6)}…{profile.address.slice(-4)}
                </code>
                <button onClick={handleCopyAddress} className="p-1 rounded hover:bg-white/10 transition-colors" title="Copy">
                  {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5 text-[#7A838D]" />}
                </button>
                <a href={`https://base-sepolia.blockscout.com/address/${profile.address}`}
                  target="_blank" rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/10 transition-colors" title="View on explorer">
                  <ExternalLink className="w-3.5 h-3.5 text-[#7A838D]" />
                </a>
              </div>

              {profile.badges.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3">
                  {profile.badges.slice(0, 4).map(badge => (
                    <BadgeDisplay key={badge.id} badge={badge} size="sm" />
                  ))}
                  {profile.badges.length > 4 && (
                    <span className="text-xs text-[#7A838D]">+{profile.badges.length - 4}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex gap-5 text-center shrink-0 md:border-l md:pl-6"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div>
            <div className="text-2xl font-bold font-mono" style={{ color: '#C8963C' }}>
              {profile.stats.totalAgentsRegistered}
            </div>
            <div className="text-[11px] text-[#7A838D]">Agents</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono" style={{ color: '#4ADE80' }}>
              {formatStaked(profile.stats.totalTrustStaked)}
            </div>
            <div className="text-[11px] text-[#7A838D]">tTRUST</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono" style={{ color: '#A78BFA' }}>
              {profile.badges.length}
            </div>
            <div className="text-[11px] text-[#7A838D]">Badges</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
