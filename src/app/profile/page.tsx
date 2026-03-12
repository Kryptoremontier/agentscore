'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useAccount } from 'wagmi'
import { useRouter, useSearchParams } from 'next/navigation'
import { Settings, Bot, TrendingUp, Award, BarChart2 } from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { MyAgents } from '@/components/profile/MyAgents'
import { MySupportedAgents } from '@/components/profile/MySupportedAgents'
import { MyBadges } from '@/components/profile/MyBadges'
import { ProfileSettings } from '@/components/profile/ProfileSettings'
import { PnLTab } from '@/components/profile/PnLTab'
import { cn } from '@/lib/cn'
import { useUserProfile } from '@/hooks/useUserProfile'

const PROFILE_TABS = [
  { id: 'agents',     label: 'My Agents',  icon: Bot,        color: '#C8963C' },
  { id: 'supporting', label: 'Supporting', icon: TrendingUp, color: '#4ADE80' },
  { id: 'pnl',        label: 'P&L',        icon: BarChart2,  color: '#38BDF8' },
  { id: 'badges',     label: 'Badges',     icon: Award,      color: '#A78BFA' },
  { id: 'settings',   label: 'Settings',   icon: Settings,   color: '#7A838D' },
] as const

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfilePageContent />
    </Suspense>
  )
}

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { address, isConnected } = useAccount()
  const { profile, isLoading, updateProfile } = useUserProfile(address)
  const [mounted, setMounted] = useState(false)

  const defaultTab = useMemo(() => {
    const tab = searchParams.get('tab')
    if (tab && ['agents', 'supporting', 'pnl', 'badges', 'settings'].includes(tab)) return tab as typeof PROFILE_TABS[number]['id']
    return 'agents' as typeof PROFILE_TABS[number]['id']
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<typeof PROFILE_TABS[number]['id']>(defaultTab)

  useEffect(() => { setMounted(true) }, [])

  // Sync activeTab when URL changes (e.g. /profile?tab=pnl)
  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  const handleTabClick = (tabId: typeof PROFILE_TABS[number]['id']) => {
    setActiveTab(tabId)
    router.replace(`/profile?tab=${tabId}`, { scroll: false })
  }

  useEffect(() => {
    if (mounted && !isConnected) {
      router.push('/')
    }
  }, [mounted, isConnected, router])

  if (!mounted || !isConnected) {
    return <ProfileSkeleton />
  }

  const handleProfileUpdate = async (data: Partial<typeof profile>) => {
    await updateProfile(data)
  }

  return (
    <PageBackground image="wave" opacity={0.25}>
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        <ProfileHeader profile={profile} onUpdate={handleProfileUpdate} />
        <ProfileStats stats={profile.stats} badges={profile.badges} />

        {/* Tab bar */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {PROFILE_TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                  isActive ? 'text-white' : 'text-[#7A838D] hover:text-[#B5BDC6]'
                )}
                style={isActive
                  ? { background: `${tab.color}18`, border: `1px solid ${tab.color}40`, color: tab.color }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content — show skeleton per-section while loading */}
        {activeTab === 'agents' && (
          isLoading
            ? <TabSkeleton />
            : <MyAgents agents={profile.registeredAgents} />
        )}
        {activeTab === 'supporting' && (
          isLoading
            ? <TabSkeleton />
            : <MySupportedAgents supports={profile.supportedAgents} />
        )}
        {activeTab === 'pnl' && (
          isLoading
            ? <TabSkeleton />
            : <PnLTab positions={profile.pnlPositions} />
        )}
        {activeTab === 'badges' && (
          isLoading
            ? <TabSkeleton />
            : <MyBadges badges={profile.badges} expertLevel={profile.expertLevel} stats={profile.stats} />
        )}
        {activeTab === 'settings' && (
          <ProfileSettings profile={profile} onUpdate={handleProfileUpdate} />
        )}
        </div>
      </div>
    </PageBackground>
  )
}

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl h-20"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <PageBackground image="wave" opacity={0.25}>
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 animate-pulse">
          <div className="rounded-2xl p-6 mb-6 h-32"
            style={{ background: 'rgba(15,17,19,0.8)', border: '1px solid rgba(200,150,60,0.15)' }} />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="rounded-2xl h-20"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
            ))}
          </div>
          <div className="flex gap-2 mb-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-10 w-28 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
            ))}
          </div>
          <div className="rounded-2xl h-64"
            style={{ background: 'rgba(15,17,19,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
        </div>
      </div>
    </PageBackground>
  )
}
