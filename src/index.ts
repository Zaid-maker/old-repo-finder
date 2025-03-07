#!/usr/bin/env bun

import type { Repository } from './types';
import { DEFAULT_OPTIONS, CONSTANTS } from './config';
import { checkGitHubAccess, fetchPage } from './services/github';
import { generateMarkdown, generateComparisonMarkdown } from './services/markdown';
import { saveHistoricalData, compareWithPreviousRun } from './services/data';
import { commitAndPush } from './services/git';
import { createProgressBar, debug, printHelp } from './utils';
import { parseArgs } from './utils/cli';

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
                    pagePromises.push(fetchPage(page + i, startDate, endDate, DEFAULT_OPTIONS.minStars));
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
            console.error(`  ❌ Error fetching repositories for ${year}:`, error instanceof Error ? error.message : error);
            if (repos.length === 0) throw error;
            break;
        }
    }

    return repos;
}

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

        await Bun.write(CONSTANTS.RESULT_FILE, markdown);
        console.log(`\n📄 Results saved to ${CONSTANTS.RESULT_FILE}`);

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