export class BaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class GitHubApiError extends BaseError {
    constructor(
        public status: number,
        public message: string,
        public documentation_url?: string
    ) {
        super(`GitHub API Error (${status}): ${message}`);
    }
}

export class RateLimitError extends GitHubApiError {
    constructor(
        public resetTime: number,
        public remaining: number,
        public limit: number
    ) {
        super(429, `Rate limit exceeded. Resets at ${new Date(resetTime * 1000).toLocaleString()}`);
    }
}

export class ValidationError extends BaseError {
    constructor(
        public errors: string[]
    ) {
        super(`Validation failed: ${errors.join(', ')}`);
    }
}

export class ConfigurationError extends BaseError {
    constructor(message: string) {
        super(`Configuration error: ${message}`);
    }
}

export class NetworkError extends BaseError {
    constructor(
        public originalError: Error,
        public endpoint: string
    ) {
        super(`Network error calling ${endpoint}: ${originalError.message}`);
    }
}

export class GitError extends BaseError {
    constructor(
        public command: string,
        public errorOutput: string
    ) {
        super(`Git command '${command}' failed: ${errorOutput}`);
    }
}

export class CacheError extends BaseError {
    constructor(
        public operation: 'read' | 'write' | 'delete',
        public key: string,
        public reason: string
    ) {
        super(`Cache ${operation} failed for key '${key}': ${reason}`);
    }
}

export class HistoricalDataError extends BaseError {
    constructor(
        public operation: 'read' | 'write' | 'compare',
        public reason: string
    ) {
        super(`Historical data ${operation} failed: ${reason}`);
    }
}