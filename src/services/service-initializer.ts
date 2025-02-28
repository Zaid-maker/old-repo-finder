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
    private static logger: LoggerService;

    static async initialize(args: string[]): Promise<void> {
        if (this.container.isInitialized()) {
            return;
        }

        try {
            // Initialize core services
            this.logger = LoggerService.getInstance();
            
            // Enable debug mode if --debug flag is present
            if (args.includes('--debug')) {
                this.logger.enableDebug();
            }

            // Register core services
            this.container.register(ServiceContainer.TOKENS.Logger, this.logger);

            // Create and register services with explicit dependencies
            const errorHandler = new ErrorHandlerService(this.logger);
            const processManager = new ProcessManagerService(this.logger);
            const monitoring = new MonitoringService(this.logger);
            const validation = new ValidationService(this.logger);

            this.container.register(ServiceContainer.TOKENS.ErrorHandler, errorHandler);
            this.container.register(ServiceContainer.TOKENS.ProcessManager, processManager);
            this.container.register(ServiceContainer.TOKENS.Monitoring, monitoring);
            this.container.register(ServiceContainer.TOKENS.Validation, validation);

            monitoring.startOperation('service_initialization');

            try {
                // Create and configure parameter manager
                const parameterManager = new ParameterManagerService(this.logger, validation);
                await parameterManager.initialize(args);
                this.container.register(ServiceContainer.TOKENS.ParameterManager, parameterManager);

                // Create configuration service
                const config = new ConfigService(this.logger, parameterManager);
                this.container.register(ServiceContainer.TOKENS.Config, config);

                // Create support services
                const rateLimiter = new RateLimiterService(this.logger);
                const retryPolicy = new RetryPolicyService(this.logger);
                const cache = new CacheService(this.logger, config);

                this.container.register(ServiceContainer.TOKENS.RateLimiter, rateLimiter);
                this.container.register(ServiceContainer.TOKENS.RetryPolicy, retryPolicy);
                this.container.register(ServiceContainer.TOKENS.Cache, cache);

                // Create main services
                const github = new GitHubService(this.logger, config, rateLimiter, retryPolicy);
                const git = new GitService(this.logger);
                const historical = new HistoricalService(this.logger, config);
                const markdown = new MarkdownService(this.logger);

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
                this.logger.info('Services initialized successfully');
            } catch (error) {
                monitoring.endOperation('service_initialization');
                errorHandler.handleFatalError(error, 'Service initialization');
            }
        } catch (error) {
            if (this.logger) {
                this.logger.fatal('Fatal error during core service initialization:', error);
            } else {
                console.error('Fatal error during logger initialization:', error);
            }
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
        try {
            const monitoring = this.container.get<MonitoringService>(ServiceContainer.TOKENS.Monitoring);
            const processManager = this.container.get<ProcessManagerService>(ServiceContainer.TOKENS.ProcessManager);

            monitoring.startOperation('service_shutdown');

            await processManager.handleShutdown();
            this.container.clear();
            
            monitoring.endOperation('service_shutdown');
            monitoring.logResourceUsage();
            
            this.logger.info('Service shutdown complete');
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
        }
    }
}