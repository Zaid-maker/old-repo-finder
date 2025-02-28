import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';

export interface IProcessManager {
    handleShutdown(): Promise<void>;
    registerShutdownHandler(handler: () => Promise<void>): void;
    initialize(): void;
}

type ShutdownHandler = () => Promise<void>;

export class ProcessManagerService implements IProcessManager {
    private shutdownHandlers: ShutdownHandler[] = [];
    private isShuttingDown = false;

    constructor(private readonly logger: ILogger) {}

    initialize(): void {
        process.on('SIGINT', () => this.handleShutdown('SIGINT'));
        process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
        process.on('beforeExit', () => this.handleShutdown('beforeExit'));

        this.logger.debug('Process manager initialized');
    }

    registerShutdownHandler(handler: ShutdownHandler): void {
        this.shutdownHandlers.push(handler);
        this.logger.debug('Shutdown handler registered');
    }

    async handleShutdown(signal?: string): Promise<void> {
        if (this.isShuttingDown) {
            return;
        }

        this.isShuttingDown = true;
        this.logger.info(`Initiating shutdown${signal ? ` (signal: ${signal})` : ''}...`);

        try {
            for (const handler of this.shutdownHandlers) {
                await handler();
            }
            this.logger.info('Shutdown handlers executed successfully');
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
        }
    }
}

// Register the process manager service
ServiceContainer.getInstance().register(
    'ProcessManager',
    new ProcessManagerService(ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger))
);