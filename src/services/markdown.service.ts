import { Repository, ComparisonResult } from '../types';
import { IMarkdownService } from '../interfaces/markdown.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IConfigService } from '../interfaces/config.interface';
import { ServiceContainer } from './service-container';

export class MarkdownService implements IMarkdownService {
    private readonly logger: ILogger;
    private readonly config: IConfigService;

    constructor() {
        const container = ServiceContainer.getInstance();
        this.logger = container.get<ILogger>(ServiceContainer.TOKENS.Logger);
        this.config = container.get<IConfigService>(ServiceContainer.TOKENS.Config);
    }

    private createBadge(label: string, value: string, color: string): string {
        return `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color})`;
    }

    private createBarChart(data: Array<[string, number]>, maxWidth: number = 30): string {
        const max = Math.max(...data.map(([, value]) => value));
        return data.map(([label, value]) => {
            const barWidth = Math.round((value / max) * maxWidth);
            const bar = '█'.repeat(barWidth) + '░'.repeat(maxWidth - barWidth);
            const percentage = ((value / max) * 100).toFixed(1);
            return `${label.padEnd(15)} | ${bar} ${percentage}% (${value})`;
        }).join('\n');
    }

    private generateStats(repos: Repository[]): { [key: string]: number | string } {
        const stats = {
            totalRepos: repos.length,
            totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
            averageStars: 0,
            languages: new Set(repos.map(r => r.language || 'Unknown')).size,
            oldestRepo: repos.reduce((oldest, repo) => 
                new Date(repo.pushed_at) < new Date(oldest.pushed_at) ? repo : oldest
            ).pushed_at,
            mostStarred: Math.max(...repos.map(r => r.stargazers_count))
        };

        stats.averageStars = Math.round((stats.totalStars / stats.totalRepos) * 10) / 10;

        return stats;
    }

    generateMarkdown(repos: Repository[], comparison?: ComparisonResult): string {
        const stats = this.generateStats(repos);
        let content = this.generateHeader(stats);

        if (comparison) {
            content += this.generateComparisonSection(comparison);
            content += '\n---\n\n';
        }

        content += this.generateExecutiveSummary(repos);
        content += this.generateQuickStats(repos);
        content += this.generateLanguageDistribution(repos);
        content += this.generateTimelineAnalysis(repos);
        content += this.generateTopRepositories(repos);
        content += this.generateRepositoryList(repos);
        content += this.generateFooter(stats);

        return content;
    }

    private generateHeader(stats: { [key: string]: number | string }): string {
        const options = this.config.options;
        return `# 🕰️ GitHub Time Capsule: Repositories from ${options.yearStart}-${options.yearEnd}\n\n` +
            `${this.createBadge('Total Repos', stats.totalRepos.toString(), 'blue')} ` +
            `${this.createBadge('Total Stars', stats.totalStars.toString(), 'yellow')} ` +
            `${this.createBadge('Languages', stats.languages.toString(), 'green')}\n\n` +
            `> Last updated: ${new Date().toISOString()}\n\n`;
    }

    generateExecutiveSummary(repos: Repository[]): string {
        const stats = this.generateStats(repos);
        const options = this.config.options;
        
        return `## 📈 Executive Summary\n\n` +
            `This analysis covers ${stats.totalRepos} repositories from ${options.yearStart}-${options.yearEnd}, ` +
            `collectively gathering ${stats.totalStars.toLocaleString()} stars. These repositories represent ` +
            `significant historical projects across ${stats.languages} different programming languages.\n\n` +
            `Key findings:\n` +
            `- Average repository has ${stats.averageStars} stars\n` +
            `- Most starred repository has ${stats.mostStarred} stars\n` +
            `- Oldest repository was last updated on ${new Date(stats.oldestRepo as string).toLocaleDateString()}\n\n`;
    }

    generateQuickStats(repos: Repository[]): string {
        const stats = this.generateStats(repos);
        const options = this.config.options;

        return `## 📊 Quick Stats\n\n` +
            `<details><summary>Click to expand stats</summary>\n\n` +
            `| Metric | Value |\n` +
            `|--------|-------|\n` +
            `| Total Repositories | ${stats.totalRepos.toLocaleString()} |\n` +
            `| Total Stars | ${stats.totalStars.toLocaleString()} |\n` +
            `| Average Stars | ${stats.averageStars} |\n` +
            `| Languages Found | ${stats.languages} |\n` +
            `| Search Period | ${options.yearStart} - ${options.yearEnd} |\n` +
            `| Minimum Stars | ${options.minStars} |\n` +
            `</details>\n\n`;
    }

    generateLanguageDistribution(repos: Repository[]): string {
        const langStats = repos.reduce((acc, repo) => {
            const lang = repo.language || 'Unknown';
            acc.set(lang, (acc.get(lang) || 0) + 1);
            return acc;
        }, new Map<string, number>());

        const langData = [...langStats.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15); // Show top 15 languages

        return `## 👨‍💻 Language Distribution\n\n` +
            `<details><summary>Click to see language distribution</summary>\n\n` +
            `\`\`\`\n${this.createBarChart(langData)}\n\`\`\`\n\n` +
            `| Language | Count | Percentage |\n` +
            `|----------|-------|------------|\n` +
            langData.map(([lang, count]) => {
                const percentage = ((count / repos.length) * 100).toFixed(1);
                return `| ${lang} | ${count} | ${percentage}% |`;
            }).join('\n') +
            '\n</details>\n\n';
    }

