import type { Options, ValidationResult } from '../types';
import { DEFAULT_OPTIONS } from '../config';

export function debug(message: string, ...args: any[]): void {
    if (DEFAULT_OPTIONS.debug) {
        const timestamp = new Date().toISOString();
        console.debug(`[DEBUG ${timestamp}]`, message, ...args);
    }
}

export function logError(error: unknown, context: string): void {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
    } : error;

    const logMessage = {
        timestamp,
        context,
        error: errorDetails
    };

    console.error(`❌ Error in ${context}:`, error instanceof Error ? error.message : error);
    debug('Detailed error:', JSON.stringify(logMessage, null, 2));
}

export function createProgressBar(current: number, total: number, width: number = 40): string {
    const percentage = Math.min(100, (current / total) * 100);
    const filledWidth = Math.round((width * percentage) / 100);
    const emptyWidth = width - filledWidth;
    
    const filledBar = '█'.repeat(filledWidth);
    const emptyBar = '░'.repeat(emptyWidth);
    
    return `${filledBar}${emptyBar} ${percentage.toFixed(1)}%`;
}

export function validateOptions(options: Options): ValidationResult {
    const errors: string[] = [];
    const currentYear = new Date().getFullYear();

    if (options.yearStart > options.yearEnd) {
        errors.push('Start year must be less than or equal to end year');
    }

    if (options.yearStart < 2008) {
        errors.push('Start year cannot be earlier than 2008 (GitHub\'s founding year)');
    }

    if (options.yearEnd > currentYear) {
        errors.push(`End year cannot be later than current year (${currentYear})`);
    }

    if (options.minStars < 0) {
        errors.push('Minimum stars cannot be negative');
    }

    if (options.maxRepos <= 0) {
        errors.push('Maximum repositories must be greater than 0');
    }

    if (options.concurrency <= 0 || options.concurrency > 5) {
        errors.push('Concurrency must be between 1 and 5');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export function printHelp(): void {
    console.log(`
Old Repository Finder - Find historical GitHub repositories

Usage:
  bun run index.ts [options]

Options:
  --min-stars <number>     Minimum number of stars (default: ${DEFAULT_OPTIONS.minStars})
  --max-repos <number>     Maximum number of repositories to fetch (default: ${DEFAULT_OPTIONS.maxRepos})
  --concurrency <number>   Number of concurrent requests (1-5, default: ${DEFAULT_OPTIONS.concurrency})
  --year-start <number>    Start year for search (>= 2008, default: ${DEFAULT_OPTIONS.yearStart})
  --year-end <number>      End year for search (default: ${DEFAULT_OPTIONS.yearEnd})
  --auto-push             Automatically commit and push changes
  --debug                 Enable debug mode
  --help                  Show this help message

Examples:
  bun run index.ts --min-stars 100 --year-start 2010 --year-end 2012
  bun run index.ts --max-repos 500 --concurrency 3 --auto-push
`);
}