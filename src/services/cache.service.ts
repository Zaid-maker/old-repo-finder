import { Repository, Cache } from '../types';
import { ICacheService } from '../interfaces/cache.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IConfigService } from '../interfaces/config.interface';
import { ServiceContainer } from './service-container';
import { CacheError } from '../utils/errors';

export class CacheService implements ICacheService {
    private cache: Cache = {};
    private readonly logger: ILogger;
    private readonly config: IConfigService;
    private readonly maxCacheSize = 100 * 1024 * 1024; // 100MB
    private currentCacheSize = 0;

    constructor() {
        const container = ServiceContainer.getInstance();
        this.logger = container.get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.config = container.get<IConfigService>(ServiceContainer.TOKENS.Config);
    }

    private calculateSize(data: Repository[]): number {
        return Buffer.byteLength(JSON.stringify(data));
    }

    private evictOldEntries(requiredSpace: number): void {
        const entries = Object.entries(this.cache)
            .sort(([, a], [, b]) => a.timestamp - b.timestamp);

        while (this.currentCacheSize + requiredSpace > this.maxCacheSize && entries.length > 0) {
            const [key, entry] = entries.shift()!;
            const entrySize = this.calculateSize(entry.data);
            delete this.cache[key];
            this.currentCacheSize -= entrySize;
            this.logger.debug(`Evicted cache entry: ${key}, freed ${entrySize} bytes`);
        }
    }

    getCacheKey(year: number, page: number, minStars: number): string {
        return `${year}-${page}-${minStars}`;
    }

    get(key: string): Repository[] | null {
        try {
            const cached = this.cache[key];
            if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
                this.logger.debug(`Cache hit for key: ${key}`);
                return cached.data;
            }

            if (cached) {
                this.logger.debug(`Cache expired for key: ${key}`);
                delete this.cache[key];
                this.currentCacheSize -= this.calculateSize(cached.data);
            }

            return null;
        } catch (error) {
            throw new CacheError('read', key, error instanceof Error ? error.message : String(error));
        }
    }

    set(key: string, data: Repository[]): void {
        try {
            const dataSize = this.calculateSize(data);

            if (dataSize > this.maxCacheSize) {
                throw new CacheError('write', key, 'Data size exceeds maximum cache size');
            }

            this.evictOldEntries(dataSize);

            if (this.currentCacheSize + dataSize > this.maxCacheSize) {
                throw new CacheError('write', key, 'Insufficient cache space after eviction');
            }

            // Remove old entry if it exists
            if (this.cache[key]) {
                this.currentCacheSize -= this.calculateSize(this.cache[key].data);
            }

            // Add new entry
            this.cache[key] = {
                data,
                timestamp: Date.now()
            };
            this.currentCacheSize += dataSize;

            this.logger.debug(`Cached data for key: ${key}, size: ${dataSize} bytes`);
        } catch (error) {
            if (error instanceof CacheError) {
                throw error;
            }
            throw new CacheError('write', key, error instanceof Error ? error.message : String(error));
        }
    }

    clear(): void {
        try {
            this.cache = {};
            this.currentCacheSize = 0;
            this.logger.debug('Cache cleared');
        } catch (error) {
            throw new CacheError('delete', 'all', error instanceof Error ? error.message : String(error));
        }
    }

    clearExpired(): void {
        try {
            const now = Date.now();
            let clearedCount = 0;
            let freedSpace = 0;

            Object.entries(this.cache).forEach(([key, value]) => {
                if (now - value.timestamp > this.config.cacheDuration) {
                    const entrySize = this.calculateSize(value.data);
                    delete this.cache[key];
                    this.currentCacheSize -= entrySize;
                    clearedCount++;
                    freedSpace += entrySize;
                }
            });

            this.logger.debug(`Cleared ${clearedCount} expired entries, freed ${freedSpace} bytes`);
        } catch (error) {
            throw new CacheError('delete', 'expired', error instanceof Error ? error.message : String(error));
        }
    }

    getStats(): { total: number; expired: number } {
        const now = Date.now();
        const total = Object.keys(this.cache).length;
        const expired = Object.values(this.cache).filter(
            value => now - value.timestamp > this.config.cacheDuration
        ).length;

        return {
            total,
            expired
        };
    }

    getCacheSize(): { current: number; max: number; usage: number } {
        return {
            current: this.currentCacheSize,
            max: this.maxCacheSize,
            usage: (this.currentCacheSize / this.maxCacheSize) * 100
        };
    }
}