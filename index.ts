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
    description: string | null;
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
    autoPush: boolean;  // New option for auto-pushing changes
    debug: boolean;  // New debug option
}

const DEFAULT_OPTIONS: Options = {
    minStars: 0,
    maxRepos: 1000,
    concurrency: 3,
    yearStart: 2008,   // Default to searching from 2008
    yearEnd: 2013,     // Up to 2013 (10 years ago from 2023)
    autoPush: false,    // Disabled by default
    debug: false
};

// Add debug logging utility
function debug(message: string, ...args: any[]): void {
    if (DEFAULT_OPTIONS.debug) {
        const timestamp = new Date().toISOString();
        console.debug(`[DEBUG ${timestamp}]`, message, ...args);
    }
}

// Add error logging utility
function logError(error: unknown, context: string): void {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
    } : error;

    const logMessage = {
        timestamp,
        context,
        error: errorDetails
    };

    console.error(`❌ Error in ${context}:`, error instanceof Error ? error.message : error);
    debug('Detailed error:', JSON.stringify(logMessage, null, 2));
}

const GH_PAT = process.env.GH_PAT;
const RESULT_FILE = "old-repos.md";

if (!GH_PAT) {
    console.error("Missing GH_PAT environment variable");
    process.exit(1);
}

const headers = {
    Authorization: `token ${GH_PAT}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "OldReposFinder/1.0",
};

class GitHubAPIError extends Error {
    constructor(public status: number, public message: string) {
        super(message);
        this.name = 'GitHubAPIError';
    }
}

class RateLimitError extends GitHubAPIError {
    constructor(public resetTime: number) {
        super(429, 'Rate limit exceeded');
        this.name = 'RateLimitError';
    }
}

interface Cache {
    [key: string]: {
        data: Repository[];
        timestamp: number;
    };
}

const cache: Cache = {};
const CACHE_DURATION = 3600000; // 1 hour in milliseconds
const REQUEST_TIMEOUT = 30000;  // 30 seconds timeout

function getCacheKey(year: number, page: number): string {
    return `${year}-${page}-${DEFAULT_OPTIONS.minStars}`;
}

function getFromCache(key: string): Repository[] | null {
    const cached = cache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('📦 Using cached data');
        return cached.data;
    }
    return null;
}

function saveToCache(key: string, data: Repository[]): void {
    cache[key] = {
        data,
        timestamp: Date.now()
    };
}

async function fetchWithRetry(url: string, options: { headers: any, retries?: number, timeout?: number } = { headers: {}, retries: 3 }): Promise<Response> {
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
            
            // Fix Headers.entries() type error by converting to Record
            const headerObj: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                headerObj[key] = value;
            });
            debug('Response headers:', headerObj);
            
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
            
            // Fix error type checking
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

async function fetchPage(page: number, startDate: string, endDate: string, signal?: AbortSignal): Promise<Repository[]> {
    const cacheKey = getCacheKey(new Date(startDate).getFullYear(), page);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return cachedData;

    const query = `pushed:${startDate}..${endDate} archived:false stars:>=${DEFAULT_OPTIONS.minStars}`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=updated&order=asc&per_page=100&page=${page}`;
    
    const response = await fetchWithRetry(url, { 
        headers, 
        retries: 3,
        timeout: REQUEST_TIMEOUT 
    });
    
    const data: GitHubSearchResponse = await response.json();
    saveToCache(cacheKey, data.items);
    
    return data.items;
}

function createProgressBar(current: number, total: number, width: number = 40): string {
    const percentage = Math.min(100, (current / total) * 100);
    const filledWidth = Math.round((width * percentage) / 100);
    const emptyWidth = width - filledWidth;
    
    const filledBar = '█'.repeat(filledWidth);
    const emptyBar = '░'.repeat(emptyWidth);
    
    return `${filledBar}${emptyBar} ${percentage.toFixed(1)}%`;
}

