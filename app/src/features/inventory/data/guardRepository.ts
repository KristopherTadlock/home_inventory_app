import {
  ItemNotFoundError,
  ItemValidationError,
  StorageError,
  type InventoryRepository,
} from './InventoryRepository';

/**
 * Wraps a repository so that every failure other than a validation or not-found error is
 * reported to `onFatal` as a `StorageError` and then rethrown, so the caller stops.
 * Screens and hooks therefore need no storage error handling of their own.
 */
export function guardRepository(
  repository: InventoryRepository,
  onFatal: (error: StorageError) => void,
): InventoryRepository {
  const fail = (error: unknown): never => {
    if (
      error instanceof ItemValidationError ||
      error instanceof ItemNotFoundError
    ) {
      throw error;
    }
    const storageError =
      error instanceof StorageError
        ? error
        : new StorageError(
            error instanceof Error ? error.message : String(error),
          );
    onFatal(storageError);
    throw storageError;
  };

  return {
    listItems: query => repository.listItems(query).catch(fail),
    addItem: item => repository.addItem(item).catch(fail),
    updateItem: (id, item) => repository.updateItem(id, item).catch(fail),
    deleteItem: id => repository.deleteItem(id).catch(fail),
    listLocations: () => repository.listLocations().catch(fail),
  };
}
