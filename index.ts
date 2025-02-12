#!/usr/bin/env bun

import { Application } from './src/application';
import { ServiceContainer } from './src/services/service-container';
import { ProcessManagerService } from './src/services/process-manager.service';
import { LoggerService } from './src/services/logger.service';
import { ConfigService } from './src/services/config.service';
import { GitHubService } from './src/services/github.service';
import { CacheService } from './src/services/cache.service';
import { GitService } from './src/services/git.service';
import { HistoricalService } from './src/services/historical.service';
import { MarkdownService } from './src/services/markdown.service';
import { ErrorHandlerService } from './src/services/error-handler.service';
import { MonitoringService } from './src/services/monitoring.service';

// Initialize service container
const container = ServiceContainer.getInstance();

// Register core services
container.register(ServiceContainer.TOKENS.Logger, new LoggerService());
container.register(ServiceContainer.TOKENS.Config, new ConfigService());
container.register(ServiceContainer.TOKENS.GitHub, new GitHubService());
container.register(ServiceContainer.TOKENS.Cache, new CacheService());
container.register(ServiceContainer.TOKENS.Git, new GitService());
container.register(ServiceContainer.TOKENS.Historical, new HistoricalService());
container.register(ServiceContainer.TOKENS.Markdown, new MarkdownService());
container.register(ServiceContainer.TOKENS.Monitoring, new MonitoringService());
container.register(ServiceContainer.TOKENS.ErrorHandler, new ErrorHandlerService());
container.register(ServiceContainer.TOKENS.ProcessManager, new ProcessManagerService());

// Initialize process manager
const processManager = container.get<ProcessManagerService>(ServiceContainer.TOKENS.ProcessManager);
processManager.initialize();

// Get monitoring service
const monitoring = container.get<MonitoringService>(ServiceContainer.TOKENS.Monitoring);

// Register cleanup handlers
processManager.registerShutdownHandler(async () => {
    const cache = container.get<CacheService>(ServiceContainer.TOKENS.Cache);
    monitoring.startOperation('cleanup');
    cache.clearExpired();
    monitoring.endOperation('cleanup');
    monitoring.logResourceUsage();
});

// Start monitoring application startup
monitoring.startOperation('app_startup');

// Start the application
Application.run()
    .then(() => {
        monitoring.endOperation('app_startup');
        monitoring.logResourceUsage();
    })
    .catch((error) => {
        monitoring.endOperation('app_startup');
        const errorHandler = container.get<ErrorHandlerService>(ServiceContainer.TOKENS.ErrorHandler);
        errorHandler.handleFatalError(error, 'Application startup');
    });