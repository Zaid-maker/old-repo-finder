import { Repository, HistoricalData, ComparisonResult } from '../types';

export interface IHistoricalService {
    saveData(repos: Repository[]): Promise<void>;
    loadPreviousData(): Promise<HistoricalData | null>;
    compareWithPrevious(currentRepos: Repository[]): Promise<ComparisonResult | null>;
    getHistoricalStats(): Promise<{
        totalReposOverTime: Array<{ date: string; count: number }>;
        totalStarsOverTime: Array<{ date: string; stars: number }>;
        languageTrends: Record<string, Array<{ date: string; count: number }>>;
    } | null>;
}