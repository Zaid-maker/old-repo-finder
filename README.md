# 🕰️ Old Repository Finder

A tool to discover and analyze historical GitHub repositories. Find gems from the early days of GitHub and track their changes over time.

## 🌟 Features

- Search for repositories within specific time periods
- Filter by minimum star count
- Track star count changes over time
- Generate detailed Markdown reports
- Language distribution analysis
- Concurrent API requests for better performance
- Built with Bun and TypeScript
- GitHub Actions automation

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- GitHub Personal Access Token (PAT)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/old-repo-finder.git
cd old-repo-finder
```

2. Install dependencies:
```bash
bun install
```

3. Set up your GitHub PAT:
```bash
export GH_PAT='your-github-pat'
```

### Usage

Basic usage:
```bash
bun run start
```

With options:
```bash
bun run start --min-stars 100 --year-start 2010 --year-end 2012 --auto-push
```

Development mode with debug logs:
```bash
bun run dev
```

Run daily update:
```bash
bun run daily
```

## 📁 Project Structure

```
src/
├── config/         # Configuration and constants
├── services/       # Core functionality modules
│   ├── data.ts    # Data persistence operations
│   ├── git.ts     # Git operations
│   ├── github.ts  # GitHub API interactions
│   └── markdown.ts # Report generation
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
│   ├── cli.ts     # CLI argument handling
│   └── index.ts   # Common utilities
└── index.ts       # Main entry point
```

## ⚙️ Configuration

Available command line options:

- `--min-stars <number>`: Minimum star count (default: 0)
- `--max-repos <number>`: Maximum repositories to fetch (default: 1000)
- `--concurrency <number>`: Number of concurrent requests (1-5, default: 3)
- `--year-start <number>`: Start year for search (≥ 2008)
- `--year-end <number>`: End year for search
- `--auto-push`: Automatically commit and push changes
- `--debug`: Enable debug mode

## 🔄 GitHub Actions

The repository includes a GitHub Actions workflow that:

1. Runs daily at midnight UTC
2. Searches for repositories matching criteria
3. Generates a new report
4. Commits and pushes changes automatically

To use the workflow:

1. Fork this repository
2. Add your `GH_PAT` to repository secrets
3. Enable GitHub Actions

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
