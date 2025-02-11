import { Repository, GitHubSearchResponse } from '../types';
import { GitHubAPIError, RateLimitError } from '../utils/errors';
import { debug, logError } from '../utils/helpers';
import { GITHUB_HEADERS, REQUEST_TIMEOUT } from '../config/config';

export class GitHubService {
    private static async fetchWithRetry(url: string, options: { headers: any, retries?: number, timeout?: number } = { headers: {}, retries: 3 }): Promise<Response> {
        const { retries = 3, timeout = REQUEST_TIMEOUT, ...fetchOptions } = options;
        let lastError: Error | null = null;

        debug('Fetching URL:', url);
        debug('Request options:', { ...fetchOptions, timeout });

        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                debug(`Attempt ${i + 1}/${retries}`);
                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                debug('Response status:', response.status);
                
                if (response.ok) return response;
                
                const errorData = await response.json();
                debug('Error response:', errorData);

                if (response.status === 429) {
                    const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000;
                    throw new RateLimitError(resetTime);
                }
                
                throw new GitHubAPIError(response.status, JSON.stringify(errorData));
            } catch (error) {
                lastError = error as Error;
                logError(error, `Fetch attempt ${i + 1}`);

                if (error instanceof RateLimitError) {
                    const waitTime = Math.ceil((error.resetTime - Date.now()) / 1000);
                    debug('Rate limit details:', { resetTime: error.resetTime, waitTime });
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