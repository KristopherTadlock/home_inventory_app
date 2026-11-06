import { guardRepository } from '../../src/features/inventory/data/guardRepository';
import {
  ItemNotFoundError,
  ItemValidationError,
  StorageError,
  type InventoryRepository,
} from '../../src/features/inventory/data/InventoryRepository';
import {
  InMemoryInventoryRepository,
  storageFailure,
} from '../support/InMemoryInventoryRepository';

const NEW_ITEM = {
  name: 'Milk',
  location: 'Fridge',
  quantity: 1,
  expirationDate: null,
};

describe('guardRepository', () => {
  let inner: InMemoryInventoryRepository;
  let onFatal: jest.Mock;

  beforeEach(() => {
    inner = new InMemoryInventoryRepository([{ name: 'Hammer' }]);
    onFatal = jest.fn();
  });

  it('passes results through when nothing fails', async () => {
    const repository = guardRepository(inner, onFatal);
    expect((await repository.listItems()).map(item => item.name)).toEqual([
      'Hammer',
    ]);
    expect(onFatal).not.toHaveBeenCalled();
  });

  const calls = {
    listItems: (repository: InventoryRepository) => repository.listItems(),
    addItem: (repository: InventoryRepository) => repository.addItem(NEW_ITEM),
    updateItem: (repository: InventoryRepository) =>
      repository.updateItem('1', NEW_ITEM),
    deleteItem: (repository: InventoryRepository) => repository.deleteItem('1'),
    listLocations: (repository: InventoryRepository) =>
      repository.listLocations(),
  };

  it.each(Object.keys(calls) as Array<keyof typeof calls>)(
    'reports a StorageError from %s and rethrows it',
    async method => {
      const error = storageFailure();
      inner.failWith[method] = error;
      const repository = guardRepository(inner, onFatal);
      await expect(calls[method](repository)).rejects.toBe(error);
      expect(onFatal).toHaveBeenCalledWith(error);
    },
  );

  it('passes updates and deletes through', async () => {
    const repository = guardRepository(inner, onFatal);
    await repository.updateItem('1', NEW_ITEM);
    expect(inner.items[0].name).toBe('Milk');
    await repository.deleteItem('1');
    expect(inner.items).toEqual([]);
  });

  it('treats unexpected errors as storage failures', async () => {
    inner.failWith.listItems = new TypeError('boom');
    const repository = guardRepository(inner, onFatal);
    await expect(repository.listItems()).rejects.toBeInstanceOf(StorageError);
    expect(onFatal.mock.calls[0][0]).toBeInstanceOf(StorageError);
    expect(onFatal.mock.calls[0][0].message).toBe('boom');
  });

  it('does not report a missing item', async () => {
    const repository = guardRepository(inner, onFatal);
    await expect(repository.deleteItem('42')).rejects.toBeInstanceOf(
      ItemNotFoundError,
    );
    await expect(repository.updateItem('42', NEW_ITEM)).rejects.toBeInstanceOf(
      ItemNotFoundError,
    );
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('does not report validation errors', async () => {
    const error = new ItemValidationError('name', 'Item is required');
    inner.failWith.addItem = error;
    const repository = guardRepository(inner, onFatal);
    await expect(repository.addItem(NEW_ITEM)).rejects.toBe(error);
    expect(onFatal).not.toHaveBeenCalled();
  });
});
