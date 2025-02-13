import { Repository } from '../types';

export interface ICacheService {
    get(key: string): Repository[] | null;
    set(key: string, data: Repository[]): void;
    getCacheKey(year: number, page: number, minStars: number): string;
    clear(): void;
    clearExpired(): void;
    getStats(): { total: number; expired: number };
}