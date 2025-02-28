import { Options } from '../types';
import { EnvironmentConfig } from '../types/config.types';

export interface IParameterManager {
    initialize(args: string[]): Promise<void>;
    getOptions(): Options;
    getEnvironmentConfig(): EnvironmentConfig;
    updateOptions(options: Partial<Options>): void;
    updateEnvironmentConfig(config: Partial<EnvironmentConfig>): void;
    validate(): Promise<boolean>;
    printHelp(): void;
}