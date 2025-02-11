# Old Repository Finder 🕰️

A tool to find GitHub repositories that haven't been updated in over 10 years.

## Features

- 🔍 Finds inactive repositories over 10 years old
- ⭐ Filter by minimum stars
- 🚀 Concurrent API requests for faster results
- 📊 Progress indicators and detailed statistics
- 🔄 Automatic retry mechanism for API failures
- 📝 Markdown report generation
- ⏱️ Rate limit handling

## Prerequisites

- [Bun](https://bun.sh) runtime
- GitHub Personal Access Token

## Setup

1. Set your GitHub token:
```bash
export GITHUB_TOKEN=your_token_here
```

2. Install dependencies:
```bash
bun install
```

## Usage

Basic usage:
```bash
bun run index.ts
```

With options:
```bash
bun run index.ts --min-stars 100 --max-repos 500 --concurrency 5
```

### Options

- `--min-stars`: Minimum number of stars (default: 0)
- `--max-repos`: Maximum number of repositories to fetch (default: 1000)
- `--concurrency`: Number of concurrent API requests (default: 3)
- `--year-start`: Start year for repository search (default: 2008)
- `--year-end`: End year for repository search (default: 2013)
- `--auto-push`: Automatically commit and push changes to git repository

Example with year range:
```bash
bun run index.ts --min-stars 100 --year-start 2010 --year-end 2012
```

Example with auto-push:
```bash
bun run index.ts --min-stars 100 --year-start 2010 --year-end 2012 --auto-push
```

## Search Strategy

The tool now searches repositories year by year to work around GitHub's API limitation of 1000 results per search. This approach:
- Provides better distribution of results across different years
- Helps avoid hitting GitHub's search result limits
- Allows for more focused historical exploration

## Output

Results are saved to `old-repos.md` with the following information:
- Repository name and owner
- Programming language
- Star count
- Last update date
- Repository URL

A summary section includes:
- Total repositories found
- List of languages
- Generation date

## Git Integration

When using the `--auto-push` flag, the tool will:
1. Check for changes in the results file
2. Commit changes with a timestamped message
3. Push to the current branch
4. Skip if no changes are detected
