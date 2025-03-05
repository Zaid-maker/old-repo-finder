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

export interface Options {
    minStars: number;
    maxRepos: number;
    concurrency: number;
    yearStart: number;
    yearEnd: number;
    autoPush: boolean;
    debug: boolean;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

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

export interface Cache {
    [key: string]: {
        data: Repository[];
        timestamp: number;
    };
}