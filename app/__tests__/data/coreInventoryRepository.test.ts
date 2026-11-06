import { Inventory, InventoryError, ItemField } from 'core-bridge';
import { createCoreInventoryRepository } from '../../src/features/inventory/data/coreInventoryRepository';
import {
  ItemNotFoundError,
  ItemValidationError,
  StorageError,
} from '../../src/features/inventory/data/InventoryRepository';

jest.mock('../../src/platform/NativeAppHost', () => ({
  __esModule: true,
  default: { getConstants: () => ({ databaseDir: '/db' }), exitApp: jest.fn() },
}));

// Mimics the shape of the uniffi-generated bindings.
jest.mock('core-bridge', () => {
  const makeError = (tag: string) =>
    class extends Error {
      static instanceOf(obj: unknown) {
        return (obj as { tag?: string })?.tag === tag;
      }
      tag = tag;
      inner: Record<string, unknown>;
      constructor(fields: Record<string, unknown>) {
        super(tag);
        this.inner = fields;
      }
    };
  return {
    Inventory: { open: jest.fn() },
    InventoryError: {
      Invalid: makeError('Invalid'),
      NotFound: makeError('NotFound'),
      Storage: makeError('Storage'),
    },
    ItemField: { Name: 0, Location: 1, Quantity: 2, ExpirationDate: 3 },
  };
});

const openMock = Inventory.open as jest.Mock;

const coreItem = {
  id: 9007199254740993n, // beyond Number.MAX_SAFE_INTEGER
  name: 'Milk',
  location: 'Fridge',
  quantity: 2,
  expirationDate: undefined,
  createdDate: '2026-11-05T10:00:00.000Z',
};

function fakeInventory() {
  return {
    listItems: jest.fn(() => [coreItem]),
    addItem: jest.fn(() => ({ ...coreItem, expirationDate: '2027-10-27' })),
    updateItem: jest.fn(() => ({ ...coreItem, name: 'Oat milk' })),
    deleteItem: jest.fn(),
    listLocations: jest.fn(() => ['Fridge']),
    setItemQuantity: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createCoreInventoryRepository', () => {
  it('opens the database once, at the platform path, on first use', async () => {
    const inventory = fakeInventory();
    openMock.mockReturnValue(inventory);
    const repository = createCoreInventoryRepository();
    expect(openMock).not.toHaveBeenCalled();

    await repository.listItems('mil');
    await repository.listLocations();

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith('/db/inventory.sqlite3');
    expect(inventory.listItems).toHaveBeenCalledWith('mil');
  });

  it('maps core records to UI items', async () => {
    openMock.mockReturnValue(fakeInventory());
    const repository = createCoreInventoryRepository();

    expect(await repository.listItems()).toEqual([
      {
        id: '9007199254740993',
        name: 'Milk',
        location: 'Fridge',
        quantity: 2,
        expirationDate: null,
        createdDate: '2026-11-05T10:00:00.000Z',
      },
    ]);
  });

  it('passes a null expiration to the core as undefined', async () => {
    const inventory = fakeInventory();
    openMock.mockReturnValue(inventory);
    const repository = createCoreInventoryRepository();

    const stored = await repository.addItem({
      name: 'Milk',
      location: 'Fridge',
      quantity: 2,
      expirationDate: null,
    });

    expect(inventory.addItem).toHaveBeenCalledWith({
      name: 'Milk',
      location: 'Fridge',
      quantity: 2,
      expirationDate: undefined,
    });
    expect(stored.expirationDate).toBe('2027-10-27');
  });

  it('passes 64-bit ids to the core exactly when updating and deleting', async () => {
    const inventory = fakeInventory();
    openMock.mockReturnValue(inventory);
    const repository = createCoreInventoryRepository();

    const updated = await repository.updateItem('9007199254740993', {
      name: 'Oat milk',
      location: 'Fridge',
      quantity: 2,
      expirationDate: null,
    });
    await repository.deleteItem('9007199254740993');

    expect(inventory.updateItem).toHaveBeenCalledWith(9007199254740993n, {
      name: 'Oat milk',
      location: 'Fridge',
      quantity: 2,
      expirationDate: undefined,
    });
    expect(updated).toMatchObject({ id: '9007199254740993', name: 'Oat milk' });
    expect(inventory.deleteItem).toHaveBeenCalledWith(9007199254740993n);
  });

  it('maps a core NotFound to ItemNotFoundError', async () => {
    const inventory = fakeInventory();
    inventory.deleteItem.mockImplementation(() => {
      throw new InventoryError.NotFound({ id: 42n });
    });
    openMock.mockReturnValue(inventory);
    const repository = createCoreInventoryRepository();

    const error = await repository.deleteItem('42').catch(e => e);
    expect(error).toBeInstanceOf(ItemNotFoundError);
    expect(error.id).toBe('42');
  });

  it('maps core validation errors to ItemValidationError on the right field', async () => {
    const inventory = fakeInventory();
    inventory.addItem.mockImplementation(() => {
      throw new InventoryError.Invalid({
        field: ItemField.Quantity,
        reason: 'Quantity must be at least 1',
      });
    });
    openMock.mockReturnValue(inventory);
    const repository = createCoreInventoryRepository();

    const error = await repository
      .addItem({ name: 'x', location: 'y', quantity: 0, expirationDate: null })
      .catch(e => e);
    expect(error).toBeInstanceOf(ItemValidationError);
    expect(error.field).toBe('quantity');
    expect(error.message).toBe('Quantity must be at least 1');
  });

  it('maps storage errors, open failures and anything unexpected to StorageError', async () => {
    const inventory = fakeInventory();
    inventory.listItems.mockImplementation(() => {
      throw new InventoryError.Storage({ reason: 'disk I/O error' });
    });
    inventory.listLocations.mockImplementation(() => {
      throw new Error('Rust panic');
    });
    openMock.mockReturnValue(inventory);
    const repository = createCoreInventoryRepository();

    await expect(repository.listItems()).rejects.toEqual(
      new StorageError('disk I/O error'),
    );
    await expect(repository.listLocations()).rejects.toEqual(
      new StorageError('Rust panic'),
    );

    openMock.mockImplementation(() => {
      throw new InventoryError.Storage({ reason: 'unable to open database' });
    });
    const unopenable = createCoreInventoryRepository();
    const error = await unopenable.listItems().catch(e => e);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toBe('unable to open database');
  });

  it('reports a missing host module as a storage failure', async () => {
    const repository = createCoreInventoryRepository(() => {
      throw new Error('AppHost native module is not available');
    });
    await expect(repository.listItems()).rejects.toBeInstanceOf(StorageError);
  });
});
