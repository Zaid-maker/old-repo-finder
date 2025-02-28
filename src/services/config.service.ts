import { IConfigService } from '../interfaces/config.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IParameterManager } from '../interfaces/parameter-manager.interface';
import { Options } from '../types';
import { ConfigurationError } from '../utils/errors';

export class ConfigService implements IConfigService {
    private options: Options;
    private githubToken: string;
    private resultFile: string;
    private historicalFile: string;
    private cacheDuration: number;
    private requestTimeout: number;

    constructor(
        private readonly logger: ILogger,
        private readonly parameterManager: IParameterManager
    ) {
        this.loadConfig();
    }

    private loadConfig(): void {
        try {
            const envConfig = this.parameterManager.getEnvironmentConfig();
            this.options = this.parameterManager.getOptions();
            
            this.githubToken = envConfig.githubToken;
            this.resultFile = envConfig.resultFile;
            this.historicalFile = envConfig.historicalFile;
            this.cacheDuration = envConfig.cacheDuration;
            this.requestTimeout = envConfig.requestTimeout;

            this.logger.debug('Configuration loaded:', {
                resultFile: this.resultFile,
                historicalFile: this.historicalFile,
                cacheDuration: this.cacheDuration,
                requestTimeout: this.requestTimeout,
                options: this.options
            });
        } catch (error) {
            throw new ConfigurationError(
                `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    get githubToken(): string {
        return this.githubToken;
    }

    get resultFile(): string {
        return this.resultFile;
    }

    get historicalFile(): string {
        return this.historicalFile;
    }

    get cacheDuration(): number {
        return this.cacheDuration;
    }

    get requestTimeout(): number {
        return this.requestTimeout;
    }

    get options(): Options {
        return { ...this.options };
    }

    updateOptions(options: Partial<Options>): void {
        this.options = {
            ...this.options,
            ...options
        };
        this.logger.debug('Options updated:', this.options);
    }

    validate(): boolean {
        if (!this.githubToken) {
            this.logger.error('GitHub token is not set');
            return false;
        }

        if (this.options.yearStart > this.options.yearEnd) {
            this.logger.error('Start year cannot be after end year');
            return false;
        }

        if (this.options.yearStart < 2008) {
            this.logger.error('Start year cannot be before 2008');
            return false;
        }

        if (this.options.concurrency < 1 || this.options.concurrency > 5) {
            this.logger.error('Concurrency must be between 1 and 5');
            return false;
        }

        return true;
    }
}