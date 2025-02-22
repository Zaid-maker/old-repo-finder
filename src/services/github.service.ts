import { Repository, GitHubSearchResponse } from '../types';
import { IGitHubService } from '../interfaces/github.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IConfigService } from '../interfaces/config.interface';
import { ServiceContainer } from './service-container';
import { GitHubApiError, RateLimitError, NetworkError } from '../utils/errors';

export class GitHubService implements IGitHubService {
    private readonly logger: ILogger;
    private readonly config: IConfigService;
    private rateLimitRemaining: number = -1;
    private rateLimitReset: number = 0;

    constructor() {
        const container = ServiceContainer.getInstance();
        this.logger = container.get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.config = container.get<IConfigService>(ServiceContainer.TOKENS.Config);
    }

    private get headers(): Record<string, string> {
        return {
            'Authorization': `token ${this.config.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'OldReposFinder/1.0'
        };
    }

    private async handleRateLimit(headers: Headers): Promise<void> {
        this.rateLimitRemaining = parseInt(headers.get('x-ratelimit-remaining') || '-1');
        this.rateLimitReset = parseInt(headers.get('x-ratelimit-reset') || '0') * 1000;
        const rateLimit = parseInt(headers.get('x-ratelimit-limit') || '0');

        this.logger.debug('Rate limit status:', {
            remaining: this.rateLimitRemaining,
            reset: new Date(this.rateLimitReset).toLocaleString(),
            limit: rateLimit
        });

        if (this.rateLimitRemaining < 10) {
            const waitTime = Math.max(0, this.rateLimitReset - Date.now());
            if (waitTime > 0) {
                this.logger.warn(`Rate limit low (${this.rateLimitRemaining}), waiting ${Math.ceil(waitTime / 1000)}s for reset`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

                const response = await fetch(url, {
                    ...options,
                    headers: this.headers,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                await this.handleRateLimit(response.headers);

                if (response.ok) {
                    return response;
                }

                const errorData = await response.json();

                if (response.status === 429) {
                    throw new RateLimitError(
                        this.rateLimitReset / 1000,
                        this.rateLimitRemaining,
                        parseInt(response.headers.get('x-ratelimit-limit') || '0')
                    );
                }

                throw new GitHubApiError(
                    response.status,
                    errorData.message,
                    errorData.documentation_url
                );
            } catch (error) {
                lastError = error as Error;

                if (error instanceof RateLimitError) {
                    const waitTime = Math.max(0, error.resetTime * 1000 - Date.now());
                    this.logger.warn(`Rate limit exceeded, waiting ${Math.ceil(waitTime / 1000)}s`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    attempt--; // Don't count rate limit retries
                    continue;
                }

                if (error.name === 'AbortError') {
                    this.logger.warn(`Request timeout on attempt ${attempt}/${maxRetries}`);
                } else {
                    this.logger.warn(`Request failed on attempt ${attempt}/${maxRetries}:`, error);
                }

                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    this.logger.debug(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        if (lastError instanceof GitHubApiError || lastError instanceof RateLimitError) {
            throw lastError;
        }

        throw new NetworkError(
            lastError || new Error('Unknown error'),
            url
        );
    }

    async checkAccess(): Promise<void> {
        try {
            const response = await this.fetchWithRetry('https://api.github.com/rate_limit');
            const data = await response.json();
            
            this.logger.info('GitHub API access verified:', {
                remaining: data.resources.search.remaining,
                reset: new Date(data.resources.search.reset * 1000).toLocaleString(),
                limit: data.resources.search.limit
            });
        } catch (error) {
            if (error instanceof GitHubApiError) {
                throw new Error(`GitHub API access failed: ${error.message}`);
            }
            throw error;
        }
    }

    async searchRepositories(query: string, page: number): Promise<Repository[]> {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=updated&order=asc&per_page=100&page=${page}`;

        try {
            const response = await this.fetchWithRetry(url);
            const data: GitHubSearchResponse = await response.json();

            this.logger.debug(`Retrieved ${data.items.length} repositories from page ${page}`);
            return data.items;
        } catch (error) {
            this.logger.error(`Failed to search repositories (page ${page}):`, error);
            throw error;
        }
    }

    async getRateLimit(): Promise<{ remaining: number; reset: Date }> {
        return {
            remaining: this.rateLimitRemaining,
            reset: new Date(this.rateLimitReset)
        };
    }
}