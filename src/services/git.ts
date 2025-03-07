import { CONSTANTS } from '../config';
import { debug } from '../utils';

export async function commitAndPush(): Promise<void> {
    const gitStatus = Bun.spawn(["git", "status", "--porcelain"], {
        stdout: "pipe"
    });
    const stdout = await new Response(gitStatus.stdout).text();
    
    if (!stdout.trim()) {
        console.log("📝 No changes to commit");
        return;
    }

    try {
        console.log("🔄 Committing and pushing changes...");
        
        // Add both files
        const addProcess = Bun.spawn(["git", "add", CONSTANTS.RESULT_FILE, CONSTANTS.HISTORICAL_FILE]);
        await addProcess.exited;

        // Create commit with timestamp
        const date = new Date().toISOString().split('T')[0];
        const commitMsg = `Update repository data (${date})`;
        const commitProcess = Bun.spawn(["git", "commit", "-m", commitMsg]);
        await commitProcess.exited;

        // Push changes
        const pushProcess = Bun.spawn(["git", "push"]);
        await pushProcess.exited;

        console.log("✅ Successfully pushed changes to repository");
    } catch (error) {
        console.error("❌ Failed to push changes:", error instanceof Error ? error.message : error);
        // Don't exit, as we still want to keep the generated file
    }
}