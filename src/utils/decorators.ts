import { ServiceContainer } from '../services/service-container';
import { IRetryPolicyService } from '../interfaces/retry-policy.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IMonitoringService } from '../interfaces/monitoring.interface';

export function withRetry(operationName: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const container = ServiceContainer.getInstance();
            const retryPolicy = container.get<IRetryPolicyService>(ServiceContainer.TOKENS.RetryPolicy);
            const logger = container.get<ILogger>(ServiceContainer.TOKENS.Logger);
            const monitoring = container.get<IMonitoringService>(ServiceContainer.TOKENS.Monitoring);

            let attempt = 1;
            let lastError: Error | null = null;

            while (attempt <= retryPolicy.getOptions().maxAttempts) {
                try {
                    monitoring.startOperation(`${operationName}_attempt_${attempt}`);
                    const result = await originalMethod.apply(this, args);
                    monitoring.endOperation(`${operationName}_attempt_${attempt}`);
                    return result;
                } catch (error) {
                    lastError = error as Error;
                    monitoring.endOperation(`${operationName}_attempt_${attempt}`);

                    if (!retryPolicy.shouldRetry(error, attempt)) {
                        logger.debug(`Not retrying ${operationName} after attempt ${attempt}:`, error);
                        throw error;
                    }

                    if (attempt < retryPolicy.getOptions().maxAttempts) {
                        const delay = retryPolicy.getRetryDelay(attempt);
                        logger.debug(
                            `Retrying ${operationName} after attempt ${attempt} in ${delay}ms:`,
                            error
                        );
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                attempt++;
            }

            throw lastError;
        };

        return descriptor;
    };
}

export function withTimeout(timeoutMs?: number) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const container = ServiceContainer.getInstance();
            const retryPolicy = container.get<IRetryPolicyService>(ServiceContainer.TOKENS.RetryPolicy);
            const timeout = timeoutMs ?? retryPolicy.getTimeout();

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Operation timed out after ${timeout}ms`));
                }, timeout);
            });

            return Promise.race([
                originalMethod.apply(this, args),
                timeoutPromise
            ]);
        };

        return descriptor;
    };
}

export function withRateLimit() {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const container = ServiceContainer.getInstance();
            const rateLimiter = container.get<IRateLimiterService>(ServiceContainer.TOKENS.RateLimiter);

            await rateLimiter.acquire();
            try {
                return await originalMethod.apply(this, args);
            } finally {
                rateLimiter.release();
            }
        };

        return descriptor;
    };
}

export function withMonitoring(operationName: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const container = ServiceContainer.getInstance();
            const monitoring = container.get<IMonitoringService>(ServiceContainer.TOKENS.Monitoring);

            monitoring.startOperation(operationName);
            try {
                return await originalMethod.apply(this, args);
            } finally {
                monitoring.endOperation(operationName);
            }
        };

        return descriptor;
    };
}