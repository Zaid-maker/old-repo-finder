import { Repository } from './types';
import { GITHUB_TOKEN, RESULT_FILE } from './config/config';
import { GitHubService } from './services/github.service';
import { CacheService } from './services/cache.service';
import { GitService } from './services/git.service';
import { HistoricalService } from './services/historical.service';
import { MarkdownService } from './services/markdown.service';
import { ValidationService } from './services/validation.service';
import { ArgumentParserService } from './services/argument-parser.service';
import { debug, logError } from './utils/helpers';

export class Application {
    private static async validateSetup(): Promise<void> {
        const tokenValidation = ValidationService.validateToken(GITHUB_TOKEN);
        if (!tokenValidation.isValid) {
            console.error('❌ GitHub token validation failed:');
            tokenValidation.errors.forEach(error => console.error(`  • ${error}`));
            process.exit(1);
        }
    }

    private static async fetchRepositories(): Promise<Repository[]> {
        const repos: Repository[] = [];
        const controller = new AbortController();

        try {
            await GitHubService.checkAccess();

            for (let year = DEFAULT_OPTIONS.yearStart; year <= DEFAULT_OPTIONS.yearEnd; year++) {
                if (repos.length >= DEFAULT_OPTIONS.maxRepos) break;

                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                
                console.log(`\n📅 Searching repositories from ${startDate} to ${endDate}...`);
                
                try {
                    let page = 1;
                    let hasMore = true;
                    let yearRepos = 0;
                    
                    while (hasMore && repos.length < DEFAULT_OPTIONS.maxRepos) {
                        const pagePromises: Promise<Repository[]>[] = [];
                        
                        for (let i = 0; i < DEFAULT_OPTIONS.concurrency && (page + i) <= 10; i++) {
                            const cacheKey = CacheService.getCacheKey(year, page + i, DEFAULT_OPTIONS.minStars);
                            const cachedData = CacheService.get(cacheKey);
                            
                            if (cachedData) {
                                pagePromises.push(Promise.resolve(cachedData));
                            } else {
                                const query = `pushed:${startDate}..${endDate} archived:false stars:>=${DEFAULT_OPTIONS.minStars}`;
                                pagePromises.push(GitHubService.searchRepositories(query, page + i));
                            }
                        }
                        
                        if (pagePromises.length === 0) break;
                        
                        const results = await Promise.all(pagePromises);
                        const newRepos = results.flat();
                        
                        if (newRepos.length === 0) {
                            hasMore = false;
                            break;
                        }
                        
                        repos.push(...newRepos);
                        yearRepos += newRepos.length;
                        
                        console.log(`  📊 Found ${yearRepos} repos in ${year} (Total: ${repos.length})`);
                        
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
                    logError(error, `Fetching repositories for ${year}`);
                    if (repos.length === 0) throw error;
                    break;
                }
            }
        } catch (error) {
            logError(error, 'Repository fetching');
            throw error;
        }

        return repos;
    }

    private static async generateAndSaveReport(repos: Repository[]): Promise<void> {
        try {
            const comparison = await HistoricalService.compareWithPrevious(repos);
            const markdown = MarkdownService.generateMarkdown(repos, comparison);
            
            await Bun.write(RESULT_FILE, markdown);
            await HistoricalService.saveData(repos);
            
            if (DEFAULT_OPTIONS.autoPush) {
                const date = new Date().toISOString().split('T')[0];
                const success = await GitService.commitAndPush(
                    RESULT_FILE,
                    `Update old repositories list (${date})`
                );
                
                if (success) {
                    console.log('✅ Successfully pushed changes to repository');
                } else {
                    console.log('⚠️ Failed to push changes');
                }
            }
        } catch (error) {
            logError(error, 'Report generation');
            throw error;
        }
    }

    static async run(): Promise<void> {
        console.log('🚀 Starting Old Repository Finder...\n');
        
        try {
            // Parse command line arguments
            DEFAULT_OPTIONS = await ArgumentParserService.parse(process.argv.slice(2));
            
            // Validate setup
            await this.validateSetup();
            
            // Show configuration
            console.log('\n📋 Configuration:');
            console.log(`  • Search Period: ${DEFAULT_OPTIONS.yearStart}-${DEFAULT_OPTIONS.yearEnd}`);
            console.log(`  • Minimum Stars: ${DEFAULT_OPTIONS.minStars}`);
            console.log(`  • Maximum Repos: ${DEFAULT_OPTIONS.maxRepos}`);
            console.log(`  • Concurrency: ${DEFAULT_OPTIONS.concurrency}`);
            console.log(`  • Auto Push: ${DEFAULT_OPTIONS.autoPush ? 'Yes' : 'No'}\n`);
            
            // Start processing
            const startTime = Date.now();
            const repos = await this.fetchRepositories();

            if (repos.length === 0) {
                console.log('\n⚠️ No repositories found matching the criteria');
                return;
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n🎉 Found ${repos.length} repositories in ${duration}s`);

            // Generate and save report
            await this.generateAndSaveReport(repos);
            
            // Clean up
            CacheService.clearExpired();
            
            console.log('\n✨ Done!');
        } catch (error) {
            console.error('\n❌ Fatal error:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
}