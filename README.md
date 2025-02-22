# Old Repository Finder 🕰️

A powerful tool to discover and analyze historical GitHub repositories.

> [!INFO]
> this is made possible with the help of AI. 

## Features

- 🔍 Find repositories from specific time periods
- ⭐ Filter by minimum stars
- 📊 Generate detailed markdown reports
- 📈 Track changes between runs
- 🚀 Concurrent API requests
- 💾 Smart caching
- 🔄 Automatic retries
- ⏱️ Request timeout handling
- 📝 Git integration
- 🐛 Debug mode

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

Advanced usage:
```bash
bun run index.ts --min-stars 100 --year-start 2010 --year-end 2012 --concurrency 3 --auto-push --debug
```

### Command Line Options

- `--min-stars <number>`: Minimum number of stars (default: 0)
- `--max-repos <number>`: Maximum number of repositories to fetch (default: 1000)
- `--concurrency <number>`: Number of concurrent requests (1-5, default: 3)
- `--year-start <number>`: Start year for search (≥ 2008, default: 2008)
- `--year-end <number>`: End year for search (default: 2013)
- `--auto-push`: Automatically commit and push changes
- `--debug`: Enable debug mode for detailed logging
- `--help`: Show help message

## Output

The script generates two main files:
1. `old-repos.md`: Comprehensive report with:
   - Executive summary
   - Quick stats
   - Language distribution
   - Top repositories
   - Complete repository list
   - Changes since last run (if available)

2. `historical-data.json`: Historical tracking data containing:
   - Previous run statistics
   - Repository changes
   - Star count changes

### Report Features

- 📊 Statistical analysis
- 📈 Visual progress bars
- 📉 Language distribution charts
- 🔄 Change tracking between runs
- ⭐ Star count changes
- 📋 Repository metrics

## Cache

- Cached data expires after 1 hour
- Reduces API calls for frequently accessed data
- Automatically handles cache invalidation

## Error Handling

- 🔄 Automatic retries with exponential backoff
- ⏱️ Request timeout protection (30s default)
- 📝 Detailed error logging in debug mode
- 🚦 Rate limit handling with automatic pausing

## Debug Mode

When running with `--debug`, you get:
- Detailed API request/response logs
- Cache operation logs
- Error stack traces
- Performance metrics
- Rate limit information

## Git Integration

With `--auto-push`:
1. Automatically stages changes
2. Creates a commit with timestamp
3. Pushes to current branch
4. Includes changes summary in commit message

## Best Practices

1. Use `--concurrency` based on your rate limit
2. Enable `--debug` when troubleshooting
3. Start with small date ranges first
4. Use caching for repeated searches
5. Check historical comparisons for trends

## Rate Limiting

The tool automatically handles GitHub API rate limits by:
- Monitoring remaining requests
- Waiting for reset when needed
- Displaying rate limit status
- Caching to reduce API calls

## Error Recovery

- Continues partial results on non-fatal errors
- Saves progress before exiting
- Maintains data integrity
- Provides detailed error context

## Contributing

Feel free to open issues or submit pull requests!