    generateTimelineAnalysis(repos: Repository[]): string {
        const yearStats = repos.reduce((acc, repo) => {
            const year = new Date(repo.pushed_at).getFullYear();
            acc.set(year, (acc.get(year) || 0) + 1);
            return acc;
        }, new Map<number, number>());

        const timelineData = [...yearStats.entries()]
            .sort(([a], [b]) => a - b);

        return `## 📅 Timeline Analysis\n\n` +
            `Repository updates by year:\n\n` +
            `\`\`\`\n${this.createBarChart(timelineData)}\n\`\`\`\n\n`;
    }

    generateTopRepositories(repos: Repository[]): string {
        return `## 🏆 Top 10 Most Popular Repositories\n\n` +
            `| Repository | Stars | Language | Description |\n` +
            `|------------|-------|----------|-------------|\n` +
            repos
                .sort((a, b) => b.stargazers_count - a.stargazers_count)
                .slice(0, 10)
                .map(repo => {
                    const name = `[${repo.name}](${repo.html_url})`;
                    const stars = `⭐ ${repo.stargazers_count.toLocaleString()}`;
                    const language = repo.language || 'N/A';
                    const desc = repo.description || '';
                    const description = desc.length > 100 ? `${desc.slice(0, 100)}...` : desc || 'No description';
                    return `| ${name} | ${stars} | ${language} | ${description.replace(/\|/g, '\\|')} |`;
                })
                .join('\n') +
            '\n\n';
    }

    generateComparisonSection(comparison: ComparisonResult): string {
        let content = '## 📊 Changes Since Last Run\n\n';

        if (comparison.newRepos.length > 0) {
            content += '### 🆕 New Repositories\n\n' +
                '| Repository | Stars | Language | Description |\n' +
                '|------------|-------|----------|-------------|\n' +
                comparison.newRepos
                    .map(repo => {
                        const desc = (repo.description || '').slice(0, 100);
                        return `| [${repo.name}](${repo.html_url}) | ⭐ ${repo.stargazers_count} | ${repo.language || 'N/A'} | ${desc.replace(/\|/g, '\\|')} |`;
                    })
                    .join('\n') +
                '\n\n';
        }

        if (comparison.starChanges.length > 0) {
            content += '### ⭐ Notable Star Changes\n\n' +
                '| Repository | Before | After | Change |\n' +
                '|------------|---------|--------|--------|\n' +
                comparison.starChanges
                    .map(change => {
                        const diff = change.after - change.before;
                        const diffIcon = diff > 0 ? '📈' : '📉';
                        return `| ${change.name} | ${change.before} | ${change.after} | ${diffIcon} ${diff > 0 ? '+' : ''}${diff} |`;
                    })
                    .join('\n') +
                '\n\n';
        }

        if (comparison.removedRepos.length > 0) {
            content += '### 🗑️ Removed Repositories\n\n' +
                '| Repository | Last Known Stars | Language |\n' +
                '|------------|------------------|----------|\n' +
                comparison.removedRepos
                    .map(repo => 
                        `| [${repo.name}](${repo.html_url}) | ⭐ ${repo.stargazers_count} | ${repo.language || 'N/A'} |`
                    )
                    .join('\n') +
                '\n\n';
        }

        return content;
    }

    generateRepositoryList(repos: Repository[]): string {
        return `## 📚 Complete Repository List\n\n` +
            `<details><summary>Click to see all repositories</summary>\n\n` +
            `| Repository | Owner | Language | Stars | Last Updated | Description |\n` +
            `|------------|-------|----------|-------|--------------|-------------|\n` +
            repos
                .sort((a, b) => b.stargazers_count - a.stargazers_count)
                .map(repo => {
                    const lastUpdated = new Date(repo.pushed_at).toLocaleDateString();
                    const language = repo.language || 'N/A';
                    const name = `[${repo.name}](${repo.html_url})`;
                    const owner = `[@${repo.owner.login}](https://github.com/${repo.owner.login})`;
                    const stars = repo.stargazers_count.toLocaleString();
                    const desc = repo.description || '';
                    const description = desc.length > 100 ? `${desc.slice(0, 100)}...` : desc || 'No description';
                    return `| ${name} | ${owner} | ${language} | ⭐ ${stars} | ${lastUpdated} | ${description.replace(/\|/g, '\\|')} |`;
                })
                .join('\n') +
            '\n</details>\n\n';
    }

    private generateFooter(stats: { [key: string]: number | string }): string {
        const options = this.config.options;
        return `## ℹ️ About This Report\n\n` +
            `<details><summary>Click to see report metadata</summary>\n\n` +
            `This report was automatically generated by [Old Repository Finder](https://github.com/your-username/old-repo-finder). ` +
            `It identifies and analyzes historical GitHub repositories that haven't been updated recently.\n\n` +
            `**Report Metadata:**\n` +
            `- Generated on: ${new Date().toUTCString()}\n` +
            `- Search Parameters:\n` +
            `  - Year Range: ${options.yearStart}-${options.yearEnd}\n` +
            `  - Minimum Stars: ${options.minStars}\n` +
            `  - Total Results: ${stats.totalRepos}\n` +
            `  - Total Stars: ${stats.totalStars}\n` +
            `</details>\n\n` +
            `*Note: This data represents a snapshot of historical GitHub repositories. Some repositories might have been updated since this report was generated.*\n`;
    }
}