import React, { createContext, useContext } from 'react';
import type { InventoryRepository } from './InventoryRepository';

const InventoryContext = createContext<InventoryRepository | null>(null);

export function InventoryProvider({
  repository,
  children,
}: {
  repository: InventoryRepository;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <InventoryContext.Provider value={repository}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventoryRepository(): InventoryRepository {
  const repository = useContext(InventoryContext);
  if (!repository) {
    throw new Error(
      'useInventoryRepository must be used inside InventoryProvider',
    );
  }
  return repository;
}
