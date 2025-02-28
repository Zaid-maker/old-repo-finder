import { IRetryPolicyService, RetryOptions } from '../interfaces/retry-policy.interface';
import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';
import { GitHubApiError, NetworkError } from '../utils/errors';

export class RetryPolicyService implements IRetryPolicyService {
    private readonly logger: ILogger;
    private options: RetryOptions;

    constructor() {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.options = {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            timeout: 30000,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504]
        };
    }

    getRetryDelay(attempt: number): number {
        const delay = Math.min(
            this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt - 1),
            this.options.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 200 - 100; // ±100ms
        return Math.max(0, delay + jitter);
    }

    shouldRetry(error: unknown, attempt: number): boolean {
        if (attempt >= this.options.maxAttempts) {
            this.logger.debug('Max retry attempts reached');
            return false;
        }

        if (error instanceof GitHubApiError) {
            const shouldRetry = this.options.retryableStatusCodes.includes(error.status);
            this.logger.debug(`GitHub API error ${error.status} ${shouldRetry ? 'is' : 'is not'} retryable`);
            return shouldRetry;
        }

        if (error instanceof NetworkError) {
            this.logger.debug('Network error is retryable');
            return true;
        }

        if (error instanceof Error && error.name === 'AbortError') {
            this.logger.debug('Timeout error is retryable');
            return true;
        }

        this.logger.debug('Unknown error type is not retryable');
        return false;
    }

    getTimeout(): number {
        return this.options.timeout;
    }

    configure(options: Partial<RetryOptions>): void {
        this.options = {
            ...this.options,
            ...options
        };

        this.logger.debug('Retry policy configured:', this.options);
    }

    getOptions(): RetryOptions {
        return { ...this.options };
    }
}