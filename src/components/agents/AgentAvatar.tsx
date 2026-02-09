'use client'

import { useState, useRef } from 'react'
import { Camera, Shield, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface AgentAvatarProps {
  avatar?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  editable?: boolean
  onAvatarChange?: (avatarUrl: string) => Promise<void>
  trustScore?: number
  verified?: boolean
}

const sizeClasses = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-lg',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-32 h-32 text-4xl',
}

export function AgentAvatar({
  avatar,
  name,
  size = 'md',
  editable = false,
  onAvatarChange,
  trustScore,
  verified,
}: AgentAvatarProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onAvatarChange) return

    setIsUploading(true)
    try {
      // TODO: Upload to IPFS
      // const ipfsHash = await uploadToIPFS(file)
      // await onAvatarChange(`ipfs://${ipfsHash}`)

      // Tymczasowo: data URL
      const reader = new FileReader()
      reader.onload = async (event) => {
        await onAvatarChange(event.target?.result as string)
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Upload failed:', error)
      setIsUploading(false)
    }
  }

  const getTrustColor = () => {
    if (!trustScore) return 'from-primary to-accent-cyan'
    if (trustScore >= 70) return 'from-emerald-500 to-cyan-500'
    if (trustScore >= 50) return 'from-amber-500 to-orange-500'
    return 'from-red-500 to-rose-500'
  }

  return (
    <div className="relative group">
      {/* Avatar container */}
      <div
        className={cn(
          'rounded-xl overflow-hidden bg-gradient-to-br flex items-center justify-center',
          sizeClasses[size],
          getTrustColor()
        )}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Shield className="w-1/2 h-1/2 text-white" />
        )}

        {/* Upload overlay */}
        {editable && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              'absolute inset-0 rounded-xl flex items-center justify-center',
              'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
              'cursor-pointer'
            )}
          >
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Camera className="w-6 h-6" />
            )}
          </button>
        )}
      </div>

      {/* Verified badge */}
      {verified && (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[rgb(10,10,15)]">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </div>
  )
}
