import { ILogger } from '../interfaces/logger.interface';

export class LoggerService implements ILogger {
    private timestamp(): string {
        return new Date().toISOString();
    }

    private formatMessage(level: string, message: string, args: any[]): string {
        const timestamp = this.timestamp();
        const formattedArgs = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
        ).join(' ');
        return `[${timestamp}] ${level}: ${message} ${formattedArgs}`.trim();
    }

    debug(message: string, ...args: any[]): void {
        if (process.env.DEBUG === 'true') {
            console.debug(this.formatMessage('DEBUG', message, args));
        }
    }

    info(message: string, ...args: any[]): void {
        console.log(this.formatMessage('INFO', message, args));
    }

    warn(message: string, ...args: any[]): void {
        console.warn(this.formatMessage('WARN', message, args));
    }

    error(message: string, ...args: any[]): void {
        console.error(this.formatMessage('ERROR', message, args));
    }

    fatal(message: string, ...args: any[]): void {
        console.error(this.formatMessage('FATAL', message, args));
        process.exit(1);
    }
}