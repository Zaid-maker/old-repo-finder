import { IRateLimiterService } from '../interfaces/rate-limiter.interface';
import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';

export class RateLimiterService implements IRateLimiterService {
    private tokens: number;
    private maxTokens: number;
    private resetTimestamp: number;
    private readonly logger: ILogger;
    private waitingQueue: Array<{ resolve: () => void }> = [];

    constructor() {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.tokens = 5000; // GitHub's default rate limit
        this.maxTokens = 5000;
        this.resetTimestamp = Date.now() + 3600000; // Default 1 hour window
    }

    async acquire(): Promise<void> {
        if (this.tokens > 0) {
            this.tokens--;
            this.logger.debug(`Rate limiter: token acquired, ${this.tokens} remaining`);
            return;
        }

        if (Date.now() >= this.resetTimestamp) {
            this.reset();
            return this.acquire();
        }

        this.logger.debug('Rate limiter: waiting for token...');
        return new Promise<void>(resolve => {
            this.waitingQueue.push({ resolve });
            
            // Set timeout to auto-resolve when reset time is reached
            const timeoutMs = this.resetTimestamp - Date.now();
            setTimeout(() => {
                const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
                if (index !== -1) {
                    this.waitingQueue.splice(index, 1);
                    this.reset();
                    resolve();
                }
            }, timeoutMs);
        });
    }

    release(): void {
        if (this.waitingQueue.length > 0 && this.tokens > 0) {
            const next = this.waitingQueue.shift();
            if (next) {
                this.tokens--;
                next.resolve();
                this.logger.debug(`Rate limiter: token released to waiting request, ${this.tokens} remaining`);
            }
        }
    }

    getRemainingTokens(): number {
        return this.tokens;
    }

    getResetTime(): Date {
        return new Date(this.resetTimestamp);
    }

    updateQuota(remaining: number, resetTimestamp: number): void {
        this.tokens = remaining;
        this.resetTimestamp = resetTimestamp * 1000; // Convert to milliseconds
        this.logger.debug(`Rate limiter: quota updated - ${remaining} tokens, resets at ${new Date(this.resetTimestamp).toLocaleString()}`);
        
        // If tokens become available, process waiting queue
        if (remaining > 0) {
            while (this.waitingQueue.length > 0 && this.tokens > 0) {
                const next = this.waitingQueue.shift();
                if (next) {
                    this.tokens--;
                    next.resolve();
                }
            }
        }
    }

    setMaxTokens(tokens: number): void {
        this.maxTokens = tokens;
        if (this.tokens > tokens) {
            this.tokens = tokens;
        }
        this.logger.debug(`Rate limiter: max tokens set to ${tokens}`);
    }

    isLimited(): boolean {
        return this.tokens === 0 && Date.now() < this.resetTimestamp;
    }

    private reset(): void {
        this.tokens = this.maxTokens;
        this.resetTimestamp = Date.now() + 3600000;
        this.logger.debug(`Rate limiter: reset with ${this.tokens} tokens`);
    }
}