export interface RetryOptions {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    timeout: number;
    retryableStatusCodes: number[];
}

export interface IRetryPolicyService {
    getRetryDelay(attempt: number): number;
    shouldRetry(error: unknown, attempt: number): boolean;
    getTimeout(): number;
    configure(options: Partial<RetryOptions>): void;
    getOptions(): RetryOptions;
}