export class GitHubAPIError extends Error {
    constructor(public status: number, public message: string) {
        super(message);
        this.name = 'GitHubAPIError';
    }
}

export class RateLimitError extends GitHubAPIError {
    constructor(public resetTime: number) {
        super(429, 'Rate limit exceeded');
        this.name = 'RateLimitError';
    }
}