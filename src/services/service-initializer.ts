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

        // Create and register the logger first as it's required by other services
        const logger = LoggerService.getInstance();
        
        // Enable debug mode if --debug flag is present
        if (args.includes('--debug')) {
            logger.enableDebug();
        }

        this.container.register(ServiceContainer.TOKENS.Logger, logger);

        try {
            // Create core services with explicit logger dependency
            const errorHandler = new ErrorHandlerService(logger);
            this.container.register(ServiceContainer.TOKENS.ErrorHandler, errorHandler);

            const processManager = new ProcessManagerService(logger);
            this.container.register(ServiceContainer.TOKENS.ProcessManager, processManager);

            const monitoring = new MonitoringService(logger);
            this.container.register(ServiceContainer.TOKENS.Monitoring, monitoring);

            const validation = new ValidationService(logger);
            this.container.register(ServiceContainer.TOKENS.Validation, validation);

            monitoring.startOperation('service_initialization');

            try {
                // Initialize parameter management
                const parameterManager = new ParameterManagerService();
                await parameterManager.initialize(args);
                this.container.register(ServiceContainer.TOKENS.ParameterManager, parameterManager);

                // Initialize configuration service
                const config = new ConfigService();
                this.container.register(ServiceContainer.TOKENS.Config, config);

                // Initialize supporting services
                const rateLimiter = new RateLimiterService();
                const retryPolicy = new RetryPolicyService();
                const cache = new CacheService();

                this.container.register(ServiceContainer.TOKENS.RateLimiter, rateLimiter);
                this.container.register(ServiceContainer.TOKENS.RetryPolicy, retryPolicy);
                this.container.register(ServiceContainer.TOKENS.Cache, cache);

                // Initialize main services
                const github = new GitHubService();
                const git = new GitService();
                const historical = new HistoricalService();
                const markdown = new MarkdownService();

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
                logger.info('Services initialized successfully');
            } catch (error) {
                monitoring.endOperation('service_initialization');
                errorHandler.handleFatalError(error, 'Service initialization');
            }
        } catch (error) {
            logger.fatal('Fatal error during core service initialization:', error);
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
        const logger = LoggerService.getInstance();
        
        try {
            const monitoring = this.container.get<MonitoringService>(ServiceContainer.TOKENS.Monitoring);
            const processManager = this.container.get<ProcessManagerService>(ServiceContainer.TOKENS.ProcessManager);

            monitoring.startOperation('service_shutdown');

            await processManager.handleShutdown();
            this.container.clear();
            
            monitoring.endOperation('service_shutdown');
            monitoring.logResourceUsage();
            
            logger.info('Service shutdown complete');
        } catch (error) {
            logger.error('Error during shutdown:', error);
        }
    }
}