async function fetchOldRepositories(): Promise<Repository[]> {
    const repos: Repository[] = [];
    const controller = new AbortController();
    const totalYears = DEFAULT_OPTIONS.yearEnd - DEFAULT_OPTIONS.yearStart + 1;
    let processedYears = 0;

    console.log(`\n🎯 Target: ${DEFAULT_OPTIONS.maxRepos} repositories between ${DEFAULT_OPTIONS.yearStart}-${DEFAULT_OPTIONS.yearEnd}\n`);

    for (let year = DEFAULT_OPTIONS.yearStart; year <= DEFAULT_OPTIONS.yearEnd; year++) {
        if (repos.length >= DEFAULT_OPTIONS.maxRepos) break;

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        processedYears++;
        const yearProgress = createProgressBar(processedYears, totalYears);
        console.log(`\n📅 Year ${year} [${yearProgress}]`);
        
        try {
            let page = 1;
            let hasMore = true;
            let yearRepos = 0;
            
            while (hasMore && repos.length < DEFAULT_OPTIONS.maxRepos) {
                const pagePromises: Promise<Repository[]>[] = [];
                
                for (let i = 0; i < DEFAULT_OPTIONS.concurrency && (page + i) <= 10; i++) {
                    pagePromises.push(fetchPage(page + i, startDate, endDate, controller.signal));
                }
                
                if (pagePromises.length === 0) break;
                
                console.log(`  ⏳ Fetching pages ${page} to ${page + pagePromises.length - 1}...`);
                const results = await Promise.all(pagePromises);
                const newRepos = results.flat();
                
                if (newRepos.length === 0) {
                    hasMore = false;
                    break;
                }
                
                repos.push(...newRepos);
                yearRepos += newRepos.length;
                
                const totalProgress = createProgressBar(repos.length, DEFAULT_OPTIONS.maxRepos);
                console.log(`  📊 Found ${yearRepos} repos in ${year} (Total: ${repos.length}) ${totalProgress}`);
                
                if (repos.length >= DEFAULT_OPTIONS.maxRepos) {
                    repos.splice(DEFAULT_OPTIONS.maxRepos);
                    break;
                }
                
                if (page + DEFAULT_OPTIONS.concurrency > 10) {
                    console.log(`  ⚠️ Reached GitHub's search result limit for ${year}`);
                    hasMore = false;
                    break;
                }
                
                page += DEFAULT_OPTIONS.concurrency;
            }
        } catch (error) {
            if (error instanceof GitHubAPIError) {
                if (error instanceof RateLimitError) {
                    console.log(`  ⏳ Rate limit reached, waiting for reset...`);
                    continue;
                }
                console.error(`  ❌ GitHub API error: ${error.message}`);
            } else {
                console.error(`  ❌ Error: ${error instanceof Error ? error.message : error}`);
            }
            
            if (repos.length > 0) {
                console.log(`  ⚠️ Continuing with ${repos.length} repositories found so far...`);
                break;
            }
            throw error;
        }
    }

    return repos;
}

