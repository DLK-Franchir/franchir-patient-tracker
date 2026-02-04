import { Logger } from '../logger'

const logger = new Logger('Cache')

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheOptions {
  ttl?: number
  storage?: 'memory' | 'localStorage'
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 5 * 60 * 1000

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const { ttl = this.defaultTTL, storage = 'memory' } = options
    const timestamp = Date.now()
    const expiresAt = timestamp + ttl

    const entry: CacheEntry<T> = {
      data,
      timestamp,
      expiresAt,
    }

    if (storage === 'memory') {
      this.memoryCache.set(key, entry)
      logger.debug('Cache set (memory)', { key, expiresAt })
    } else if (storage === 'localStorage' && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify(entry))
        logger.debug('Cache set (localStorage)', { key, expiresAt })
      } catch (error) {
        logger.error('Error setting localStorage cache', { key, error })
      }
    }
  }

  get<T>(key: string, storage: 'memory' | 'localStorage' = 'memory'): T | null {
    let entry: CacheEntry<T> | null = null

    if (storage === 'memory') {
      entry = this.memoryCache.get(key) || null
    } else if (storage === 'localStorage' && typeof window !== 'undefined') {
      try {
        const item = localStorage.getItem(`cache_${key}`)
        if (item) {
          entry = JSON.parse(item)
        }
      } catch (error) {
        logger.error('Error getting localStorage cache', { key, error })
      }
    }

    if (!entry) {
      logger.debug('Cache miss', { key })
      return null
    }

    if (Date.now() > entry.expiresAt) {
      logger.debug('Cache expired', { key })
      this.delete(key, storage)
      return null
    }

    logger.debug('Cache hit', { key })
    return entry.data
  }

  delete(key: string, storage: 'memory' | 'localStorage' = 'memory'): void {
    if (storage === 'memory') {
      this.memoryCache.delete(key)
    } else if (storage === 'localStorage' && typeof window !== 'undefined') {
      localStorage.removeItem(`cache_${key}`)
    }
    logger.debug('Cache deleted', { key })
  }

  clear(storage: 'memory' | 'localStorage' = 'memory'): void {
    if (storage === 'memory') {
      this.memoryCache.clear()
      logger.debug('Memory cache cleared')
    } else if (storage === 'localStorage' && typeof window !== 'undefined') {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'))
      keys.forEach(key => localStorage.removeItem(key))
      logger.debug('localStorage cache cleared')
    }
  }

  has(key: string, storage: 'memory' | 'localStorage' = 'memory'): boolean {
    const data = this.get(key, storage)
    return data !== null
  }

  invalidatePattern(pattern: string, storage: 'memory' | 'localStorage' = 'memory'): void {
    if (storage === 'memory') {
      const keys = Array.from(this.memoryCache.keys()).filter(k => k.includes(pattern))
      keys.forEach(key => this.memoryCache.delete(key))
      logger.debug('Cache pattern invalidated (memory)', { pattern, count: keys.length })
    } else if (storage === 'localStorage' && typeof window !== 'undefined') {
      const keys = Object.keys(localStorage)
        .filter(k => k.startsWith('cache_') && k.includes(pattern))
      keys.forEach(key => localStorage.removeItem(key))
      logger.debug('Cache pattern invalidated (localStorage)', { pattern, count: keys.length })
    }
  }

  cleanExpired(storage: 'memory' | 'localStorage' = 'memory'): void {
    const now = Date.now()

    if (storage === 'memory') {
      let count = 0
      this.memoryCache.forEach((entry, key) => {
        if (now > entry.expiresAt) {
          this.memoryCache.delete(key)
          count++
        }
      })
      logger.debug('Expired cache entries cleaned (memory)', { count })
    } else if (storage === 'localStorage' && typeof window !== 'undefined') {
      let count = 0
      const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'))
      keys.forEach(key => {
        try {
          const item = localStorage.getItem(key)
          if (item) {
            const entry = JSON.parse(item)
            if (now > entry.expiresAt) {
              localStorage.removeItem(key)
              count++
            }
          }
        } catch (error) {
          localStorage.removeItem(key)
          count++
        }
      })
      logger.debug('Expired cache entries cleaned (localStorage)', { count })
    }
  }
}

export const cache = new CacheManager()

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { storage = 'memory' } = options
  const cached = cache.get<T>(key, storage)

  if (cached !== null) {
    return cached
  }

  const data = await fetcher()
  cache.set(key, data, options)
  return data
}

if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.cleanExpired('memory')
    cache.cleanExpired('localStorage')
  }, 60000)
}
