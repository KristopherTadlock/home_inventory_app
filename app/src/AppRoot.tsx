import React, { useMemo } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FatalErrorScreen } from './errors/FatalErrorScreen';
import { raiseFatalError, useFatalError } from './errors/fatalError';
import { InventoryScreen } from './features/inventory/InventoryScreen';
import { InventoryProvider } from './features/inventory/data/InventoryContext';
import type { InventoryRepository } from './features/inventory/data/InventoryRepository';
import { guardRepository } from './features/inventory/data/guardRepository';

/**
 * The app with its dependencies injected, so it can run on any platform or in tests: any
 * storage failure from `repository` replaces the UI with the error screen, whose button
 * calls `onExit`.
 */
export function AppRoot({
  repository,
  onExit,
}: {
  repository: InventoryRepository;
  onExit: () => void;
}): React.JSX.Element {
  const guarded = useMemo(
    () => guardRepository(repository, raiseFatalError),
    [repository],
  );
  const fatalError = useFatalError();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {fatalError ? (
        <FatalErrorScreen onClose={onExit} />
      ) : (
        <InventoryProvider repository={guarded}>
          <InventoryScreen />
        </InventoryProvider>
      )}
    </SafeAreaProvider>
  );
}
