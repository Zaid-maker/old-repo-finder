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
                    console.log(`⏳ Rate limit reached. Waiting ${waitTime} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                    i--; // Retry this attempt
                    continue;
                }
                
                if (error instanceof Error && error.name === 'AbortError') {
                    debug('Request timed out after', timeout, 'ms');
                    console.log('⏱️ Request timed out, retrying...');
                }
                
                if (i < retries - 1) {
                    const waitTime = Math.pow(2, i) * 1000;
                    debug('Retry wait time:', waitTime);
                    console.log(`🔄 Retry ${i + 1}/${retries} after ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        throw lastError;
    }

    static async checkAccess(): Promise<void> {
        try {
            const response = await this.fetchWithRetry('https://api.github.com/rate_limit', { headers: GITHUB_HEADERS });
            if (!response.ok) {
                const data = await response.json();
                throw new GitHubAPIError(response.status, JSON.stringify(data));
            }
            const data = await response.json();
            const remaining = data.resources.search.remaining;
            const resetTime = new Date(data.resources.search.reset * 1000).toLocaleTimeString();
            console.log(`ℹ️ GitHub API: ${remaining} requests remaining, resets at ${resetTime}`);
        } catch (error) {
            if (error instanceof GitHubAPIError) {
                throw new Error(`GitHub API access failed: ${error.message}`);
            }
            throw new Error('Failed to check GitHub API access');
        }
    }

    static async searchRepositories(query: string, page: number): Promise<Repository[]> {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=updated&order=asc&per_page=100&page=${page}`;
        
        const response = await this.fetchWithRetry(url, { 
            headers: GITHUB_HEADERS, 
            retries: 3,
            timeout: REQUEST_TIMEOUT 
        });
        
        const data: GitHubSearchResponse = await response.json();
        return data.items;
    }
}