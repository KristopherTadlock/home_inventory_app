import { useSyncExternalStore } from 'react';

/**
 * The first fatal (storage) error, if any. Kept outside React so non-React code can raise
 * it; App reads it with `useFatalError` and replaces the UI with the error screen.
 */
let fatalError: Error | null = null;
const listeners = new Set<() => void>();

export function raiseFatalError(error: Error): void {
  if (fatalError) {
    return;
  }
  fatalError = error;
  // Reaches logcat. Storage messages describe the failure, never item contents.
  console.error('storage failure', error.message);
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getFatalError(): Error | null {
  return fatalError;
}

export function useFatalError(): Error | null {
  return useSyncExternalStore(subscribe, getFatalError);
}

/** Test-only: clears the recorded error between tests. */
export function resetFatalErrorForTests(): void {
  fatalError = null;
}
