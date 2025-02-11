import { debug, logError } from '../utils/helpers';

export class GitService {
    static async checkChanges(): Promise<boolean> {
        try {
            const gitStatus = Bun.spawn(["git", "status", "--porcelain"], {
                stdout: "pipe"
            });
            const stdout = await new Response(gitStatus.stdout).text();
            return stdout.trim().length > 0;
        } catch (error) {
            logError(error, 'Git status check');
            return false;
        }
    }

    static async commitAndPush(filePath: string, message: string): Promise<boolean> {
        try {
            debug('Checking for changes...');
            const hasChanges = await this.checkChanges();
            
            if (!hasChanges) {
                debug('No changes to commit');
                return false;
            }

            debug('Adding file to git...');
            const addProcess = Bun.spawn(["git", "add", filePath]);
            await addProcess.exited;

            debug('Creating commit...');
            const commitProcess = Bun.spawn(["git", "commit", "-m", message]);
            await commitProcess.exited;

            debug('Pushing changes...');
            const pushProcess = Bun.spawn(["git", "push"]);
            await pushProcess.exited;

            debug('Successfully pushed changes');
            return true;
        } catch (error) {
            logError(error, 'Git commit and push');
            return false;
        }
    }

    static async getCurrentBranch(): Promise<string> {
        try {
            const branchProcess = Bun.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
                stdout: "pipe"
            });
            const stdout = await new Response(branchProcess.stdout).text();
            return stdout.trim();
        } catch (error) {
            logError(error, 'Get current branch');
            return 'unknown';
        }
    }

    static async hasRemoteChanges(): Promise<boolean> {
        try {
            const fetchProcess = Bun.spawn(["git", "fetch"]);
            await fetchProcess.exited;

            const branch = await this.getCurrentBranch();
            const diffProcess = Bun.spawn(["git", "rev-list", "HEAD...origin/" + branch, "--count"], {
                stdout: "pipe"
            });
            const stdout = await new Response(diffProcess.stdout).text();
            return parseInt(stdout.trim()) > 0;
        } catch (error) {
            logError(error, 'Check remote changes');
            return false;
        }
    }

    static async pull(): Promise<boolean> {
        try {
            debug('Pulling latest changes...');
            const pullProcess = Bun.spawn(["git", "pull"]);
            await pullProcess.exited;
            return true;
        } catch (error) {
            logError(error, 'Git pull');
            return false;
        }
    }
}