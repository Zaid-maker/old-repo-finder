import { ILogger } from '../interfaces/logger.interface';
import { IConfigService } from '../interfaces/config.interface';
import { IGitHubService } from '../interfaces/github.interface';
import { ICacheService } from '../interfaces/cache.interface';
import { IGitService } from '../interfaces/git.interface';
import { IHistoricalService } from '../interfaces/historical.interface';
import { IMarkdownService } from '../interfaces/markdown.interface';
import { IMonitoringService } from '../interfaces/monitoring.interface';
import { IRateLimiterService } from '../interfaces/rate-limiter.interface';
import { IRetryPolicyService } from '../interfaces/retry-policy.interface';
import { IParameterManager } from '../interfaces/parameter-manager.interface';

export class ServiceContainer {
    private static instance: ServiceContainer;
    private services: Map<string, any> = new Map();
    private initialized: boolean = false;

    private constructor() {}

    static getInstance(): ServiceContainer {
        if (!ServiceContainer.instance) {
            ServiceContainer.instance = new ServiceContainer();
        }
        return ServiceContainer.instance;
    }

    register<T>(token: string, service: T): void {
        this.services.set(token, service);
    }

    get<T>(token: string): T {
        const service = this.services.get(token);
        if (!service) {
            throw new Error(`Service not found: ${token}`);
        }
        return service;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    markAsInitialized(): void {
        this.initialized = true;
    }

    static readonly TOKENS = {
        Logger: 'Logger',
        Config: 'Config',
        GitHub: 'GitHub',
        Cache: 'Cache',
        Git: 'Git',
        Historical: 'Historical',
        Markdown: 'Markdown',
        Monitoring: 'Monitoring',
        ErrorHandler: 'ErrorHandler',
        ProcessManager: 'ProcessManager',
        RateLimiter: 'RateLimiter',
        RetryPolicy: 'RetryPolicy',
        ParameterManager: 'ParameterManager',
        Validation: 'Validation'
    } as const;

    clear(): void {
        this.services.clear();
        this.initialized = false;
    }

    hasService(token: string): boolean {
        return this.services.has(token);
    }

    listRegisteredServices(): string[] {
        return Array.from(this.services.keys());
    }
}

// Export type for service tokens
export type ServiceToken = typeof ServiceContainer.TOKENS[keyof typeof ServiceContainer.TOKENS];