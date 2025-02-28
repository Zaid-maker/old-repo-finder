import { Repository, GitHubSearchResponse } from '../types';
import { IGitHubService } from '../interfaces/github.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IConfigService } from '../interfaces/config.interface';
import { ServiceContainer } from './service-container';
import { GitHubApiError, RateLimitError, NetworkError } from '../utils/errors';
import { withRetry, withTimeout, withRateLimit, withMonitoring } from '../utils/decorators';

export class GitHubService implements IGitHubService {
    private readonly logger: ILogger;
    private readonly config: IConfigService;

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

    @withMonitoring('github_access_check')
    @withRetry('check_access')
    @withTimeout()
    async checkAccess(): Promise<void> {
        try {
            const response = await fetch('https://api.github.com/rate_limit', {
                headers: this.headers
            });

            if (!response.ok) {
                const data = await response.json();
                throw new GitHubApiError(response.status, data.message, data.documentation_url);
            }

            const data = await response.json();
            const remaining = data.resources.search.remaining;
            const resetTime = new Date(data.resources.search.reset * 1000);

            this.logger.info('GitHub API access verified:', {
                remaining,
                resetTime: resetTime.toLocaleString()
            });
        } catch (error) {
            if (error instanceof GitHubApiError) {
                throw new Error(`GitHub API access failed: ${error.message}`);
            }
            throw error;
        }
    }

    @withMonitoring('github_search')
    @withRetry('search_repositories')
    @withRateLimit()
    @withTimeout()
    async searchRepositories(query: string, page: number): Promise<Repository[]> {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=updated&order=asc&per_page=100&page=${page}`;

        try {
            const response = await fetch(url, {
                headers: this.headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                
                if (response.status === 429) {
                    const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0');
                    const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
                    const limit = parseInt(response.headers.get('x-ratelimit-limit') || '0');
                    throw new RateLimitError(resetTime, remaining, limit);
                }

                throw new GitHubApiError(
                    response.status,
                    errorData.message,
                    errorData.documentation_url
                );
            }

            const data: GitHubSearchResponse = await response.json();
            this.logger.debug(`Retrieved ${data.items.length} repositories from page ${page}`);
            return data.items;
        } catch (error) {
            if (error instanceof GitHubApiError || error instanceof RateLimitError) {
                throw error;
            }
            throw new NetworkError(error as Error, url);
        }
    }

    @withMonitoring('github_rate_limit_check')
    @withRetry('get_rate_limit')
    @withTimeout()
    async getRateLimit(): Promise<{ remaining: number; reset: Date }> {
        const response = await fetch('https://api.github.com/rate_limit', {
            headers: this.headers
        });

        if (!response.ok) {
            const data = await response.json();
            throw new GitHubApiError(response.status, data.message, data.documentation_url);
        }

        const data = await response.json();
        return {
            remaining: data.resources.search.remaining,
            reset: new Date(data.resources.search.reset * 1000)
        };
    }
}