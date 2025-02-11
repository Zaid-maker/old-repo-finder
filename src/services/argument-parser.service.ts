import { Options } from '../types';
import { DEFAULT_OPTIONS } from '../config/config';
import { ValidationService } from './validation.service';
import { debug, printHelp } from '../utils/helpers';

export class ArgumentParserService {
    static async parse(args: string[]): Promise<Options> {
        debug('Parsing command line arguments:', args);
        
        // Clone default options
        const options: Options = { ...DEFAULT_OPTIONS };

        // Validate arguments format
        const argValidation = ValidationService.validateArguments(args);
        if (!argValidation.isValid) {
            console.error('❌ Invalid arguments:');
            argValidation.errors.forEach(error => console.error(`  • ${error}`));
            printHelp();
            process.exit(1);
        }

        // Parse arguments
        for (let i = 0; i < args.length; i++) {
            const key = args[i];
            const value = args[i + 1];
            
            switch (key) {
                case '--min-stars':
                    options.minStars = parseInt(value);
                    i++;
                    break;
                case '--max-repos':
                    options.maxRepos = parseInt(value);
                    i++;
                    break;
                case '--concurrency':
                    options.concurrency = parseInt(value);
                    i++;
                    break;
                case '--year-start':
                    options.yearStart = parseInt(value);
                    i++;
                    break;
                case '--year-end':
                    options.yearEnd = parseInt(value);
                    i++;
                    break;
                case '--auto-push':
                    options.autoPush = true;
                    break;
                case '--debug':
                    options.debug = true;
                    break;
                case '--help':
                    printHelp();
                    process.exit(0);
            }
        }

        // Validate parsed options
        const validation = ValidationService.validateOptions(options);
        if (!validation.isValid) {
            console.error('❌ Invalid options:');
            validation.errors.forEach(error => console.error(`  • ${error}`));
            process.exit(1);
        }

        // Validate environment if auto-push is enabled
        if (options.autoPush) {
            const envValidation = ValidationService.validateEnvironment();
            if (!envValidation.isValid) {
                console.error('❌ Environment validation failed:');
                envValidation.errors.forEach(error => console.error(`  • ${error}`));
                process.exit(1);
            }
        }

        debug('Parsed options:', options);
        return options;
    }
}