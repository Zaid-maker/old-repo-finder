export interface IMonitoringService {
    startOperation(name: string): void;
    endOperation(name: string): void;
    getOperationStats(): Map<string, { count: number; totalTime: number; avgTime: number }>;
    getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; };
    logResourceUsage(): void;
    resetStats(): void;
}