export type InfrastructureStatus = 'ready' | 'missing' | 'error';

export type InfrastructureCheck = {
  name: string;
  status: InfrastructureStatus;
  detail: string;
  latencyMs?: number;
};

export function measureDuration(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}
