import { ILogger } from '../interfaces/logger.interface';

export class LoggerService implements ILogger {
    private static instance: LoggerService;
    private debugEnabled: boolean = false;

    constructor() {
        // If instance exists, return it (singleton pattern)
        if (LoggerService.instance) {
            return LoggerService.instance;
        }
        LoggerService.instance = this;
    }

    static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    enableDebug(): void {
        this.debugEnabled = true;
    }

    private formatMessage(message: string, args: any[]): string {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        }).join(' ');

        return `[${timestamp}] ${message} ${formattedArgs}`.trim();
    }

    debug(message: string, ...args: any[]): void {
        if (this.debugEnabled) {
            console.debug('\x1b[36m[DEBUG]\x1b[0m', this.formatMessage(message, args));
        }
    }

    info(message: string, ...args: any[]): void {
        console.info('\x1b[32m[INFO]\x1b[0m', this.formatMessage(message, args));
    }

    warn(message: string, ...args: any[]): void {
        console.warn('\x1b[33m[WARN]\x1b[0m', this.formatMessage(message, args));
    }

    error(message: string, ...args: any[]): void {
        console.error('\x1b[31m[ERROR]\x1b[0m', this.formatMessage(message, args));
    }

    fatal(message: string, ...args: any[]): void {
        console.error('\x1b[41m[FATAL]\x1b[0m', this.formatMessage(message, args));
    }
}