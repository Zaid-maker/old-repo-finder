import { Repository, ComparisonResult } from '../types';

export interface IMarkdownService {
    generateMarkdown(repos: Repository[], comparison?: ComparisonResult): string;
    generateExecutiveSummary(repos: Repository[]): string;
    generateQuickStats(repos: Repository[]): string;
    generateLanguageDistribution(repos: Repository[]): string;
    generateTimelineAnalysis(repos: Repository[]): string;
    generateTopRepositories(repos: Repository[]): string;
    generateComparisonSection(comparison: ComparisonResult): string;
    generateRepositoryList(repos: Repository[]): string;
}