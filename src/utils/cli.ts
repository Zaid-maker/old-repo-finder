import { Options } from '../types';
import { DEFAULT_OPTIONS } from '../config';
import { validateOptions } from './index';
import { debug } from './index';

export async function parseArgs(): Promise<void> {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const key = args[i];
        const value = args[i + 1];
        
        switch (key) {
            case '--min-stars':
                DEFAULT_OPTIONS.minStars = parseInt(value);
                i++;
                break;
            case '--max-repos':
                DEFAULT_OPTIONS.maxRepos = parseInt(value);
                i++;
                break;
            case '--concurrency':
                DEFAULT_OPTIONS.concurrency = parseInt(value);
                i++;
                break;
            case '--year-start':
                DEFAULT_OPTIONS.yearStart = parseInt(value);
                i++;
                break;
            case '--year-end':
                DEFAULT_OPTIONS.yearEnd = parseInt(value);
                i++;
                break;
            case '--auto-push':
                DEFAULT_OPTIONS.autoPush = true;
                break;
            case '--debug':
                DEFAULT_OPTIONS.debug = true;
                break;
            default:
                console.warn(`⚠️ Unknown option: ${key}`);
        }
    }

    if (DEFAULT_OPTIONS.debug) {
        debug('Command line arguments:', args);
        debug('Parsed options:', DEFAULT_OPTIONS);
    }

    const validation = validateOptions(DEFAULT_OPTIONS);
    if (!validation.isValid) {
        console.error('❌ Invalid options:');
        validation.errors.forEach(error => console.error(`  • ${error}`));
        process.exit(1);
    }
}