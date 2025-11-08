import NodeCache from 'node-cache';

/**
 * Cache Service for in-memory caching
 * Uses node-cache for simple key-value storage
 */
export class CacheService {
  private cache: NodeCache;

  constructor(ttlSeconds: number = 300) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds, // Default TTL: 5 minutes
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Better performance
    });
  }

  /**
   * Get value from cache or fetch if not exists
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.cache.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }

    const fresh = await fetcher();
    this.cache.set(key, fresh, ttl || this.cache.options.stdTTL);
    
    return fresh;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || this.cache.options.stdTTL);
  }

  /**
   * Get value from cache (without fetching)
   */
  getValue<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): number {
    return this.cache.del(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Generate cache key with prefix
   */
  static key(prefix: string, ...parts: (string | number | undefined)[]): string {
    const validParts = parts.filter(p => p !== undefined && p !== null);
    return `${prefix}:${validParts.join(':')}`;
  }
}

// Singleton instance
export const cacheService = new CacheService(300); // 5 minutes default TTL

