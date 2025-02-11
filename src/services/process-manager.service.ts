import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';

export interface IProcessManager {
    handleShutdown(): Promise<void>;
    registerShutdownHandler(handler: () => Promise<void>): void;
    initialize(): void;
}

export class ProcessManagerService implements IProcessManager {
    private readonly logger: ILogger;
    private shutdownHandlers: Array<() => Promise<void>> = [];
    private isShuttingDown = false;

    constructor() {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
    }

    async handleShutdown(): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        this.logger.info('Graceful shutdown initiated...');

        try {
            for (const handler of this.shutdownHandlers) {
                await handler();
            }
            this.logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }

    registerShutdownHandler(handler: () => Promise<void>): void {
        this.shutdownHandlers.push(handler);
    }

    initialize(): void {
        // Handle process signals
        process.on('SIGTERM', () => {
            this.logger.info('Received SIGTERM signal');
            this.handleShutdown();
        });

        process.on('SIGINT', () => {
            this.logger.info('Received SIGINT signal');
            this.handleShutdown();
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught Exception:', error);
            this.handleShutdown();
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason) => {
            this.logger.error('Unhandled Promise Rejection:', reason);
            this.handleShutdown();
        });

        this.logger.debug('Process manager initialized');
    }
}

// Register the process manager service
ServiceContainer.getInstance().register(
    'ProcessManager',
    new ProcessManagerService()
);