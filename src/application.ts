import { Repository } from './types';
import { ServiceContainer } from './services/service-container';
import { ILogger } from './interfaces/logger.interface';
import { IConfigService } from './interfaces/config.interface';
import { IGitHubService } from './interfaces/github.interface';
import { ICacheService } from './interfaces/cache.interface';
import { IGitService } from './interfaces/git.interface';
import { IHistoricalService } from './interfaces/historical.interface';
import { IMarkdownService } from './interfaces/markdown.interface';
import { LoggerService } from './services/logger.service';
import { ConfigService } from './services/config.service';

export class Application {
    private static container = ServiceContainer.getInstance();
    private static logger: ILogger;
    private static config: IConfigService;
    private static github: IGitHubService;
    private static cache: ICacheService;
    private static git: IGitService;
    private static historical: IHistoricalService;
    private static markdown: IMarkdownService;

    private static initializeServices(): void {
        // Initialize base services
        this.container.register(ServiceContainer.TOKENS.Logger, new LoggerService());
        this.container.register(ServiceContainer.TOKENS.Config, new ConfigService());

        // Get service instances
        this.logger = this.container.get(ServiceContainer.TOKENS.Logger);
        this.config = this.container.get(ServiceContainer.TOKENS.Config);
        this.github = this.container.get(ServiceContainer.TOKENS.GitHub);
        this.cache = this.container.get(ServiceContainer.TOKENS.Cache);
        this.git = this.container.get(ServiceContainer.TOKENS.Git);
        this.historical = this.container.get(ServiceContainer.TOKENS.Historical);
        this.markdown = this.container.get(ServiceContainer.TOKENS.Markdown);
    }

    private static async validateSetup(): Promise<void> {
        this.logger.info('Validating setup...');
        
        if (!this.config.validate()) {
            this.logger.fatal('Configuration validation failed');
        }
    }

    private static async fetchRepositories(): Promise<Repository[]> {
        const repos: Repository[] = [];
        const options = this.config.options;

        try {
            await this.github.checkAccess();

            for (let year = options.yearStart; year <= options.yearEnd; year++) {
                if (repos.length >= options.maxRepos) break;

                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                
                this.logger.info(`Searching repositories from ${startDate} to ${endDate}...`);
                
                try {
                    let page = 1;
                    let hasMore = true;
                    let yearRepos = 0;
                    
                    while (hasMore && repos.length < options.maxRepos) {
                        const pagePromises: Promise<Repository[]>[] = [];
                        
                        for (let i = 0; i < options.concurrency && (page + i) <= 10; i++) {
                            const cacheKey = this.cache.getCacheKey(year, page + i, options.minStars);
                            const cachedData = this.cache.get(cacheKey);
                            
                            if (cachedData) {
                                pagePromises.push(Promise.resolve(cachedData));
                            } else {
                                const query = `pushed:${startDate}..${endDate} archived:false stars:>=${options.minStars}`;
                                pagePromises.push(this.github.searchRepositories(query, page + i));
                            }
                        }
                        
                        if (pagePromises.length === 0) break;
                        
                        const results = await Promise.all(pagePromises);
                        const newRepos = results.flat();
                        
                        if (newRepos.length === 0) {
                            hasMore = false;
                            break;
                        }
                        
                        repos.push(...newRepos);
                        yearRepos += newRepos.length;
                        
                        this.logger.info(`Found ${yearRepos} repos in ${year} (Total: ${repos.length})`);
                        
                        if (repos.length >= options.maxRepos) {
                            repos.splice(options.maxRepos);
                            break;
                        }
                        
                        if (page + options.concurrency > 10) {
                            this.logger.warn(`Reached GitHub's search result limit for ${year}`);
                            hasMore = false;
                            break;
                        }
                        
                        page += options.concurrency;
                    }
                } catch (error) {
                    this.logger.error(`Error fetching repositories for ${year}:`, error);
                    if (repos.length === 0) throw error;
                    break;
                }
            }
        } catch (error) {
            this.logger.error('Repository fetching failed:', error);
            throw error;
        }

        return repos;
    }

    private static async generateAndSaveReport(repos: Repository[]): Promise<void> {
        try {
            const comparison = await this.historical.compareWithPrevious(repos);
            const markdown = this.markdown.generateMarkdown(repos, comparison);
            
            await Bun.write(this.config.resultFile, markdown);
            await this.historical.saveData(repos);
            
            if (this.config.options.autoPush) {
                const date = new Date().toISOString().split('T')[0];
                const success = await this.git.commitAndPush(
                    this.config.resultFile,
                    `Update old repositories list (${date})`
                );
                
                if (success) {
                    this.logger.info('Successfully pushed changes to repository');
                } else {
                    this.logger.warn('Failed to push changes');
                }
            }
        } catch (error) {
            this.logger.error('Report generation failed:', error);
            throw error;
        }
    }

    static async run(): Promise<void> {
        this.logger.info('Starting Old Repository Finder...');
        
        try {
            // Initialize services
            this.initializeServices();
            
            // Parse command line arguments and validate setup
            await this.validateSetup();
            
            // Show configuration
            const options = this.config.options;
            this.logger.info('Configuration:', {
                searchPeriod: `${options.yearStart}-${options.yearEnd}`,
                minStars: options.minStars,
                maxRepos: options.maxRepos,
                concurrency: options.concurrency,
                autoPush: options.autoPush
            });
            
            // Start processing
            const startTime = Date.now();
            const repos = await this.fetchRepositories();

            if (repos.length === 0) {
                this.logger.warn('No repositories found matching the criteria');
                return;
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.info(`Found ${repos.length} repositories in ${duration}s`);

            // Generate and save report
            await this.generateAndSaveReport(repos);
            
            // Clean up
            this.cache.clearExpired();
            
            this.logger.info('Operation completed successfully');
        } catch (error) {
            this.logger.fatal('Application error:', error);
        }
    }
}