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

        try {
            // Initialize logger first as it's required by other services
            const logger = new LoggerService();
            this.container.register(ServiceContainer.TOKENS.Logger, logger);

            // Initialize core services with explicit logger dependency
            const errorHandler = new ErrorHandlerService(logger);
            const processManager = new ProcessManagerService(logger);
            const monitoring = new MonitoringService(logger);
            const validation = new ValidationService(logger);

            this.container.register(ServiceContainer.TOKENS.ErrorHandler, errorHandler);
            this.container.register(ServiceContainer.TOKENS.ProcessManager, processManager);
            this.container.register(ServiceContainer.TOKENS.Monitoring, monitoring);
            this.container.register(ServiceContainer.TOKENS.Validation, validation);

            monitoring.startOperation('service_initialization');

            try {
                // Initialize parameter management
                const parameterManager = new ParameterManagerService(logger, validation);
                await parameterManager.initialize(args);
                this.container.register(ServiceContainer.TOKENS.ParameterManager, parameterManager);

                // Initialize configuration service
                const config = new ConfigService(logger);
                this.container.register(ServiceContainer.TOKENS.Config, config);

                // Initialize supporting services
                const rateLimiter = new RateLimiterService(logger);
                const retryPolicy = new RetryPolicyService(logger);
                const cache = new CacheService(logger, config);

                this.container.register(ServiceContainer.TOKENS.RateLimiter, rateLimiter);
                this.container.register(ServiceContainer.TOKENS.RetryPolicy, retryPolicy);
                this.container.register(ServiceContainer.TOKENS.Cache, cache);

                // Initialize main services
                const github = new GitHubService(logger, config, rateLimiter, retryPolicy);
                const git = new GitService(logger);
                const historical = new HistoricalService(logger, config);
                const markdown = new MarkdownService(logger);

                this.container.register(ServiceContainer.TOKENS.GitHub, github);
                this.container.register(ServiceContainer.TOKENS.Git, git);
                this.container.register(ServiceContainer.TOKENS.Historical, historical);
                this.container.register(ServiceContainer.TOKENS.Markdown, markdown);

                // Validate all services are properly registered
                this.validateServiceRegistration();

                // Initialize process manager handlers
                processManager.initialize();

                // Mark container as initialized
                this.container.markAsInitialized();

                monitoring.endOperation('service_initialization');
            } catch (error) {
                monitoring.endOperation('service_initialization');
                errorHandler.handleFatalError(error, 'Service initialization');
            }
        } catch (error) {
            console.error('Fatal error during core service initialization:', error);
            process.exit(1);
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
        const errorHandler = this.container.get<ErrorHandlerService>(ServiceContainer.TOKENS.ErrorHandler);
        const processManager = this.container.get<ProcessManagerService>(ServiceContainer.TOKENS.ProcessManager);
        const logger = this.container.get<LoggerService>(ServiceContainer.TOKENS.Logger);

        monitoring.startOperation('service_shutdown');

        try {
            await processManager.handleShutdown();
            this.container.clear();
            monitoring.endOperation('service_shutdown');
            monitoring.logResourceUsage();
        } catch (error) {
            errorHandler.handleError(error, 'Service shutdown');
        } finally {
            logger.info('Service shutdown complete');
        }
    }
}