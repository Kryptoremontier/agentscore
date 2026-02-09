'use client'

import { Settings } from 'lucide-react'
import type { UserProfile } from '@/types/user'

interface ProfileSettingsProps {
  profile: UserProfile
  onUpdate: (data: Partial<UserProfile>) => Promise<void>
}

export function ProfileSettings({ profile: _profile, onUpdate: _onUpdate }: ProfileSettingsProps) {
  return (
    <div className="glass-card p-8">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Settings className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Profile Settings</h3>
        <p className="text-slate-400 max-w-md">
          Additional settings and preferences coming soon.
        </p>
      </div>
    </div>
  )
}
