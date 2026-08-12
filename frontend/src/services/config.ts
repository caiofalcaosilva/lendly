import api from '@/lib/api'

interface PublicConfig {
  free_lending_only: boolean
}

let cache: PublicConfig | null = null
let inflight: Promise<PublicConfig> | null = null

export const configService = {
  // Public, unauthenticated — cached in memory after the first call, same
  // reasoning as categoriesService: this is deploy-level config, it can't
  // change during a session, so every component that needs it shares one
  // request instead of firing one each.
  get: async (): Promise<PublicConfig> => {
    if (cache) return cache
    if (!inflight) {
      inflight = api.get<PublicConfig>('/config').then((r) => {
        cache = r.data
        inflight = null
        return r.data
      })
    }
    return inflight
  },
}
