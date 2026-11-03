export interface SessionRequest {
  signal: AbortSignal;
  isCurrent(): boolean;
  finish(): void;
}

export interface SessionGuard {
  transition(token: string | null): void;
  begin(): SessionRequest;
}

export function createSessionGuard(): SessionGuard;
