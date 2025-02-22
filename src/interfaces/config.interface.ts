import { Options } from '../types';

export interface IConfigService {
    get githubToken(): string;
    get resultFile(): string;
    get historicalFile(): string;
    get cacheDuration(): number;
    get requestTimeout(): number;
    get options(): Options;
    updateOptions(options: Partial<Options>): void;
    loadEnvConfig(): void;
    validate(): boolean;
}