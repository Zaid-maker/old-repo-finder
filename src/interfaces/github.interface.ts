import { Repository } from '../types';

export interface IGitHubService {
    checkAccess(): Promise<void>;
    searchRepositories(query: string, page: number): Promise<Repository[]>;
    getRateLimit(): Promise<{
        remaining: number;
        reset: Date;
    }>;
}