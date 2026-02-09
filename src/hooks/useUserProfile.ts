'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile } from '@/types/user'
import { calculateExpertLevel } from '@/lib/badges'

// Mock data - replace with Intuition SDK calls
const mockProfile: UserProfile = {
  address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  name: undefined,
  bio: undefined,
  avatar: undefined,
  stats: {
    totalAgentsRegistered: 0,
    totalTrustStaked: BigInt(0),
    totalAttestations: 0,
    trustReceived: BigInt(0),
    reputation: 50,
  },
  badges: [],
  expertLevel: 'newcomer',
  registeredAgents: [],
  supportedAgents: [],
  joinedAt: new Date(),
  lastActiveAt: new Date(),
}

export function useUserProfile(address?: `0x${string}`) {
  const queryClient = useQueryClient()

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['userProfile', address],
    queryFn: async () => {
      if (!address) return null

      // TODO: Fetch from Intuition Protocol
      // const atoms = await getAtomsForAddress(address)
      // const attestations = await getAttestationsBy(address)
      // ...

      // Return mock for now
      return {
        ...mockProfile,
        address,
        expertLevel: calculateExpertLevel(mockProfile.badges),
      } as UserProfile
    },
    enabled: !!address,
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      // TODO: Update on Intuition (create/update Atom)
      // await updateUserAtom(address, updates)

      return { ...profile, ...updates }
    },
    onSuccess: (newProfile) => {
      queryClient.setQueryData(['userProfile', address], newProfile)
    },
  })

  return {
    profile: profile || { ...mockProfile, address: address || '0x0' as `0x${string}` },
    isLoading,
    error,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
