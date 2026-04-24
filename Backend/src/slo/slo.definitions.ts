export interface SloDefinition {
  name: string;
  description: string;
  /** Target ratio, e.g. 0.999 = 99.9% */
  target: number;
  /** Rolling window in milliseconds */
  windowMs: number;
}

/** SLO targets per endpoint category */
export const SLO_DEFINITIONS: SloDefinition[] = [
  {
    name: 'api_availability',
    description: 'Overall API availability (non-5xx responses)',
    target: 0.999,
    windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  {
    name: 'api_latency_p99',
    description: 'p99 latency under 500ms for all endpoints',
    target: 0.99,
    windowMs: 24 * 60 * 60 * 1000, // 1 day
  },
  {
    name: 'indexer_availability',
    description: 'Indexer lag under 100 ledgers',
    target: 0.995,
    windowMs: 24 * 60 * 60 * 1000,
  },
];
