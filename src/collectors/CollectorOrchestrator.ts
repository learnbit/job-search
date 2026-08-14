import type { CollectedJob, JobCollector } from "./types.js";

type ErrorLogger = Pick<Console, "error">;

export interface ConfiguredCollector {
  readonly source: string;

  run(): Promise<CollectedJob[]>;
}

export function configureCollector<TConfig>(
  collector: JobCollector<TConfig>,
  config: TConfig,
): ConfiguredCollector {
  return {
    source: collector.source,
    run: () => collector.collect(config),
  };
}

export class CollectorOrchestrator {
  constructor(
    private readonly collectors: readonly ConfiguredCollector[],
    private readonly logger: ErrorLogger = console,
  ) {}

  async collectAll(): Promise<CollectedJob[]> {
    const results = await Promise.all(
      this.collectors.map(async (collector) => {
        try {
          return await collector.run();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[orchestrator] Collector "${collector.source}" failed: ${message}`,
          );
          return [];
        }
      }),
    );

    return results.flat();
  }
}
