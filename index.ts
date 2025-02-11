#!/usr/bin/env bun

interface Repository {
    name: string;
    full_name: string;
    html_url: string;
    pushed_at: string;
    owner: {
        login: string;
    };
    stargazers_count: number;
    language: string | null;
}

interface GitHubSearchResponse {
    total_count: number;
    items: Repository[];
    incomplete_results: boolean;
}

interface Options {
    minStars: number;
    maxRepos: number;
    concurrency: number;
    yearStart: number;  // Start year for the search range
    yearEnd: number;    // End year for the search range
}

const DEFAULT_OPTIONS: Options = {
    minStars: 0,
    maxRepos: 1000,
    concurrency: 3,
    yearStart: 2008,   // Default to searching from 2008
    yearEnd: 2013      // Up to 2013 (10 years ago from 2023)
};

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const RESULT_FILE = "old-repos.md";

if (!GITHUB_TOKEN) {
    console.error("Missing GITHUB_TOKEN environment variable");
    process.exit(1);
}

const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "OldReposFinder/1.0",
};

async function fetchWithRetry(url: string, options: { headers: any, retries?: number } = { headers: {}, retries: 3 }): Promise<Response> {
    const { retries = 3, ...fetchOptions } = options;
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, fetchOptions);
            if (response.ok) return response;
            
            const errorData = await response.json();
            throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorData)}`);
        } catch (error) {
            lastError = error as Error;
            if (i < retries - 1) {
                const waitTime = Math.pow(2, i) * 1000;
                console.log(`Retry ${i + 1}/${retries} after ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    throw lastError;
}

async function fetchPage(page: number, startDate: string, endDate: string, signal?: AbortSignal): Promise<Repository[]> {
    const query = `pushed:${startDate}..${endDate} archived:false stars:>=${DEFAULT_OPTIONS.minStars}`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=updated&order=asc&per_page=100&page=${page}`;
    
    const response = await fetchWithRetry(url, { headers, retries: 3 });
    const data: GitHubSearchResponse = await response.json();
    
    // Handle rate limiting
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining && parseInt(remaining) < 10) {
        const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000;
        const waitTime = Math.ceil((resetTime - Date.now()) / 1000);
        console.log(`Waiting ${waitTime} seconds for rate limit reset`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
    
    return data.items;
}

async function fetchOldRepositories(): Promise<Repository[]> {
    const repos: Repository[] = [];
    const controller = new AbortController();

    // Search year by year to get better distribution
    for (let year = DEFAULT_OPTIONS.yearStart; year <= DEFAULT_OPTIONS.yearEnd; year++) {
        if (repos.length >= DEFAULT_OPTIONS.maxRepos) break;

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        console.log(`\n📅 Searching repositories from ${startDate} to ${endDate}...`);
        
        try {
            let page = 1;
            let hasMore = true;
            
            while (hasMore && repos.length < DEFAULT_OPTIONS.maxRepos) {
                const pagePromises: Promise<Repository[]>[] = [];
                
                // Create concurrent requests within GitHub's limits
                for (let i = 0; i < DEFAULT_OPTIONS.concurrency && (page + i) <= 10; i++) {
                    pagePromises.push(fetchPage(page + i, startDate, endDate, controller.signal));
                }
                
                if (pagePromises.length === 0) break;
                
                const results = await Promise.all(pagePromises);
                const newRepos = results.flat();
                
                if (newRepos.length === 0) {
                    hasMore = false;
                    break;
                }
                
                repos.push(...newRepos);
                console.log(`📊 Year ${year}: ${repos.length} total repositories found (page ${page})`);
                
                if (repos.length >= DEFAULT_OPTIONS.maxRepos) {
                    repos.splice(DEFAULT_OPTIONS.maxRepos);
                    break;
                }
                
                if (page + DEFAULT_OPTIONS.concurrency > 10) {
                    console.log(`⚠️ Reached GitHub's search result limit for ${year}`);
                    hasMore = false;
                    break;
                }
                
                page += DEFAULT_OPTIONS.concurrency;
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes("Only the first 1000 search results are available")) {
                console.log(`⚠️ Reached GitHub's search result limit for ${year}`);
                continue; // Move to next year
            } else {
                console.error("Failed to fetch repositories:", error instanceof Error ? error.message : error);
                if (repos.length > 0) {
                    console.log("Continuing with partial results...");
                    break;
                }
                process.exit(1);
            }
        }
    }

    return repos;
}

function generateMarkdown(repos: Repository[]): string {
    let content = "# 🕰️ GitHub Repositories Not Updated in Over 10 Years\n\n";
    content += "| Name | Owner | Language | Stars | Last Updated | URL |\n";
    content += "|------|-------|----------|-------|--------------|-----|\n";

    for (const repo of repos.sort((a, b) => b.stargazers_count - a.stargazers_count)) {
        const lastUpdated = new Date(repo.pushed_at).toLocaleDateString();
        const language = repo.language || 'N/A';
        content += `| ${repo.name} | ${repo.owner.login} | ${language} | ⭐ ${repo.stargazers_count} | ${lastUpdated} | [Link](${repo.html_url}) |\n`;
    }

    const summary = `\n## Summary\n- Total repositories: ${repos.length}\n- Languages: ${[...new Set(repos.map(r => r.language || 'Unknown'))].join(', ')}\n- Date generated: ${new Date().toLocaleString()}\n`;
    return content + summary;
}

async function parseArgs() {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        
        switch (key) {
            case '--min-stars':
                DEFAULT_OPTIONS.minStars = parseInt(value);
                break;
            case '--max-repos':
                DEFAULT_OPTIONS.maxRepos = parseInt(value);
                break;
            case '--concurrency':
                DEFAULT_OPTIONS.concurrency = parseInt(value);
                break;
            case '--year-start':
                DEFAULT_OPTIONS.yearStart = parseInt(value);
                break;
            case '--year-end':
                DEFAULT_OPTIONS.yearEnd = parseInt(value);
                break;
        }
    }
}

async function main() {
    try {
        await parseArgs();
        
        console.log("🔍 Searching for old repositories...");
        console.log(`📋 Options: min stars=${DEFAULT_OPTIONS.minStars}, max repos=${DEFAULT_OPTIONS.maxRepos}, concurrency=${DEFAULT_OPTIONS.concurrency}`);
        
        const startTime = Date.now();
        const repos = await fetchOldRepositories();

        if (repos.length === 0) {
            console.log("No old repositories found");
            return;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 Found ${repos.length} repositories in ${duration}s`);

        const markdown = generateMarkdown(repos);
        await Bun.write(RESULT_FILE, markdown);
        console.log(`📄 Results saved to ${RESULT_FILE}`);

    } catch (error) {
        console.error("🔴 Error:", error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();