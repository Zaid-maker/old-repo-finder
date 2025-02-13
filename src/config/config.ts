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

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const RESULT_FILE = "old-repos.md";
export const HISTORICAL_FILE = "historical-data.json";
export const CACHE_DURATION = 3600000; // 1 hour in milliseconds
export const REQUEST_TIMEOUT = 30000;  // 30 seconds timeout

export const GITHUB_HEADERS = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "OldReposFinder/1.0",
};