function generateMarkdown(repos: Repository[]): string {
    const now = new Date();
    const searchStartYear = DEFAULT_OPTIONS.yearStart;
    const searchEndYear = DEFAULT_OPTIONS.yearEnd;

    // Header section with badge
    let content = `# 🕰️ GitHub Time Capsule: Repositories from ${searchStartYear}-${searchEndYear}\n\n`;
    content += `![Last Updated](https://img.shields.io/badge/Last%20Updated-${encodeURIComponent(now.toLocaleDateString())}-blue)\n`;
    content += `![Total Repos](https://img.shields.io/badge/Total%20Repos-${repos.length}-green)\n`;
    content += `![Total Stars](https://img.shields.io/badge/Total%20Stars-${repos.reduce((sum, repo) => sum + repo.stargazers_count, 0)}-yellow)\n\n`;
    
    // Executive Summary
    content += "## 📈 Executive Summary\n\n";
    content += `This report catalogs ${repos.length} historically significant repositories from the ${searchStartYear}-${searchEndYear} era. `;
    content += `These repositories, while inactive, represent important milestones in open source development and contain valuable insights into programming practices of their time.\n\n`;

    // Quick stats
    content += "## 📊 Quick Stats\n\n";
    const languages = [...new Set(repos.map(r => r.language || 'Unknown'))].sort();
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const avgStars = (totalStars / repos.length).toFixed(1);
    const topLanguage = [...languages].sort((a, b) => 
        repos.filter(r => r.language === b).length - 
        repos.filter(r => r.language === a).length
    )[0];
    
    content += "<details><summary>Click to expand stats</summary>\n\n";
    content += "| Metric | Value |\n";
    content += "|--------|-------|\n";
    content += `| Total Repositories | ${repos.length.toLocaleString()} |\n`;
    content += `| Total Stars | ${totalStars.toLocaleString()} |\n`;
    content += `| Average Stars | ${avgStars} |\n`;
    content += `| Languages Found | ${languages.length} |\n`;
    content += `| Most Used Language | ${topLanguage} |\n`;
    content += `| Search Period | ${searchStartYear} - ${searchEndYear} |\n`;
    content += `| Minimum Stars | ${DEFAULT_OPTIONS.minStars} |\n`;
    content += "</details>\n\n";

    // Top Repositories Section
    content += "## 🏆 Top 10 Most Popular Repositories\n\n";
    content += "| Repository | Stars | Language | Description |\n";
    content += "|------------|-------|----------|-------------|\n";
    
    repos
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 10)
        .forEach(repo => {
            const name = `[${repo.name}](${repo.html_url})`;
            const stars = `⭐ ${repo.stargazers_count.toLocaleString()}`;
            const language = repo.language || 'N/A';
            const desc = repo.description || '';
            const description = desc.length > 100 ? `${desc.slice(0, 100)}...` : desc || 'No description';
            content += `| ${name} | ${stars} | ${language} | ${description.replace(/\|/g, '\\|')} |\n`;
        });
    content += "\n";

    // Language distribution with ASCII chart
    content += "## 👨‍💻 Language Distribution\n\n";
    const langStats = new Map<string, number>();
    repos.forEach(repo => {
        const lang = repo.language || 'Unknown';
        langStats.set(lang, (langStats.get(lang) || 0) + 1);
    });
    
    content += "<details><summary>Click to see language distribution</summary>\n\n";
    content += "| Language | Count | Distribution |\n";
    content += "|----------|-------|--------------|---|\n";
    
    [...langStats.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([lang, count]) => {
            const percentage = (count / repos.length) * 100;
            const bar = '█'.repeat(Math.round(percentage / 2));
            content += `| ${lang} | ${count} | ${bar} ${percentage.toFixed(1)}% |\n`;
        });
    content += "</details>\n\n";

    // Timeline Analysis
    content += "## 📅 Timeline Analysis\n\n";
    const yearStats = new Map<number, number>();
    repos.forEach(repo => {
        const year = new Date(repo.pushed_at).getFullYear();
        yearStats.set(year, (yearStats.get(year) || 0) + 1);
    });

    content += "Last update distribution by year:\n\n";
    content += "```\n";
    [...yearStats.entries()]
        .sort((a, b) => a[0] - b[0])
        .forEach(([year, count]) => {
            const bar = '█'.repeat(Math.round(count / repos.length * 50));
            content += `${year} | ${bar} ${count}\n`;
        });
    content += "```\n\n";

    // Full Repository List
    content += "## 📚 Complete Repository List\n\n";
    content += "<details><summary>Click to see all repositories</summary>\n\n";
    content += "| Repository | Owner | Language | Stars | Last Updated | Description |\n";
    content += "|------------|-------|----------|-------|--------------|-------------|\n";

    repos
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .forEach(repo => {
            const lastUpdated = new Date(repo.pushed_at).toLocaleDateString();
            const language = repo.language || 'N/A';
            const name = `[${repo.name}](${repo.html_url})`;
            const owner = `[@${repo.owner.login}](https://github.com/${repo.owner.login})`;
            const stars = repo.stargazers_count.toLocaleString();
            const desc = repo.description || '';
            const description = desc.length > 100 ? `${desc.slice(0, 100)}...` : desc || 'No description';
            
            content += `| ${name} | ${owner} | ${language} | ⭐ ${stars} | ${lastUpdated} | ${description.replace(/\|/g, '\\|')} |\n`;
        });
    content += "</details>\n\n";

    // Recommendations Section
    content += "## 💡 Recommendations\n\n";
    content += "Based on the analysis of these repositories:\n\n";
    content += "1. **Historical Value**: Many of these repositories showcase early implementations of important concepts\n";
    content += "2. **Learning Opportunities**: Study these codebases to understand evolution of coding practices\n";
    content += "3. **Potential for Revival**: Some projects might benefit from modernization\n";
    content += "4. **Documentation**: Consider archiving knowledge from these historical codebases\n\n";

    // Footer with metadata
    content += "## ℹ️ About This Report\n\n";
    content += "<details><summary>Click to see report metadata</summary>\n\n";
    content += "This report was automatically generated by [Old Repository Finder](https://github.com/your-username/old-repo-finder). ";
    content += "It searches for GitHub repositories that haven't been updated in a specified time period.\n\n";
    content += "**Report Metadata:**\n";
    content += "- Generated on: " + now.toUTCString() + "\n";
    content += "- Search Parameters:\n";
    content += `  - Year Range: ${searchStartYear}-${searchEndYear}\n`;
    content += `  - Minimum Stars: ${DEFAULT_OPTIONS.minStars}\n`;
    content += `  - Total Results: ${repos.length}\n`;
    content += "</details>\n\n";
    
    content += "*Note: This data represents a snapshot of historical GitHub repositories. Some repositories might have been updated since this report was generated.*\n";

    return content;
}

