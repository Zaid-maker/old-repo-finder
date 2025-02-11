import { Repository, ComparisonResult } from '../types';
import { DEFAULT_OPTIONS } from '../config/config';

export class MarkdownService {
    private static generateHeader(): string {
        const now = new Date();
        const searchStartYear = DEFAULT_OPTIONS.yearStart;
        const searchEndYear = DEFAULT_OPTIONS.yearEnd;

        return `# 🕰️ GitHub Time Capsule: Repositories from ${searchStartYear}-${searchEndYear}\n\n` +
            `![Last Updated](https://img.shields.io/badge/Last%20Updated-${encodeURIComponent(now.toLocaleDateString())}-blue)\n` +
            `![Total Repos](https://img.shields.io/badge/Total%20Repos-{REPO_COUNT}-green)\n` +
            `![Total Stars](https://img.shields.io/badge/Total%20Stars-{TOTAL_STARS}-yellow)\n\n`;
    }

    private static generateExecutiveSummary(repos: Repository[]): string {
        return `## 📈 Executive Summary\n\n` +
            `This report catalogs ${repos.length} historically significant repositories from the ` +
            `${DEFAULT_OPTIONS.yearStart}-${DEFAULT_OPTIONS.yearEnd} era. ` +
            `These repositories, while inactive, represent important milestones in open source development ` +
            `and contain valuable insights into programming practices of their time.\n\n`;
    }

    private static generateQuickStats(repos: Repository[]): string {
        const languages = [...new Set(repos.map(r => r.language || 'Unknown'))].sort();
        const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        const avgStars = (totalStars / repos.length).toFixed(1);
        const topLanguage = [...languages].sort((a, b) => 
            repos.filter(r => r.language === b).length - 
            repos.filter(r => r.language === a).length
        )[0];

        return `## 📊 Quick Stats\n\n` +
            `<details><summary>Click to expand stats</summary>\n\n` +
            `| Metric | Value |\n` +
            `|--------|-------|\n` +
            `| Total Repositories | ${repos.length.toLocaleString()} |\n` +
            `| Total Stars | ${totalStars.toLocaleString()} |\n` +
            `| Average Stars | ${avgStars} |\n` +
            `| Languages Found | ${languages.length} |\n` +
            `| Most Used Language | ${topLanguage} |\n` +
            `| Search Period | ${DEFAULT_OPTIONS.yearStart} - ${DEFAULT_OPTIONS.yearEnd} |\n` +
            `| Minimum Stars | ${DEFAULT_OPTIONS.minStars} |\n` +
            `</details>\n\n`;
    }

    private static generateLanguageDistribution(repos: Repository[]): string {
        const langStats = new Map<string, number>();
        repos.forEach(repo => {
            const lang = repo.language || 'Unknown';
            langStats.set(lang, (langStats.get(lang) || 0) + 1);
        });

        let content = `## 👨‍💻 Language Distribution\n\n` +
            `<details><summary>Click to see language distribution</summary>\n\n` +
            `| Language | Count | Distribution |\n` +
            `|----------|-------|--------------|---|\n`;

        [...langStats.entries()]
            .sort((a, b) => b[1] - a[1])
            .forEach(([lang, count]) => {
                const percentage = (count / repos.length) * 100;
                const bar = '█'.repeat(Math.round(percentage / 2));
                content += `| ${lang} | ${count} | ${bar} ${percentage.toFixed(1)}% |\n`;
            });

        return content + `</details>\n\n`;
    }

    private static generateTimelineAnalysis(repos: Repository[]): string {
        const yearStats = new Map<number, number>();
        repos.forEach(repo => {
            const year = new Date(repo.pushed_at).getFullYear();
            yearStats.set(year, (yearStats.get(year) || 0) + 1);
        });

        let content = `## 📅 Timeline Analysis\n\n` +
            `Last update distribution by year:\n\n\`\`\`\n`;

        [...yearStats.entries()]
            .sort((a, b) => a[0] - b[0])
            .forEach(([year, count]) => {
                const bar = '█'.repeat(Math.round(count / repos.length * 50));
                content += `${year} | ${bar} ${count}\n`;
            });

        return content + `\`\`\`\n\n`;
    }

    private static generateTopRepositories(repos: Repository[]): string {
        let content = `## 🏆 Top 10 Most Popular Repositories\n\n` +
            `| Repository | Stars | Language | Description |\n` +
            `|------------|-------|----------|-------------|\n`;

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

        return content + '\n';
    }

    private static generateComparisonSection(comparison: ComparisonResult): string {
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

    private static generateRepositoryList(repos: Repository[]): string {
        let content = `## 📚 Complete Repository List\n\n` +
            `<details><summary>Click to see all repositories</summary>\n\n` +
            `| Repository | Owner | Language | Stars | Last Updated | Description |\n` +
            `|------------|-------|----------|-------|--------------|-------------|\n`;

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

        return content + `</details>\n\n`;
    }

    private static generateFooter(): string {
        const now = new Date();
        return `## ℹ️ About This Report\n\n` +
            `<details><summary>Click to see report metadata</summary>\n\n` +
            `This report was automatically generated by [Old Repository Finder](https://github.com/your-username/old-repo-finder). ` +
            `It searches for GitHub repositories that haven't been updated in a specified time period.\n\n` +
            `**Report Metadata:**\n` +
            `- Generated on: ${now.toUTCString()}\n` +
            `- Search Parameters:\n` +
            `  - Year Range: ${DEFAULT_OPTIONS.yearStart}-${DEFAULT_OPTIONS.yearEnd}\n` +
            `  - Minimum Stars: ${DEFAULT_OPTIONS.minStars}\n` +
            `  - Total Results: {REPO_COUNT}\n` +
            `</details>\n\n` +
            `*Note: This data represents a snapshot of historical GitHub repositories. Some repositories might have been updated since this report was generated.*\n`;
    }

    static generateMarkdown(repos: Repository[], comparison?: ComparisonResult): string {
        let content = this.generateHeader()
            .replace('{REPO_COUNT}', repos.length.toString())
            .replace('{TOTAL_STARS}', repos.reduce((sum, repo) => sum + repo.stargazers_count, 0).toString());

        if (comparison) {
            content += this.generateComparisonSection(comparison) + '\n---\n\n';
        }

        content += this.generateExecutiveSummary(repos);
        content += this.generateQuickStats(repos);
        content += this.generateLanguageDistribution(repos);
        content += this.generateTimelineAnalysis(repos);
        content += this.generateTopRepositories(repos);
        content += this.generateRepositoryList(repos);
        content += this.generateFooter().replace('{REPO_COUNT}', repos.length.toString());

        return content;
    }
}