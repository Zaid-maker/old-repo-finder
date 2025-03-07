import { Options } from '../types';

export const DEFAULT_OPTIONS: Options = {
    minStars: 0,
    maxRepos: 1000,
    concurrency: 3,
    yearStart: 2008,
    yearEnd: 2013,
    autoPush: false,
    debug: false
};

export const CONSTANTS = {
    CACHE_DURATION: 3600000, // 1 hour in milliseconds
    REQUEST_TIMEOUT: 30000,  // 30 seconds timeout
    RESULT_FILE: 'old-repos.md',
    HISTORICAL_FILE: 'historical-data.json'
} as const;

export const GITHUB_API = {
    headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "OldReposFinder/1.0",
    }
} as const;