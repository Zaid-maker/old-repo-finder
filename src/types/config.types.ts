export interface EnvironmentConfig {
    githubToken: string;
    resultFile: string;
    historicalFile: string;
    cacheDuration: number;
    requestTimeout: number;
    debug: boolean;
    maxCacheSize: number;
    rateLimits: {
        enabled: boolean;
        maxTokens: number;
        windowMs: number;
    };
    retry: {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
        timeout: number;
    };
}

export interface EnvConfigValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export const DEFAULT_ENV_CONFIG: EnvironmentConfig = {
    githubToken: '',
    resultFile: 'old-repos.md',
    historicalFile: 'historical-data.json',
    cacheDuration: 3600000, // 1 hour
    requestTimeout: 30000,  // 30 seconds
    debug: false,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    rateLimits: {
        enabled: true,
        maxTokens: 5000,
        windowMs: 3600000 // 1 hour
    },
    retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        timeout: 30000
    }
};