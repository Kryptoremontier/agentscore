'use client'

interface ProjectShareButtonsProps {
  projectName: string
  /** null = unknown (oppose read failed): the share text makes no score claim. */
  finalScore: number | null
}

export function ProjectShareButtons({ projectName, finalScore }: ProjectShareButtonsProps) {
  function copyLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }

  const tweetText = encodeURIComponent(
    finalScore == null
      ? `Check out ${projectName} on IntuForge!`
      : `Check out ${projectName} on IntuForge! Trust Score: ${finalScore}`
  )

  return (
    <div className="flex gap-2">
      <button
        onClick={copyLink}
        className="flex-1 py-2 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
      >
        Copy Link
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${tweetText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 py-2 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-colors text-center"
      >
        Share ↗
      </a>
    </div>
  )
}
