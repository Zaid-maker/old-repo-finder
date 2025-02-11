import { Repository, HistoricalData, ComparisonResult } from '../types';
import { IHistoricalService } from '../interfaces/historical.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IConfigService } from '../interfaces/config.interface';
import { ServiceContainer } from './service-container';
import { HistoricalDataError } from '../utils/errors';

interface LanguageTrend {
    language: string;
    trend: Array<{ date: string; count: number }>;
    growth: number;
}

export class HistoricalService implements IHistoricalService {
    private readonly logger: ILogger;
    private readonly config: IConfigService;

    constructor() {
        const container = ServiceContainer.getInstance();
        this.logger = container.get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.config = container.get<IConfigService>(ServiceContainer.TOKENS.Config);
    }

    private async readHistoricalFile(): Promise<HistoricalData | null> {
        try {
            const fileExists = await Bun.file(this.config.historicalFile).exists();
            if (!fileExists) {
                this.logger.debug('No historical data found');
                return null;
            }

            const content = await Bun.file(this.config.historicalFile).text();
            return JSON.parse(content) as HistoricalData;
        } catch (error) {
            throw new HistoricalDataError('read', 
                `Failed to read historical data: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async saveData(repos: Repository[]): Promise<void> {
        try {
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

            await Bun.write(this.config.historicalFile, JSON.stringify(data, null, 2));
            this.logger.debug('Historical data saved successfully');
        } catch (error) {
            throw new HistoricalDataError('write',
                `Failed to save historical data: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async loadPreviousData(): Promise<HistoricalData | null> {
        return this.readHistoricalFile();
    }

    async compareWithPrevious(currentRepos: Repository[]): Promise<ComparisonResult | null> {
        try {
            const historicalData = await this.readHistoricalFile();
            if (!historicalData) return null;

            const previousRepos = historicalData.repositories;
            const previousRepoMap = new Map(previousRepos.map(repo => [repo.full_name, repo]));
            const currentRepoMap = new Map(currentRepos.map(repo => [repo.full_name, repo]));

            // Find new repositories
            const newRepos = currentRepos.filter(repo => !previousRepoMap.has(repo.full_name));

            // Find removed repositories
            const removedRepos = previousRepos.filter(repo => !currentRepoMap.has(repo.full_name));

            // Find star changes
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
                .filter((change): change is NonNullable<typeof change> => change !== null)
                .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before));

            this.logger.debug('Comparison results', {
                newReposCount: newRepos.length,
                removedReposCount: removedRepos.length,
                starChangesCount: starChanges.length
            });

            return { newRepos, removedRepos, starChanges };
        } catch (error) {
            throw new HistoricalDataError('compare',
                `Failed to compare with previous data: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async getHistoricalStats(): Promise<{
        totalReposOverTime: Array<{ date: string; count: number }>;
        totalStarsOverTime: Array<{ date: string; stars: number }>;
        languageTrends: Record<string, Array<{ date: string; count: number }>>;
    } | null> {
        try {
            const historicalData = await this.readHistoricalFile();
            if (!historicalData) return null;

            const totalReposOverTime = [{
                date: historicalData.timestamp,
                count: historicalData.stats.totalRepos
            }];

            const totalStarsOverTime = [{
                date: historicalData.timestamp,
                stars: historicalData.stats.totalStars
            }];

            const languageTrends = Object.entries(historicalData.stats.languageDistribution).reduce(
                (acc, [lang, count]) => ({
                    ...acc,
                    [lang]: [{
                        date: historicalData.timestamp,
                        count
                    }]
                }),
                {} as Record<string, Array<{ date: string; count: number }>>
            );

            return {
                totalReposOverTime,
                totalStarsOverTime,
                languageTrends
            };
        } catch (error) {
            throw new HistoricalDataError('read',
                `Failed to get historical stats: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async analyzeLanguageTrends(): Promise<LanguageTrend[]> {
        const historicalData = await this.readHistoricalFile();
        if (!historicalData) return [];

        const languageStats = historicalData.stats.languageDistribution;
        const trends: LanguageTrend[] = [];

        for (const [language, currentCount] of Object.entries(languageStats)) {
            const previousCount = 0; // In future implementations, we can track historical counts
            const growth = ((currentCount - previousCount) / (previousCount || 1)) * 100;

            trends.push({
                language,
                trend: [{
                    date: historicalData.timestamp,
                    count: currentCount
                }],
                growth
            });
        }

        return trends.sort((a, b) => b.growth - a.growth);
    }

    async getRepositoryGrowthRate(repoFullName: string): Promise<number | null> {
        const historicalData = await this.readHistoricalFile();
        if (!historicalData) return null;

        const repo = historicalData.repositories.find(r => r.full_name === repoFullName);
        if (!repo) return null;

        // Calculate growth rate based on stars
        // In future implementations, we can track historical star counts
        return 0;
    }
}