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
container.register('ErrorHandler', new ErrorHandlerService());
container.register('ProcessManager', new ProcessManagerService());

// Initialize process manager
const processManager = container.get<ProcessManagerService>('ProcessManager');
processManager.initialize();

// Register cleanup handlers
processManager.registerShutdownHandler(async () => {
    const cache = container.get(ServiceContainer.TOKENS.Cache);
    cache.clearExpired();
});

// Start the application
Application.run().catch((error) => {
    const errorHandler = container.get<ErrorHandlerService>('ErrorHandler');
    errorHandler.handleFatalError(error, 'Application startup');
});