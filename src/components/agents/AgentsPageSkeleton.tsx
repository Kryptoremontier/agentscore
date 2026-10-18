import { PageBackground } from '@/components/shared/PageBackground'

/**
 * The /agents page while its list is still on the way (Etap 7a): only when the server has no
 * cached list to put in the first HTML (a cold cache) does the page stream this first and the
 * list after it. Same outer frame as the page, so nothing around it moves when the list lands.
 */
export function AgentsPageSkeleton() {
  return (
    <PageBackground image="wave" opacity={0.3}>
      <div className="pt-24 pb-16" data-testid="agents-skeleton">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-64 bg-white/10 rounded-lg" />
            <div className="h-12 bg-white/5 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card h-48 bg-white/5" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  )
}
