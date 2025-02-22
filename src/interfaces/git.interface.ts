export interface IGitService {
    checkChanges(): Promise<boolean>;
    commitAndPush(filePath: string, message: string): Promise<boolean>;
    getCurrentBranch(): Promise<string>;
    hasRemoteChanges(): Promise<boolean>;
    pull(): Promise<boolean>;
    isGitRepo(): Promise<boolean>;
}