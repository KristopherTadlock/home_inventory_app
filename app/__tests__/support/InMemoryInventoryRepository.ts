import {
  ItemNotFoundError,
  ItemValidationError,
  StorageError,
  type InventoryItem,
  type InventoryRepository,
  type ItemId,
  type NewInventoryItem,
} from '../../src/features/inventory/data/InventoryRepository';

type Method =
  | 'listItems'
  | 'addItem'
  | 'updateItem'
  | 'deleteItem'
  | 'listLocations';

/**
 * In-memory InventoryRepository with the core's search, ordering, normalisation and
 * validation semantics. `failWith` makes a method throw, to simulate storage failures.
 */
export class InMemoryInventoryRepository implements InventoryRepository {
  items: InventoryItem[] = [];
  failWith: Partial<Record<Method, Error>> = {};
  private nextId = 1;

  constructor(
    seed: Array<Partial<InventoryItem> & { name: string }> = [],
    private readonly clock: () => Date = () => new Date(),
  ) {
    for (const item of seed) {
      this.items.push({
        id: String(this.nextId++),
        location: 'Kitchen',
        quantity: 1,
        expirationDate: null,
        createdDate: this.clock().toISOString(),
        ...item,
      });
    }
  }

  async listItems(query?: string): Promise<InventoryItem[]> {
    this.maybeFail('listItems');
    const needle = query?.trim().toLowerCase() ?? '';
    return this.items
      .filter(item => item.name.toLowerCase().includes(needle))
      .sort(compareItems);
  }

  async addItem(item: NewInventoryItem): Promise<InventoryItem> {
    this.maybeFail('addItem');
    const stored: InventoryItem = {
      id: String(this.nextId++),
      ...this.validate(item, null),
      createdDate: this.clock().toISOString(),
    };
    this.items.push(stored);
    return stored;
  }

  async updateItem(id: ItemId, item: NewInventoryItem): Promise<InventoryItem> {
    this.maybeFail('updateItem');
    const fields = this.validate(item, id);
    const index = this.indexOf(id);
    this.items[index] = { ...this.items[index], ...fields };
    return this.items[index];
  }

  async deleteItem(id: ItemId): Promise<void> {
    this.maybeFail('deleteItem');
    this.items.splice(this.indexOf(id), 1);
  }

  async listLocations(): Promise<string[]> {
    this.maybeFail('listLocations');
    return [...new Set(this.items.map(item => item.location))].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    );
  }

  /** Validates and normalises as the core does; `self` is the edited item's id, whose own
   * location spelling is not reused. */
  private validate(item: NewInventoryItem, self: ItemId | null) {
    const name = item.name.trim();
    const location = item.location.trim();
    if (!name) {
      throw new ItemValidationError('name', 'Item is required');
    }
    if (!location) {
      throw new ItemValidationError('location', 'Location is required');
    }
    if (item.quantity < 1) {
      throw new ItemValidationError('quantity', 'Quantity must be at least 1');
    }
    const existing = this.items.find(
      other =>
        other.id !== self &&
        other.location.toLowerCase() === location.toLowerCase(),
    );
    return {
      name,
      location: existing?.location ?? location,
      quantity: item.quantity,
      expirationDate: item.expirationDate,
    };
  }

  private indexOf(id: ItemId): number {
    const index = this.items.findIndex(item => item.id === id);
    if (index === -1) {
      throw new ItemNotFoundError(id);
    }
    return index;
  }

  private maybeFail(method: Method): void {
    const error = this.failWith[method];
    if (error) {
      throw error;
    }
  }
}

export const storageFailure = () => new StorageError('disk I/O error');

function compareItems(a: InventoryItem, b: InventoryItem): number {
  if (a.expirationDate !== b.expirationDate) {
    if (a.expirationDate === null) {
      return 1;
    }
    if (b.expirationDate === null) {
      return -1;
    }
    return a.expirationDate < b.expirationDate ? -1 : 1;
  }
  return (
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
    Number(a.id) - Number(b.id)
  );
}
