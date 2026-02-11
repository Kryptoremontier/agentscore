'use client'

import { useAccount } from 'wagmi'
import { redirect } from 'next/navigation'
import {
  Settings, Shield, TrendingUp, Award
} from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
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

  // Wrapper dla updateProfile aby dopasować typ
  const handleProfileUpdate = async (data: Partial<typeof profile>) => {
    await updateProfile(data)
  }

  return (
    <PageBackground image="wave" opacity={0.25}>
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Profile Header */}
        <ProfileHeader profile={profile} onUpdate={handleProfileUpdate} />

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
            <MyBadges badges={profile.badges} expertLevel={profile.expertLevel} stats={profile.stats} />
          </TabsContent>

          <TabsContent value="settings">
            <ProfileSettings profile={profile} onUpdate={handleProfileUpdate} />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </PageBackground>
  )
}

function ProfileSkeleton() {
  return (
    <PageBackground image="wave" opacity={0.25}>
      <div className="pt-24 pb-16">
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
    </PageBackground>
  )
}
