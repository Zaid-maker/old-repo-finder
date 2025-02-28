import { EnvironmentConfig, EnvConfigValidation, DEFAULT_ENV_CONFIG } from '../types/config.types';
import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';
import { ConfigurationError } from '../utils/errors';

export class EnvironmentConfigService {
    private static config: EnvironmentConfig = { ...DEFAULT_ENV_CONFIG };
    private static logger: ILogger;

    static initialize(): void {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.loadFromEnv();
    }

    private static loadFromEnv(): void {
        try {
            // Core settings
            this.config.githubToken = process.env.GITHUB_TOKEN || this.config.githubToken;
            this.config.resultFile = process.env.RESULT_FILE || this.config.resultFile;
            this.config.historicalFile = process.env.HISTORICAL_FILE || this.config.historicalFile;
            this.config.debug = process.env.DEBUG === 'true' || this.config.debug;

            // Cache settings
            if (process.env.CACHE_DURATION) {
                this.config.cacheDuration = parseInt(process.env.CACHE_DURATION);
            }
            if (process.env.MAX_CACHE_SIZE) {
                this.config.maxCacheSize = parseInt(process.env.MAX_CACHE_SIZE);
            }

            // Request settings
            if (process.env.REQUEST_TIMEOUT) {
                this.config.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT);
            }

            // Rate limiting settings
            if (process.env.RATE_LIMIT_ENABLED) {
                this.config.rateLimits.enabled = process.env.RATE_LIMIT_ENABLED === 'true';
            }
            if (process.env.RATE_LIMIT_MAX_TOKENS) {
                this.config.rateLimits.maxTokens = parseInt(process.env.RATE_LIMIT_MAX_TOKENS);
            }
            if (process.env.RATE_LIMIT_WINDOW_MS) {
                this.config.rateLimits.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS);
            }

            // Retry settings
            if (process.env.RETRY_MAX_ATTEMPTS) {
                this.config.retry.maxAttempts = parseInt(process.env.RETRY_MAX_ATTEMPTS);
            }
            if (process.env.RETRY_INITIAL_DELAY) {
                this.config.retry.initialDelay = parseInt(process.env.RETRY_INITIAL_DELAY);
            }
            if (process.env.RETRY_MAX_DELAY) {
                this.config.retry.maxDelay = parseInt(process.env.RETRY_MAX_DELAY);
            }
            if (process.env.RETRY_BACKOFF_MULTIPLIER) {
                this.config.retry.backoffMultiplier = parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER);
            }
            if (process.env.RETRY_TIMEOUT) {
                this.config.retry.timeout = parseInt(process.env.RETRY_TIMEOUT);
            }

            this.logger.debug('Environment configuration loaded:', this.config);
        } catch (error) {
            throw new ConfigurationError(`Failed to load environment configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    static validate(): EnvConfigValidation {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Required settings
        if (!this.config.githubToken) {
            errors.push('GITHUB_TOKEN environment variable is required');
        }

        // Numeric validations
        if (this.config.cacheDuration <= 0) {
            errors.push('CACHE_DURATION must be positive');
        }
        if (this.config.maxCacheSize <= 0) {
            errors.push('MAX_CACHE_SIZE must be positive');
        }
        if (this.config.requestTimeout <= 0) {
            errors.push('REQUEST_TIMEOUT must be positive');
        }

        // Rate limit validations
        if (this.config.rateLimits.enabled) {
            if (this.config.rateLimits.maxTokens <= 0) {
                errors.push('RATE_LIMIT_MAX_TOKENS must be positive');
            }
            if (this.config.rateLimits.windowMs <= 0) {
                errors.push('RATE_LIMIT_WINDOW_MS must be positive');
            }
        }

        // Retry validations
        if (this.config.retry.maxAttempts < 1) {
            errors.push('RETRY_MAX_ATTEMPTS must be at least 1');
        }
        if (this.config.retry.initialDelay <= 0) {
            errors.push('RETRY_INITIAL_DELAY must be positive');
        }
        if (this.config.retry.maxDelay < this.config.retry.initialDelay) {
            errors.push('RETRY_MAX_DELAY must be greater than or equal to RETRY_INITIAL_DELAY');
        }
        if (this.config.retry.backoffMultiplier <= 1) {
            errors.push('RETRY_BACKOFF_MULTIPLIER must be greater than 1');
        }
        if (this.config.retry.timeout <= 0) {
            errors.push('RETRY_TIMEOUT must be positive');
        }

        // Performance warnings
        if (this.config.maxCacheSize > 500 * 1024 * 1024) {
            warnings.push('MAX_CACHE_SIZE is set above 500MB, which may impact performance');
        }
        if (this.config.requestTimeout > 60000) {
            warnings.push('REQUEST_TIMEOUT is set above 60 seconds, which may lead to long-running operations');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    static get(): EnvironmentConfig {
        return { ...this.config };
    }

    static update(updates: Partial<EnvironmentConfig>): void {
        this.config = {
            ...this.config,
            ...updates
        };
        this.logger.debug('Environment configuration updated:', updates);
    }
}