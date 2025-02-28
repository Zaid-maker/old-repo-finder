export interface IRateLimiterService {
    acquire(): Promise<void>;
    release(): void;
    getRemainingTokens(): number;
    getResetTime(): Date;
    updateQuota(remaining: number, resetTimestamp: number): void;
    setMaxTokens(tokens: number): void;
    isLimited(): boolean;
}