import { Options, ValidationResult } from '../types';
import { debug, logError } from '../utils/helpers';

export class ValidationService {
    static validateOptions(options: Options): ValidationResult {
        const errors: string[] = [];
        const currentYear = new Date().getFullYear();

        try {
            // Year range validation
            if (options.yearStart > options.yearEnd) {
                errors.push('Start year must be less than or equal to end year');
            }

            if (options.yearStart < 2008) {
                errors.push('Start year cannot be earlier than 2008 (GitHub\'s founding year)');
            }

            if (options.yearEnd > currentYear) {
                errors.push(`End year cannot be later than current year (${currentYear})`);
            }

            // Numeric constraints validation
            if (options.minStars < 0) {
                errors.push('Minimum stars cannot be negative');
            }

            if (options.maxRepos <= 0) {
                errors.push('Maximum repositories must be greater than 0');
            }

            if (options.maxRepos > 10000) {
                errors.push('Maximum repositories cannot exceed 10000 due to API limitations');
            }

            if (options.concurrency <= 0 || options.concurrency > 5) {
                errors.push('Concurrency must be between 1 and 5');
            }

            // Time range validation
            const yearRange = options.yearEnd - options.yearStart;
            if (yearRange > 20) {
                errors.push('Year range cannot exceed 20 years to prevent excessive API usage');
            }

            debug('Validation results:', { isValid: errors.length === 0, errors });
            
            return {
                isValid: errors.length === 0,
                errors
            };
        } catch (error) {
            logError(error, 'Options validation');
            errors.push('Internal validation error occurred');
            return { isValid: false, errors };
        }
    }

    static validateToken(token: string | undefined): ValidationResult {
        const errors: string[] = [];

        if (!token) {
            errors.push('Missing GITHUB_TOKEN environment variable');
        } else if (!/^gh[ps]_[a-zA-Z0-9]{36}$/.test(token)) {
            errors.push('Invalid GitHub token format. Expected format: gho_XXXXX or ghp_XXXXX');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    static validateArguments(args: string[]): ValidationResult {
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
                    } else if (isNaN(Number(value))) {
                        errors.push(`Invalid numeric value for option: ${arg}`);
                    }
                    i++; // Skip the value in next iteration
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    static validateEnvironment(): ValidationResult {
        const errors: string[] = [];

        try {
            // Check if git is available
            const gitVersion = Bun.spawnSync(["git", "--version"], {
                stdout: "pipe"
            });
            
            if (gitVersion.exitCode !== 0) {
                errors.push('Git is not installed or not available in PATH');
            }

            // Check if we're in a git repository
            const gitStatus = Bun.spawnSync(["git", "status"], {
                stdout: "pipe"
            });

            if (gitStatus.exitCode !== 0) {
                errors.push('Not in a git repository');
            }

            // Check write permissions in current directory
            try {
                const testFile = 'write_test';
                Bun.write(testFile, '');
                Bun.file(testFile).remove();
            } catch {
                errors.push('No write permission in current directory');
            }

        } catch (error) {
            logError(error, 'Environment validation');
            errors.push('Failed to validate environment');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}