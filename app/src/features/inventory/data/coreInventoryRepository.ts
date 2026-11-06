import {
  Inventory,
  InventoryError,
  ItemField as CoreItemField,
  type InventoryLike,
  type Item,
  type NewItem,
} from 'core-bridge';
import { databasePath } from '../../../platform/databasePath';
import {
  ItemNotFoundError,
  ItemValidationError,
  StorageError,
  type InventoryItem,
  type InventoryRepository,
  type ItemField,
  type NewInventoryItem,
} from './InventoryRepository';

const FIELDS: Record<CoreItemField, ItemField> = {
  [CoreItemField.Name]: 'name',
  [CoreItemField.Location]: 'location',
  [CoreItemField.Quantity]: 'quantity',
  [CoreItemField.ExpirationDate]: 'expirationDate',
};

/**
 * InventoryRepository backed by the Rust core. The database is opened on first use.
 * Validation errors become `ItemValidationError` and unknown ids `ItemNotFoundError`;
 * everything else (storage errors, a missing native module, panics) becomes
 * `StorageError`.
 */
export function createCoreInventoryRepository(
  getPath: () => string = databasePath,
): InventoryRepository {
  let inventory: InventoryLike | undefined;

  const run = <T>(operation: (db: InventoryLike) => T): Promise<T> => {
    try {
      inventory ??= Inventory.open(getPath());
      return Promise.resolve(operation(inventory));
    } catch (error) {
      return Promise.reject(toRepositoryError(error));
    }
  };

  return {
    listItems: query => run(db => db.listItems(query).map(toInventoryItem)),
    addItem: item =>
      run(db => toInventoryItem(db.addItem(toCoreNewItem(item)))),
    updateItem: (id, item) =>
      run(db =>
        toInventoryItem(db.updateItem(BigInt(id), toCoreNewItem(item))),
      ),
    deleteItem: id => run(db => db.deleteItem(BigInt(id))),
    listLocations: () => run(db => db.listLocations()),
  };
}

function toCoreNewItem(item: NewInventoryItem): NewItem {
  return {
    name: item.name,
    location: item.location,
    quantity: item.quantity,
    expirationDate: item.expirationDate ?? undefined,
  };
}

function toInventoryItem(item: Item): InventoryItem {
  return {
    id: item.id.toString(),
    name: item.name,
    location: item.location,
    quantity: item.quantity,
    expirationDate: item.expirationDate ?? null,
    createdDate: item.createdDate,
  };
}

function toRepositoryError(error: unknown): Error {
  if (InventoryError.Invalid.instanceOf(error)) {
    return new ItemValidationError(
      FIELDS[error.inner.field],
      error.inner.reason,
    );
  }
  if (InventoryError.NotFound.instanceOf(error)) {
    return new ItemNotFoundError(error.inner.id.toString());
  }
  if (InventoryError.Storage.instanceOf(error)) {
    return new StorageError(error.inner.reason);
  }
  return new StorageError(
    error instanceof Error ? error.message : String(error),
  );
}
