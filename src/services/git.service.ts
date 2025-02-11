import { IGitService } from '../interfaces/git.interface';
import { ILogger } from '../interfaces/logger.interface';
import { ServiceContainer } from './service-container';
import { GitError } from '../utils/errors';

export class GitService implements IGitService {
    private readonly logger: ILogger;

    constructor() {
        this.logger = ServiceContainer.getInstance().get<ILogger>(ServiceContainer.TOKENS.Logger);
    }

    private async executeGitCommand(command: string[]): Promise<{ success: boolean; output: string }> {
        try {
            const process = Bun.spawn(command, {
                stdout: "pipe",
                stderr: "pipe"
            });

            const [stdout, stderr] = await Promise.all([
                new Response(process.stdout).text(),
                new Response(process.stderr).text()
            ]);

            const exitCode = await process.exited;

            if (exitCode !== 0) {
                throw new GitError(command.join(' '), stderr);
            }

            return { success: true, output: stdout.trim() };
        } catch (error) {
            if (error instanceof GitError) {
                throw error;
            }
            throw new GitError(command.join(' '), String(error));
        }
    }

    async checkChanges(): Promise<boolean> {
        try {
            const { output } = await this.executeGitCommand(["git", "status", "--porcelain"]);
            return output.length > 0;
        } catch (error) {
            this.logger.error('Failed to check git changes:', error);
            throw error;
        }
    }

    async commitAndPush(filePath: string, message: string): Promise<boolean> {
        try {
            this.logger.debug('Checking for changes...');
            const hasChanges = await this.checkChanges();
            
            if (!hasChanges) {
                this.logger.debug('No changes to commit');
                return false;
            }

            // Stage the file
            this.logger.debug(`Staging file: ${filePath}`);
            await this.executeGitCommand(["git", "add", filePath]);

            // Create commit
            this.logger.debug('Creating commit...');
            await this.executeGitCommand(["git", "commit", "-m", message]);

            // Check if we need to pull first
            if (await this.hasRemoteChanges()) {
                this.logger.debug('Remote changes detected, pulling first...');
                await this.pull();
            }

            // Push changes
            this.logger.debug('Pushing changes...');
            await this.executeGitCommand(["git", "push"]);

            this.logger.info('Successfully pushed changes');
            return true;
        } catch (error) {
            this.logger.error('Failed to commit and push:', error);
            throw error;
        }
    }

    async getCurrentBranch(): Promise<string> {
        try {
            const { output } = await this.executeGitCommand(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
            return output;
        } catch (error) {
            this.logger.error('Failed to get current branch:', error);
            throw error;
        }
    }

    async hasRemoteChanges(): Promise<boolean> {
        try {
            // Fetch latest changes
            await this.executeGitCommand(["git", "fetch"]);

            const branch = await this.getCurrentBranch();
            const { output } = await this.executeGitCommand(["git", "rev-list", "HEAD...origin/" + branch, "--count"]);
            
            return parseInt(output) > 0;
        } catch (error) {
            this.logger.error('Failed to check remote changes:', error);
            throw error;
        }
    }

    async pull(): Promise<boolean> {
        try {
            await this.executeGitCommand(["git", "pull"]);
            return true;
        } catch (error) {
            this.logger.error('Failed to pull changes:', error);
            throw error;
        }
    }

    async isGitRepo(): Promise<boolean> {
        try {
            await this.executeGitCommand(["git", "rev-parse", "--git-dir"]);
            return true;
        } catch {
            return false;
        }
    }
}