import { IParameterManager } from '../interfaces/parameter-manager.interface';
import { ILogger } from '../interfaces/logger.interface';
import { Options } from '../types';
import { EnvironmentConfig, DEFAULT_ENV_CONFIG } from '../types/config.types';
import { ServiceContainer } from './service-container';
import { EnvironmentConfigService } from './env-config.service';
import { ValidationService } from './validation.service';
import { ConfigurationError, ValidationError } from '../utils/errors';

export class ParameterManagerService implements IParameterManager {
    private options: Options;
    private envConfig: EnvironmentConfig;
    private readonly logger: ILogger;
    private readonly validation: ValidationService;

    constructor() {
        const container = ServiceContainer.getInstance();
        this.logger = container.get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.validation = container.get<ValidationService>(ServiceContainer.TOKENS.Validation);
        
        this.options = {
            minStars: 0,
            maxRepos: 1000,
            concurrency: 3,
            yearStart: 2008,
            yearEnd: 2013,
            autoPush: false,
            debug: false
        };

        this.envConfig = { ...DEFAULT_ENV_CONFIG };
    }

    async initialize(args: string[]): Promise<void> {
        try {
            // Initialize environment configuration
            EnvironmentConfigService.initialize();
            this.envConfig = EnvironmentConfigService.get();

            // Parse command line arguments
            await this.parseCommandLineArgs(args);

            // Sync debug mode between options and environment
            if (this.options.debug) {
                this.envConfig.debug = true;
                EnvironmentConfigService.update({ debug: true });
            }

            this.logger.debug('Parameter manager initialized', {
                options: this.options,
                environmentConfig: this.envConfig
            });
        } catch (error) {
            throw new ConfigurationError(
                `Failed to initialize parameters: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async parseCommandLineArgs(args: string[]): Promise<void> {
        for (let i = 0; i < args.length; i++) {
            const key = args[i];
            const value = args[i + 1];

            switch (key) {
                case '--min-stars':
                    this.options.minStars = parseInt(value);
                    i++;
                    break;
                case '--max-repos':
                    this.options.maxRepos = parseInt(value);
                    i++;
                    break;
                case '--concurrency':
                    this.options.concurrency = parseInt(value);
                    i++;
                    break;
                case '--year-start':
                    this.options.yearStart = parseInt(value);
                    i++;
                    break;
                case '--year-end':
                    this.options.yearEnd = parseInt(value);
                    i++;
                    break;
                case '--auto-push':
                    this.options.autoPush = true;
                    break;
                case '--debug':
                    this.options.debug = true;
                    break;
                case '--help':
                    this.printHelp();
                    process.exit(0);
                default:
                    if (key.startsWith('--')) {
                        throw new ValidationError([`Unknown option: ${key}`]);
                    }
            }
        }
    }

    getOptions(): Options {
        return { ...this.options };
    }

    getEnvironmentConfig(): EnvironmentConfig {
        return { ...this.envConfig };
    }

    updateOptions(options: Partial<Options>): void {
        this.options = {
            ...this.options,
            ...options
        };
        this.logger.debug('Options updated:', this.options);
    }

    updateEnvironmentConfig(config: Partial<EnvironmentConfig>): void {
        this.envConfig = {
            ...this.envConfig,
            ...config
        };
        EnvironmentConfigService.update(config);
        this.logger.debug('Environment configuration updated:', config);
    }

    async validate(): Promise<boolean> {
        try {
            // Validate options
            this.validation.validateOptions(this.options);

            // Validate environment configuration
            const envValidation = EnvironmentConfigService.validate();
            if (!envValidation.isValid) {
                throw new ValidationError(envValidation.errors);
            }

            // Log any warnings
            if (envValidation.warnings.length > 0) {
                envValidation.warnings.forEach(warning => {
                    this.logger.warn(warning);
                });
            }

            return true;
        } catch (error) {
            if (error instanceof ValidationError) {
                error.errors.forEach(err => this.logger.error(err));
            } else {
                this.logger.error('Validation failed:', error);
            }
            return false;
        }
    }

    printHelp(): void {
        const help = `
Old Repository Finder - Find historical GitHub repositories

Usage:
  bun run index.ts [options]

Options:
  --min-stars <number>     Minimum number of stars (default: ${this.options.minStars})
  --max-repos <number>     Maximum number of repositories to fetch (default: ${this.options.maxRepos})
  --concurrency <number>   Number of concurrent requests (1-5, default: ${this.options.concurrency})
  --year-start <number>    Start year for search (>= 2008, default: ${this.options.yearStart})
  --year-end <number>      End year for search (default: ${this.options.yearEnd})
  --auto-push             Automatically commit and push changes
  --debug                 Enable debug mode
  --help                  Show this help message

Environment Variables:
  GITHUB_TOKEN            GitHub API token (required)
  RESULT_FILE            Output file path (default: ${this.envConfig.resultFile})
  HISTORICAL_FILE        Historical data file path (default: ${this.envConfig.historicalFile})
  DEBUG                  Enable debug mode (default: ${this.envConfig.debug})
  CACHE_DURATION        Cache duration in milliseconds (default: ${this.envConfig.cacheDuration})
  REQUEST_TIMEOUT       Request timeout in milliseconds (default: ${this.envConfig.requestTimeout})
  
Examples:
  bun run index.ts --min-stars 100 --year-start 2010 --year-end 2012
  bun run index.ts --max-repos 500 --concurrency 3 --auto-push
  
For more information, visit: https://github.com/your-username/old-repo-finder
`;
        console.log(help);
    }
}