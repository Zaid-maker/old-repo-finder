import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';

export interface IMonitoringService {
    startOperation(name: string): void;
    endOperation(name: string): void;
    getOperationStats(): Map<string, { count: number; totalTime: number; avgTime: number }>;
    getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; };
    logResourceUsage(): void;
    resetStats(): void;
}

export class MonitoringService implements IMonitoringService {
    private readonly logger: ILogger;
    private operations: Map<string, { startTime: number; count: number; totalTime: number }>;
    private readonly startTime: number;
    private lastResourceLog: number;

    constructor() {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.operations = new Map();
        this.startTime = Date.now();
        this.lastResourceLog = Date.now();
        this.setupPeriodicMonitoring();
    }

    private setupPeriodicMonitoring(): void {
        setInterval(() => {
            this.logResourceUsage();
        }, 60000); // Log every minute
    }

    startOperation(name: string): void {
        const operation = this.operations.get(name) || { startTime: 0, count: 0, totalTime: 0 };
        operation.startTime = Date.now();
        this.operations.set(name, operation);
    }

    endOperation(name: string): void {
        const operation = this.operations.get(name);
        if (operation) {
            const duration = Date.now() - operation.startTime;
            operation.count++;
            operation.totalTime += duration;
            this.logger.debug(`Operation "${name}" completed in ${duration}ms`);
        }
    }

    getOperationStats(): Map<string, { count: number; totalTime: number; avgTime: number }> {
        const stats = new Map();
        this.operations.forEach((op, name) => {
            stats.set(name, {
                count: op.count,
                totalTime: op.totalTime,
                avgTime: op.count > 0 ? op.totalTime / op.count : 0
            });
        });
        return stats;
    }

    getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
        const memUsage = process.memoryUsage();
        return {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        };
    }

    logResourceUsage(): void {
        const memUsage = this.getMemoryUsage();
        const uptime = Math.round((Date.now() - this.startTime) / 1000);
        const stats = this.getOperationStats();

        let operationSummary = '';
        stats.forEach((stat, name) => {
            operationSummary += `\n  - ${name}: ${stat.count} calls, avg ${Math.round(stat.avgTime)}ms`;
        });

        this.logger.debug('Resource Usage:', {
            uptime: `${uptime}s`,
            memory: {
                heapUsed: `${memUsage.heapUsed}MB`,
                heapTotal: `${memUsage.heapTotal}MB`,
                external: `${memUsage.external}MB`
            },
            operations: operationSummary
        });

        this.lastResourceLog = Date.now();
    }

    resetStats(): void {
        this.operations.clear();
        this.logger.debug('Monitoring stats reset');
    }
}