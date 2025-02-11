import { Options, ValidationResult } from '../types';
import { ValidationError, ConfigurationError } from '../utils/errors';
import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';

export interface IValidationService {
    validateOptions(options: Options): void;
    validateToken(token: string | undefined): void;
    validateArguments(args: string[]): void;
    validateEnvironment(): Promise<void>;
}

export class ValidationService implements IValidationService {
    private readonly logger: ILogger;

    constructor() {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
    }

    validateOptions(options: Options): void {
        const errors: string[] = [];
        const currentYear = new Date().getFullYear();

        try {
            // Time range validation
            if (options.yearStart > options.yearEnd) {
                errors.push('Start year must be less than or equal to end year');
            }

            if (options.yearStart < 2008) {
                errors.push('Start year cannot be earlier than 2008 (GitHub\'s founding year)');
            }

            if (options.yearEnd > currentYear) {
                errors.push(`End year cannot be later than current year (${currentYear})`);
            }

            const yearRange = options.yearEnd - options.yearStart;
            if (yearRange > 20) {
                errors.push('Year range cannot exceed 20 years to prevent excessive API usage');
            }

            // Numeric constraints validation
            if (!Number.isInteger(options.minStars) || options.minStars < 0) {
                errors.push('Minimum stars must be a non-negative integer');
            }

            if (!Number.isInteger(options.maxRepos) || options.maxRepos <= 0) {
                errors.push('Maximum repositories must be a positive integer');
            }

            if (options.maxRepos > 10000) {
                errors.push('Maximum repositories cannot exceed 10000 due to API limitations');
            }

            if (!Number.isInteger(options.concurrency) || options.concurrency <= 0 || options.concurrency > 5) {
                errors.push('Concurrency must be an integer between 1 and 5');
            }

            // Boolean validations
            if (typeof options.autoPush !== 'boolean') {
                errors.push('autoPush must be a boolean value');
            }

            if (typeof options.debug !== 'boolean') {
                errors.push('debug must be a boolean value');
            }

            if (errors.length > 0) {
                throw new ValidationError(errors);
            }

            this.logger.debug('Options validation passed');
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError([`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`]);
        }
    }

    validateToken(token: string | undefined): void {
        if (!token) {
            throw new ConfigurationError('Missing GITHUB_TOKEN environment variable');
        }

        if (!/^gh[ps]_[a-zA-Z0-9]{36}$/.test(token)) {
            throw new ConfigurationError('Invalid GitHub token format. Expected format: gho_XXXXX or ghp_XXXXX');
        }

        this.logger.debug('Token validation passed');
    }

    validateArguments(args: string[]): void {
        const errors: string[] = [];
        const validOptions = new Set([
            '--min-stars',
            '--max-repos',
            '--concurrency',
            '--year-start',
            '--year-end',
            '--auto-push',
            '--debug',
            '--help'
        ]);

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                if (!validOptions.has(arg)) {
                    errors.push(`Unknown option: ${arg}`);
                    continue;
                }

                if (arg !== '--auto-push' && arg !== '--debug' && arg !== '--help') {
                    const value = args[i + 1];
                    if (!value || value.startsWith('--')) {
                        errors.push(`Missing value for option: ${arg}`);
                    } else if (!/^-?\d+$/.test(value)) {
                        errors.push(`Invalid numeric value for option: ${arg}`);
                    } else {
                        const numValue = parseInt(value);
                        switch (arg) {
                            case '--min-stars':
                                if (numValue < 0) errors.push('--min-stars must be non-negative');
                                break;
                            case '--max-repos':
                                if (numValue <= 0) errors.push('--max-repos must be positive');
                                if (numValue > 10000) errors.push('--max-repos cannot exceed 10000');
                                break;
                            case '--concurrency':
                                if (numValue < 1 || numValue > 5) errors.push('--concurrency must be between 1 and 5');
                                break;
                            case '--year-start':
                            case '--year-end':
                                if (numValue < 2008) errors.push(`${arg} cannot be earlier than 2008`);
                                if (numValue > new Date().getFullYear()) errors.push(`${arg} cannot be in the future`);
                                break;
                        }
                    }
                    i++; // Skip the value in next iteration
                }
            }
        }

        if (errors.length > 0) {
            throw new ValidationError(errors);
        }

        this.logger.debug('Arguments validation passed');
    }

    async validateEnvironment(): Promise<void> {
        const errors: string[] = [];

        try {
            // Check if git is available
            const gitVersion = Bun.spawnSync(["git", "--version"]);
            if (gitVersion.exitCode !== 0) {
                errors.push('Git is not installed or not available in PATH');
            }

            // Check if we're in a git repository
            const gitStatus = Bun.spawnSync(["git", "status"]);
            if (gitStatus.exitCode !== 0) {
                errors.push('Current directory is not a git repository');
            }

            // Check write permissions
            try {
                const testFile = '.write_test';
                await Bun.write(testFile, '');
                await Bun.file(testFile).remove();
            } catch {
                errors.push('No write permission in current directory');
            }

            // Check available disk space (if possible)
            try {
                const df = Bun.spawnSync(["df", "."]);
                if (df.exitCode === 0) {
                    const output = new TextDecoder().decode(df.stdout);
                    const available = parseInt(output.split('\n')[1].split(/\s+/)[3]);
                    if (available < 1024) { // Less than 1MB
                        errors.push('Insufficient disk space (less than 1MB available)');
                    }
                }
            } catch {
                this.logger.warn('Could not check available disk space');
            }

            // Check memory availability
            const totalMemory = process.memoryUsage().heapTotal / 1024 / 1024;
            if (totalMemory < 50) { // Less than 50MB
                errors.push('Insufficient memory available (less than 50MB)');
            }

            if (errors.length > 0) {
                throw new ValidationError(errors);
            }

            this.logger.debug('Environment validation passed');
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError([`Environment validation failed: ${error instanceof Error ? error.message : String(error)}`]);
        }
    }
}