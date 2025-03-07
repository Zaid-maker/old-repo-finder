import type { Repository, HistoricalData, ComparisonResult } from '../types';
import { CONSTANTS } from '../config';
import { debug, logError } from '../utils';

export async function saveHistoricalData(repos: Repository[]): Promise<void> {
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
        await Bun.write(CONSTANTS.HISTORICAL_FILE, JSON.stringify(data, null, 2));
        debug('Historical data saved successfully');
    } catch (error) {
        logError(error, 'Saving historical data');
    }
}

export async function compareWithPreviousRun(currentRepos: Repository[]): Promise<ComparisonResult | null> {
    try {
        const fileExists = await Bun.file(CONSTANTS.HISTORICAL_FILE).exists();
        if (!fileExists) {
            debug('No historical data found');
            return null;
        }

        debug('Reading historical data');
        const historicalContent = await Bun.file(CONSTANTS.HISTORICAL_FILE).text();
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