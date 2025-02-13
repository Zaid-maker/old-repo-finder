import { Options } from '../types';
import { IConfigService } from '../interfaces/config.interface';
import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';

export class ConfigService implements IConfigService {
    private _options: Options;
    private _githubToken: string;
    private _resultFile: string;
    private _historicalFile: string;
    private _cacheDuration: number;
    private _requestTimeout: number;
    private readonly logger: ILogger;

    constructor() {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
        
        // Set default values
        this._options = {
            minStars: 0,
            maxRepos: 1000,
            concurrency: 3,
            yearStart: 2008,
            yearEnd: 2013,
            autoPush: false,
            debug: false
        };

        this._resultFile = "old-repos.md";
        this._historicalFile = "historical-data.json";
        this._cacheDuration = 3600000; // 1 hour
        this._requestTimeout = 30000;   // 30 seconds
        
        this.loadEnvConfig();
    }

    get githubToken(): string {
        if (!this._githubToken) {
            throw new Error('GitHub token not configured');
        }
        return this._githubToken;
    }

    get resultFile(): string {
        return this._resultFile;
    }

    get historicalFile(): string {
        return this._historicalFile;
    }

    get cacheDuration(): number {
        return this._cacheDuration;
    }

    get requestTimeout(): number {
        return this._requestTimeout;
    }

    get options(): Options {
        return { ...this._options };
    }

    updateOptions(options: Partial<Options>): void {
        this._options = {
            ...this._options,
            ...options
        };
        this.logger.debug('Updated options:', this._options);
    }

    loadEnvConfig(): void {
        try {
            // Load GitHub token
            this._githubToken = process.env.GITHUB_TOKEN || '';
            
            // Load optional configurations
            if (process.env.RESULT_FILE) {
                this._resultFile = process.env.RESULT_FILE;
            }

            if (process.env.HISTORICAL_FILE) {
                this._historicalFile = process.env.HISTORICAL_FILE;
            }

            if (process.env.CACHE_DURATION) {
                const duration = parseInt(process.env.CACHE_DURATION);
                if (!isNaN(duration)) {
                    this._cacheDuration = duration;
                }
            }

            if (process.env.REQUEST_TIMEOUT) {
                const timeout = parseInt(process.env.REQUEST_TIMEOUT);
                if (!isNaN(timeout)) {
                    this._requestTimeout = timeout;
                }
            }

            // Load debug mode from environment
            if (process.env.DEBUG === 'true') {
                this._options.debug = true;
            }

            this.logger.debug('Environment configuration loaded');
        } catch (error) {
            this.logger.error('Failed to load environment configuration:', error);
            throw error;
        }
    }

    validate(): boolean {
        try {
            if (!this._githubToken) {
                this.logger.error('GitHub token is required');
                return false;
            }

            if (this._options.yearStart > this._options.yearEnd) {
                this.logger.error('Start year must be less than or equal to end year');
                return false;
            }

            if (this._options.yearStart < 2008) {
                this.logger.error('Start year cannot be earlier than 2008');
                return false;
            }

            if (this._options.minStars < 0) {
                this.logger.error('Minimum stars cannot be negative');
                return false;
            }

            if (this._options.maxRepos <= 0) {
                this.logger.error('Maximum repositories must be greater than 0');
                return false;
            }

            if (this._options.concurrency <= 0 || this._options.concurrency > 5) {
                this.logger.error('Concurrency must be between 1 and 5');
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error('Configuration validation failed:', error);
            return false;
        }
    }
}