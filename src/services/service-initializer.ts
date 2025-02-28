import { ServiceContainer } from './service-container';
import { LoggerService } from './logger.service';
import { ParameterManagerService } from './parameter-manager.service';
import { ConfigService } from './config.service';
import { GitHubService } from './github.service';
import { CacheService } from './cache.service';
import { GitService } from './git.service';
import { HistoricalService } from './historical.service';
import { MarkdownService } from './markdown.service';
import { MonitoringService } from './monitoring.service';
import { ErrorHandlerService } from './error-handler.service';
import { ProcessManagerService } from './process-manager.service';
import { RateLimiterService } from './rate-limiter.service';
import { RetryPolicyService } from './retry-policy.service';
import { ValidationService } from './validation.service';

export class ServiceInitializer {
    private static container = ServiceContainer.getInstance();

    static async initialize(args: string[]): Promise<void> {
        if (this.container.isInitialized()) {
            return;
        }

        // Initialize core services first (no dependencies)
        this.container.register(ServiceContainer.TOKENS.Logger, new LoggerService());
        this.container.register(ServiceContainer.TOKENS.ErrorHandler, new ErrorHandlerService());
        this.container.register(ServiceContainer.TOKENS.ProcessManager, new ProcessManagerService());
        this.container.register(ServiceContainer.TOKENS.Monitoring, new MonitoringService());
        this.container.register(ServiceContainer.TOKENS.Validation, new ValidationService());

        const monitoring = this.container.get<MonitoringService>(ServiceContainer.TOKENS.Monitoring);
        monitoring.startOperation('service_initialization');

        try {
            // Initialize parameter management (depends on Logger, Validation)
            const parameterManager = new ParameterManagerService();
            await parameterManager.initialize(args);
            this.container.register(ServiceContainer.TOKENS.ParameterManager, parameterManager);

            // Initialize configuration service (depends on ParameterManager)
            this.container.register(ServiceContainer.TOKENS.Config, new ConfigService());

            // Initialize supporting services
            this.container.register(ServiceContainer.TOKENS.RateLimiter, new RateLimiterService());
            this.container.register(ServiceContainer.TOKENS.RetryPolicy, new RetryPolicyService());
            this.container.register(ServiceContainer.TOKENS.Cache, new CacheService());

            // Initialize main services
            this.container.register(ServiceContainer.TOKENS.GitHub, new GitHubService());
            this.container.register(ServiceContainer.TOKENS.Git, new GitService());
            this.container.register(ServiceContainer.TOKENS.Historical, new HistoricalService());
            this.container.register(ServiceContainer.TOKENS.Markdown, new MarkdownService());

            // Validate all services are properly registered
            this.validateServiceRegistration();

            // Initialize process manager handlers
            const processManager = this.container.get<ProcessManagerService>(ServiceContainer.TOKENS.ProcessManager);
            processManager.initialize();

            // Mark container as initialized
            this.container.markAsInitialized();

            monitoring.endOperation('service_initialization');
        } catch (error) {
            monitoring.endOperation('service_initialization');
            const errorHandler = this.container.get<ErrorHandlerService>(ServiceContainer.TOKENS.ErrorHandler);
            errorHandler.handleFatalError(error, 'Service initialization');
        }
    }

    private static validateServiceRegistration(): void {
        const requiredServices = Object.values(ServiceContainer.TOKENS);
        const missingServices = requiredServices.filter(
            token => !this.container.hasService(token)
        );

        if (missingServices.length > 0) {
            throw new Error(`Missing required services: ${missingServices.join(', ')}`);
        }
    }

    static async shutdown(): Promise<void> {
        const monitoring = this.container.get<MonitoringService>(ServiceContainer.TOKENS.Monitoring);
        monitoring.startOperation('service_shutdown');

        try {
            const processManager = this.container.get<ProcessManagerService>(ServiceContainer.TOKENS.ProcessManager);
            await processManager.handleShutdown();

            // Clear the container
            this.container.clear();

            monitoring.endOperation('service_shutdown');
            monitoring.logResourceUsage();
        } catch (error) {
            const errorHandler = this.container.get<ErrorHandlerService>(ServiceContainer.TOKENS.ErrorHandler);
            errorHandler.handleError(error, 'Service shutdown');
        }
    }
}