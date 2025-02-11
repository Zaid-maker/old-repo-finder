// Types for GitHub API responses
export interface Repository {
    name: string;
    full_name: string;
    html_url: string;
    pushed_at: string;
    owner: {
        login: string;
    };
    stargazers_count: number;
    language: string | null;
    description: string | null;
}

export interface GitHubSearchResponse {
    total_count: number;
    items: Repository[];
    incomplete_results: boolean;
}

// Configuration types
export interface Options {
    minStars: number;
    maxRepos: number;
    concurrency: number;
    yearStart: number;
    yearEnd: number;
    autoPush: boolean;
    debug: boolean;
}

// Cache types
export interface Cache {
    [key: string]: {
        data: Repository[];
        timestamp: number;
    };
}

// Validation types
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

// Historical data types
export interface HistoricalData {
    timestamp: string;
    stats: {
        totalRepos: number;
        totalStars: number;
        languageDistribution: Record<string, number>;
    };
    repositories: Repository[];
}

export interface ComparisonResult {
    newRepos: Repository[];
    removedRepos: Repository[];
    starChanges: Array<{
        name: string;
        before: number;
        after: number;
    }>;
}