async function commitAndPush() {
    const gitStatus = Bun.spawn(["git", "status", "--porcelain"], {
        stdout: "pipe"
    });
    const stdout = await new Response(gitStatus.stdout).text();
    
    if (!stdout.trim()) {
        console.log("📝 No changes to commit");
        return;
    }

    try {
        console.log("🔄 Committing and pushing changes...");
        
        // Add both files
        const addProcess = Bun.spawn(["git", "add", RESULT_FILE, "historical-data.json"]);
        await addProcess.exited;

        // Create commit with timestamp
        const date = new Date().toISOString().split('T')[0];
        const commitMsg = `Update repository data (${date})`;
        const commitProcess = Bun.spawn(["git", "commit", "-m", commitMsg]);
        await commitProcess.exited;

        // Push changes
        const pushProcess = Bun.spawn(["git", "push"]);
        await pushProcess.exited;

        console.log("✅ Successfully pushed changes to repository");
    } catch (error) {
        console.error("❌ Failed to push changes:", error instanceof Error ? error.message : error);
        // Don't exit, as we still want to keep the generated file
    }
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

function validateOptions(options: Options): ValidationResult {
    const errors: string[] = [];
    const currentYear = new Date().getFullYear();

    if (options.yearStart > options.yearEnd) {
        errors.push('Start year must be less than or equal to end year');
    }

    if (options.yearStart < 2008) {
        errors.push('Start year cannot be earlier than 2008 (GitHub\'s founding year)');
    }

    if (options.yearEnd > currentYear) {
        errors.push(`End year cannot be later than current year (${currentYear})`);
    }

    if (options.minStars < 0) {
        errors.push('Minimum stars cannot be negative');
    }

    if (options.maxRepos <= 0) {
        errors.push('Maximum repositories must be greater than 0');
    }

    if (options.concurrency <= 0 || options.concurrency > 5) {
        errors.push('Concurrency must be between 1 and 5');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

async function checkGitHubAccess(): Promise<void> {
    try {
        const response = await fetch('https://api.github.com/rate_limit', { headers });
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

async function parseArgs(): Promise<void> {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const key = args[i];
        const value = args[i + 1];
        
        switch (key) {
            case '--min-stars':
                DEFAULT_OPTIONS.minStars = parseInt(value);
                i++;
                break;
            case '--max-repos':
                DEFAULT_OPTIONS.maxRepos = parseInt(value);
                i++;
                break;
            case '--concurrency':
                DEFAULT_OPTIONS.concurrency = parseInt(value);
                i++;
                break;
            case '--year-start':
                DEFAULT_OPTIONS.yearStart = parseInt(value);
                i++;
                break;
            case '--year-end':
                DEFAULT_OPTIONS.yearEnd = parseInt(value);
                i++;
                break;
            case '--auto-push':
                DEFAULT_OPTIONS.autoPush = true;
                break;
            case '--debug':
                DEFAULT_OPTIONS.debug = true;
                break;
            case '--help':
                printHelp();
                process.exit(0);
            default:
                console.warn(`⚠️ Unknown option: ${key}`);
        }
    }

    if (DEFAULT_OPTIONS.debug) {
        debug('Command line arguments:', args);
        debug('Parsed options:', DEFAULT_OPTIONS);
    }

    const validation = validateOptions(DEFAULT_OPTIONS);
    if (!validation.isValid) {
        console.error('❌ Invalid options:');
        validation.errors.forEach(error => console.error(`  • ${error}`));
        process.exit(1);
    }
}

function printHelp(): void {
    console.log(`
Old Repository Finder - Find historical GitHub repositories

Usage:
  bun run index.ts [options]

Options:
  --min-stars <number>     Minimum number of stars (default: ${DEFAULT_OPTIONS.minStars})
  --max-repos <number>     Maximum number of repositories to fetch (default: ${DEFAULT_OPTIONS.maxRepos})
  --concurrency <number>   Number of concurrent requests (1-5, default: ${DEFAULT_OPTIONS.concurrency})
  --year-start <number>    Start year for search (>= 2008, default: ${DEFAULT_OPTIONS.yearStart})
  --year-end <number>      End year for search (default: ${DEFAULT_OPTIONS.yearEnd})
  --auto-push             Automatically commit and push changes
  --debug                 Enable debug mode
  --help                  Show this help message

Examples:
  bun run index.ts --min-stars 100 --year-start 2010 --year-end 2012
  bun run index.ts --max-repos 500 --concurrency 3 --auto-push
`);
}

interface HistoricalData {
    timestamp: string;
    stats: {
        totalRepos: number;
        totalStars: number;
        languageDistribution: Record<string, number>;
    };
    repositories: Repository[];
}

interface ComparisonResult {
    newRepos: Repository[];
    removedRepos: Repository[];
    starChanges: Array<{
        name: string;
        before: number;
        after: number;
    }>;
}

async function saveHistoricalData(repos: Repository[]): Promise<void> {
    const historicalFile = 'historical-data.json';
    const stats = {
        totalRepos: repos.length,
        totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
        languageDistribution: repos.reduce((acc, repo) => {
            const lang = repo.language || 'Unknown';
            acc[lang] = (acc[lang] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    };

    const data: HistoricalData = {
        timestamp: new Date().toISOString(),
        stats,
        repositories: repos
    };

    try {
        debug('Saving historical data');
        await Bun.write(historicalFile, JSON.stringify(data, null, 2));
        debug('Historical data saved successfully');
    } catch (error) {
        logError(error, 'Saving historical data');
    }
}

async function compareWithPreviousRun(currentRepos: Repository[]): Promise<ComparisonResult | null> {
    const historicalFile = 'historical-data.json';
    
    try {
        const fileExists = await Bun.file(historicalFile).exists();
        if (!fileExists) {
            debug('No historical data found');
            return null;
        }

        debug('Reading historical data');
        const historicalContent = await Bun.file(historicalFile).text();
        const historicalData: HistoricalData = JSON.parse(historicalContent);
        const previousRepos = historicalData.repositories;

        const previousRepoMap = new Map(previousRepos.map(repo => [repo.full_name, repo]));
        const currentRepoMap = new Map(currentRepos.map(repo => [repo.full_name, repo]));

        const newRepos = currentRepos.filter(repo => !previousRepoMap.has(repo.full_name));
        const removedRepos = previousRepos.filter(repo => !currentRepoMap.has(repo.full_name));
        const starChanges = currentRepos
            .map(current => {
                const previous = previousRepoMap.get(current.full_name);
                if (previous && previous.stargazers_count !== current.stargazers_count) {
                    return {
                        name: current.full_name,
                        before: previous.stargazers_count,
                        after: current.stargazers_count
                    };
                }
                return null;
            })
            .filter((change): change is NonNullable<typeof change> => change !== null);

        debug('Comparison results', { 
            newCount: newRepos.length, 
            removedCount: removedRepos.length, 
            changesCount: starChanges.length 
        });

        return { newRepos, removedRepos, starChanges };
    } catch (error) {
        logError(error, 'Comparing with previous run');
        return null;
    }
}

function generateComparisonMarkdown(comparison: ComparisonResult): string {
    let content = '## 📊 Changes Since Last Run\n\n';

    if (comparison.newRepos.length > 0) {
        content += '### 🆕 New Repositories\n';
        content += '| Repository | Stars | Language |\n';
        content += '|------------|-------|----------|\n';
        comparison.newRepos.forEach(repo => {
            content += `| [${repo.name}](${repo.html_url}) | ⭐ ${repo.stargazers_count} | ${repo.language || 'N/A'} |\n`;
        });
        content += '\n';
    }

    if (comparison.starChanges.length > 0) {
        content += '### ⭐ Star Changes\n';
        content += '| Repository | Before | After | Change |\n';
        content += '|------------|---------|--------|--------|\n';
        comparison.starChanges.forEach(change => {
            const diff = change.after - change.before;
            const diffIcon = diff > 0 ? '📈' : '📉';
            content += `| ${change.name} | ${change.before} | ${change.after} | ${diffIcon} ${diff > 0 ? '+' : ''}${diff} |\n`;
        });
        content += '\n';
    }

    if (comparison.removedRepos.length > 0) {
        content += '### 🗑️ Removed Repositories\n';
        content += '| Repository | Last Known Stars | Language |\n';
        content += '|------------|------------------|----------|\n';
        comparison.removedRepos.forEach(repo => {
            content += `| [${repo.name}](${repo.html_url}) | ⭐ ${repo.stargazers_count} | ${repo.language || 'N/A'} |\n`;
        });
        content += '\n';
    }

    return content;
}

// Update the main function to include historical comparison
async function main() {
    console.log('🚀 Starting Old Repository Finder...\n');
    
    try {
        if (process.argv.includes('--help')) {
            printHelp();
            return;
        }

        await parseArgs();
        await checkGitHubAccess();
        
        console.log('\n📋 Configuration:');
        console.log(`  • Search Period: ${DEFAULT_OPTIONS.yearStart}-${DEFAULT_OPTIONS.yearEnd}`);
        console.log(`  • Minimum Stars: ${DEFAULT_OPTIONS.minStars}`);
        console.log(`  • Maximum Repos: ${DEFAULT_OPTIONS.maxRepos}`);
        console.log(`  • Concurrency: ${DEFAULT_OPTIONS.concurrency}`);
        console.log(`  • Auto Push: ${DEFAULT_OPTIONS.autoPush ? 'Yes' : 'No'}`);
        console.log(`  • Debug Mode: ${DEFAULT_OPTIONS.debug ? 'Enabled' : 'Disabled'}\n`);
        
        const startTime = Date.now();
        const repos = await fetchOldRepositories();

        if (repos.length === 0) {
            console.log('\n⚠️ No repositories found matching the criteria');
            return;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 Found ${repos.length} repositories in ${duration}s`);

        // Compare with previous run
        const comparison = await compareWithPreviousRun(repos);
        let markdown = generateMarkdown(repos);
        
        if (comparison) {
            const comparisonContent = generateComparisonMarkdown(comparison);
            markdown = comparisonContent + '\n---\n\n' + markdown;
        }

        await Bun.write(RESULT_FILE, markdown);
        console.log(`\n📄 Results saved to ${RESULT_FILE}`);

        // Save historical data
        await saveHistoricalData(repos);
        debug('Historical data updated');

        if (DEFAULT_OPTIONS.autoPush) {
            await commitAndPush();
        }

        console.log('\n✨ Done!');
    } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();