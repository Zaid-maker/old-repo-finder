import type { Repository, ComparisonResult } from '../types';
import { DEFAULT_OPTIONS } from '../config';

export function generateMarkdown(repos: Repository[]): string {
    const now = new Date();
    const searchStartYear = DEFAULT_OPTIONS.yearStart;
    const searchEndYear = DEFAULT_OPTIONS.yearEnd;

    let content = `# 🕰️ GitHub Time Capsule: Repositories from ${searchStartYear}-${searchEndYear}\n\n`;
    content += `![Last Updated](https://img.shields.io/badge/Last%20Updated-${encodeURIComponent(now.toLocaleDateString())}-blue)\n`;
    content += `![Total Repos](https://img.shields.io/badge/Total%20Repos-${repos.length}-green)\n`;
    content += `![Total Stars](https://img.shields.io/badge/Total%20Stars-${repos.reduce((sum, repo) => sum + repo.stargazers_count, 0)}-yellow)\n\n`;
    
    // Executive Summary
    content += generateExecutiveSummary(repos, searchStartYear, searchEndYear);
    
    // Quick Stats
    content += generateQuickStats(repos, searchStartYear, searchEndYear);
    
    // Top Repositories
    content += generateTopRepositories(repos);
    
    // Language Distribution
    content += generateLanguageDistribution(repos);
    
    // Timeline Analysis
    content += generateTimelineAnalysis(repos);
    
    // Full Repository List
    content += generateFullList(repos);
    
    // Recommendations and Footer
    content += generateRecommendationsAndFooter(searchStartYear, searchEndYear);
    
    return content;
}

function generateExecutiveSummary(repos: Repository[], startYear: number, endYear: number): string {
    return `## 📈 Executive Summary\n\n` +
           `This report catalogs ${repos.length} historically significant repositories from the ${startYear}-${endYear} era. ` +
           `These repositories, while inactive, represent important milestones in open source development and contain valuable insights into programming practices of their time.\n\n`;
}

function generateQuickStats(repos: Repository[], startYear: number, endYear: number): string {
    const languages = [...new Set(repos.map(r => r.language || 'Unknown'))].sort();
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const avgStars = (totalStars / repos.length).toFixed(1);
    const topLanguage = [...languages].sort((a, b) => 
        repos.filter(r => r.language === b).length - 
        repos.filter(r => r.language === a).length
    )[0];
    
    let content = "## 📊 Quick Stats\n\n";
    content += "<details><summary>Click to expand stats</summary>\n\n";
    content += "| Metric | Value |\n";
    content += "|--------|-------|\n";
    content += `| Total Repositories | ${repos.length.toLocaleString()} |\n`;
    content += `| Total Stars | ${totalStars.toLocaleString()} |\n`;
    content += `| Average Stars | ${avgStars} |\n`;
    content += `| Languages Found | ${languages.length} |\n`;
    content += `| Most Used Language | ${topLanguage} |\n`;
    content += `| Search Period | ${startYear} - ${endYear} |\n`;
    content += `| Minimum Stars | ${DEFAULT_OPTIONS.minStars} |\n`;
    content += "</details>\n\n";
    return content;
}

function generateTopRepositories(repos: Repository[]): string {
    let content = "## 🏆 Top 10 Most Popular Repositories\n\n";
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
    return content;
}

function generateLanguageDistribution(repos: Repository[]): string {
    const langStats = new Map<string, number>();
    repos.forEach(repo => {
        const lang = repo.language || 'Unknown';
        langStats.set(lang, (langStats.get(lang) || 0) + 1);
    });
    
    let content = "## 👨‍💻 Language Distribution\n\n";
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
    return content;
}

function generateTimelineAnalysis(repos: Repository[]): string {
    const yearStats = new Map<number, number>();
    repos.forEach(repo => {
        const year = new Date(repo.pushed_at).getFullYear();
        yearStats.set(year, (yearStats.get(year) || 0) + 1);
    });

    let content = "## 📅 Timeline Analysis\n\n";
    content += "Last update distribution by year:\n\n";
    content += "```\n";
    [...yearStats.entries()]
        .sort((a, b) => a[0] - b[0])
        .forEach(([year, count]) => {
            const bar = '█'.repeat(Math.round(count / repos.length * 50));
            content += `${year} | ${bar} ${count}\n`;
        });
    content += "```\n\n";
    return content;
}

function generateFullList(repos: Repository[]): string {
    let content = "## 📚 Complete Repository List\n\n";
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
    return content;
}

function generateRecommendationsAndFooter(startYear: number, endYear: number): string {
    let content = "## 💡 Recommendations\n\n";
    content += "Based on the analysis of these repositories:\n\n";
    content += "1. **Historical Value**: Many of these repositories showcase early implementations of important concepts\n";
    content += "2. **Learning Opportunities**: Study these codebases to understand evolution of coding practices\n";
    content += "3. **Potential for Revival**: Some projects might benefit from modernization\n";
    content += "4. **Documentation**: Consider archiving knowledge from these historical codebases\n\n";

    content += "## ℹ️ About This Report\n\n";
    content += "<details><summary>Click to see report metadata</summary>\n\n";
    content += "This report was automatically generated by [Old Repository Finder](https://github.com/your-username/old-repo-finder). ";
    content += "It searches for GitHub repositories that haven't been updated in a specified time period.\n\n";
    content += "**Report Metadata:**\n";
    content += "- Generated on: " + new Date().toUTCString() + "\n";
    content += "- Search Parameters:\n";
    content += `  - Year Range: ${startYear}-${endYear}\n`;
    content += `  - Minimum Stars: ${DEFAULT_OPTIONS.minStars}\n`;
    content += "</details>\n\n";
    
    content += "*Note: This data represents a snapshot of historical GitHub repositories. Some repositories might have been updated since this report was generated.*\n";
    return content;
}

export function generateComparisonMarkdown(comparison: ComparisonResult): string {
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