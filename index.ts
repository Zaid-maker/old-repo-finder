#!/usr/bin/env bun

import { Application } from './src/application';
import { ServiceInitializer } from './src/services/service-initializer';
import { ServiceContainer } from './src/services/service-container';
import { IMonitoringService } from './src/interfaces/monitoring.interface';
import { IErrorHandler } from './src/services/error-handler.service';

async function main() {
    // Initialize all services
    await ServiceInitializer.initialize(process.argv.slice(2));

    const container = ServiceContainer.getInstance();
    const monitoring = container.get<IMonitoringService>(ServiceContainer.TOKENS.Monitoring);

    try {
        // Start monitoring application execution
        monitoring.startOperation('app_execution');

        // Run the application
        await Application.run();

        // Log final metrics
        monitoring.endOperation('app_execution');
        monitoring.logResourceUsage();

        // Perform graceful shutdown
        await ServiceInitializer.shutdown();
        process.exit(0);
    } catch (error) {
        monitoring.endOperation('app_execution');
        const errorHandler = container.get<IErrorHandler>(ServiceContainer.TOKENS.ErrorHandler);
        errorHandler.handleFatalError(error, 'Application execution');
    }
}

// Handle uncaught exceptions and unhandled rejections through our error handler
const container = ServiceContainer.getInstance();
process.on('uncaughtException', (error) => {
    const errorHandler = container.get<IErrorHandler>(ServiceContainer.TOKENS.ErrorHandler);
    errorHandler.handleFatalError(error, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason) => {
    const errorHandler = container.get<IErrorHandler>(ServiceContainer.TOKENS.ErrorHandler);
    errorHandler.handleFatalError(reason, 'Unhandled Promise Rejection');
});

// Start the application
main();