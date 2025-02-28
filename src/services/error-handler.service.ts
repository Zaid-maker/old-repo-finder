import { ILogger } from '../interfaces/logger.interface';

export interface IErrorHandler {
    handleError(error: unknown, context: string): void;
    handleFatalError(error: unknown, context: string): never;
}

export class ErrorHandlerService implements IErrorHandler {
    constructor(private readonly logger: ILogger) {}

    private formatError(error: unknown): string {
        if (error instanceof Error) {
            return `${error.name}: ${error.message}\n${error.stack || ''}`;
        }
        return String(error);
    }

    handleError(error: unknown, context: string): void {
        const formattedError = this.formatError(error);
        this.logger.error(`Error in ${context}:`, formattedError);
    }

    handleFatalError(error: unknown, context: string): never {
        const formattedError = this.formatError(error);
        this.logger.fatal(`Fatal error in ${context}:`, formattedError);
        process.exit(1);
    }
}