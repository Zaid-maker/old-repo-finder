import { Repository, Cache } from '../types';
import { CACHE_DURATION } from '../config/config';
import { debug } from '../utils/helpers';

export class CacheService {
    private static cache: Cache = {};

    static getCacheKey(year: number, page: number, minStars: number): string {
        return `${year}-${page}-${minStars}`;
    }

    static get(key: string): Repository[] | null {
        const cached = this.cache[key];
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            debug('Cache hit for key:', key);
            return cached.data;
        }
        debug('Cache miss for key:', key);
        return null;
    }

    static set(key: string, data: Repository[]): void {
        debug('Caching data for key:', key);
        this.cache[key] = {
            data,
            timestamp: Date.now()
        };
    }

    static clear(): void {
        debug('Clearing cache');
        this.cache = {};
    }

    static clearExpired(): void {
        const now = Date.now();
        Object.entries(this.cache).forEach(([key, value]) => {
            if (now - value.timestamp > CACHE_DURATION) {
                debug('Removing expired cache entry:', key);
                delete this.cache[key];
            }
        });
    }

    static getStats(): { total: number; expired: number } {
        const now = Date.now();
        const total = Object.keys(this.cache).length;
        const expired = Object.values(this.cache).filter(
            value => now - value.timestamp > CACHE_DURATION
        ).length;
        return { total, expired };
    }
}