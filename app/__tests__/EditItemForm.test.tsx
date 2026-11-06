import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { resetFatalErrorForTests } from '../src/errors/fatalError';
import { ItemValidationError } from '../src/features/inventory/data/InventoryRepository';
import { InMemoryInventoryRepository } from './support/InMemoryInventoryRepository';
import { renderApp } from './support/renderApp';

beforeEach(resetFatalErrorForTests);

function seeded() {
  return new InMemoryInventoryRepository([
    {
      name: 'Milk 1 gallon',
      location: 'Fridge',
      quantity: 2,
      expirationDate: '2027-10-27',
      createdDate: '2025-03-02T18:00:00.000Z',
    },
    { name: 'Hammer', location: 'Garage' },
  ]);
}

/** Opens the edit view for the seeded milk (id 1). */
async function openMilk(repository = seeded()) {
  const result = await renderApp(repository);
  await fireEvent.press(screen.getByTestId('item-row-1'));
  await screen.findByText('Edit item');
  return result;
}

const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);

const sheetClosed = () =>
  waitFor(() => expect(screen.queryByTestId('item-name-input')).toBeNull());

describe('edit view', () => {
  it('opens when an item is pressed, filled in with that item', async () => {
    await openMilk();

    expect(screen.getByTestId('item-name-input').props.value).toBe(
      'Milk 1 gallon',
    );
    expect(screen.getByTestId('item-location-input').props.value).toBe(
      'Fridge',
    );
    expect(screen.getByTestId('quantity-input').props.value).toBe('2');
    expect(screen.getByTestId('expiration-input')).toHaveTextContent(
      'Wed, Oct 27, 2027',
    );
    expect(screen.getByTestId('save-item-button')).toBeEnabled();
    expect(screen.getByTestId('delete-item-button')).toBeOnTheScreen();
  });

  it('labels rows as buttons that open the item', async () => {
    await renderApp(seeded());
    const row = screen.getByTestId('item-row-2');
    expect(row).toHaveProp('accessibilityRole', 'button');
    expect(row).toHaveProp(
      'accessibilityHint',
      'Opens the item to edit or delete it',
    );
  });

  it('is not offered when adding an item', async () => {
    await renderApp(seeded());
    await fireEvent.press(screen.getByTestId('add-item-button'));
    expect(await screen.findByText('Add item')).toBeOnTheScreen();
    expect(screen.queryByTestId('delete-item-button')).toBeNull();
  });

  it('saves changes to the item, keeping its created date', async () => {
    const { repository } = await openMilk();
    const updateItem = jest.spyOn(repository, 'updateItem');

    await type('item-name-input', ' Oat milk ');
    await fireEvent.press(screen.getByTestId('location-chip-Garage'));
    await fireEvent.press(screen.getByTestId('quantity-increment'));
    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(updateItem).toHaveBeenCalledWith('1', {
      name: 'Oat milk',
      location: 'Garage',
      quantity: 3,
      expirationDate: '2027-10-27',
    });
    await sheetClosed();
    expect(await screen.findByText('Oat milk')).toBeOnTheScreen();
    expect(screen.queryByText('Milk 1 gallon')).toBeNull();
    expect(screen.getByText('×3')).toBeOnTheScreen();
    expect(screen.getByText('Added Mar 2, 2025')).toBeOnTheScreen();
    expect(repository.items).toHaveLength(2);
  });

  it('can remove the expiration date', async () => {
    const { repository } = await openMilk();

    await fireEvent.press(screen.getByTestId('clear-expiration'));
    await fireEvent.press(screen.getByTestId('save-item-button'));

    await sheetClosed();
    expect(repository.items[0].expirationDate).toBeNull();
    expect(screen.queryByText('Expires Oct 27, 2027')).toBeNull();
  });

  it('does not save an invalid item', async () => {
    const { repository } = await openMilk();
    const updateItem = jest.spyOn(repository, 'updateItem');

    await type('item-name-input', '   ');
    expect(screen.getByTestId('save-item-button')).toBeDisabled();
    await fireEvent(screen.getByTestId('item-name-input'), 'blur');

    expect(screen.getByText('Item is required')).toBeOnTheScreen();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('keeps the quantity at least 1, since deleting is a separate action', async () => {
    await openMilk();
    await fireEvent.press(screen.getByTestId('quantity-decrement'));
    expect(screen.getByTestId('quantity-input').props.value).toBe('1');
    expect(screen.getByTestId('quantity-decrement')).toBeDisabled();
  });

  it('shows a validation error from the core on its field', async () => {
    const repository = seeded();
    repository.failWith.updateItem = new ItemValidationError(
      'name',
      'Item is not allowed',
    );
    await openMilk(repository);

    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(await screen.findByText('Item is not allowed')).toBeOnTheScreen();
    expect(screen.getByText('Edit item')).toBeOnTheScreen();
    expect(screen.queryByTestId('fatal-error-screen')).toBeNull();
  });

  it('cancel discards the changes', async () => {
    const { repository } = await openMilk();

    await type('item-name-input', 'Oat milk');
    await fireEvent.press(screen.getByTestId('cancel-item-button'));

    expect(screen.queryByTestId('item-name-input')).toBeNull();
    expect(repository.items[0].name).toBe('Milk 1 gallon');
    expect(screen.getByText('Milk 1 gallon')).toBeOnTheScreen();
  });

  it('opens each item fresh, without edits left over from the last one', async () => {
    await openMilk();
    await type('item-name-input', 'Oat milk');
    await fireEvent.press(screen.getByTestId('cancel-item-button'));

    await fireEvent.press(screen.getByTestId('item-row-2'));

    expect((await screen.findByTestId('item-name-input')).props.value).toBe(
      'Hammer',
    );
  });

  it('clears a search that would hide the edited item', async () => {
    await renderApp(seeded());
    await type('search-input', 'milk');
    await fireEvent.press(await screen.findByTestId('item-row-1'));
    await type('item-name-input', 'Cream');
    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(await screen.findByText('Cream')).toBeOnTheScreen();
    expect(screen.getByTestId('search-input').props.value).toBe('');
    expect(screen.getByText('Hammer')).toBeOnTheScreen();
  });

  describe('delete', () => {
    it('asks for confirmation, naming the item as stored', async () => {
      const { repository } = await openMilk();
      const deleteItem = jest.spyOn(repository, 'deleteItem');

      await type('item-name-input', 'Renamed but not saved');
      await fireEvent.press(screen.getByTestId('delete-item-button'));

      expect(screen.getByTestId('delete-confirmation')).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Delete “Milk 1 gallon” from your inventory? This can't be undone.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByTestId('save-item-button')).toBeNull();
      expect(deleteItem).not.toHaveBeenCalled();
    });

    it('Keep returns to the form without deleting', async () => {
      const { repository } = await openMilk();

      await fireEvent.press(screen.getByTestId('delete-item-button'));
      await fireEvent.press(screen.getByTestId('cancel-delete-button'));

      expect(screen.queryByTestId('delete-confirmation')).toBeNull();
      expect(screen.getByTestId('save-item-button')).toBeOnTheScreen();
      expect(repository.items).toHaveLength(2);
    });

    it('deletes the item, closes the view and removes it from the list', async () => {
      const { repository } = await openMilk();
      const deleteItem = jest.spyOn(repository, 'deleteItem');

      await fireEvent.press(screen.getByTestId('delete-item-button'));
      await fireEvent.press(screen.getByTestId('confirm-delete-button'));

      expect(deleteItem).toHaveBeenCalledWith('1');
      await sheetClosed();
      await waitFor(() =>
        expect(screen.queryByText('Milk 1 gallon')).toBeNull(),
      );
      expect(screen.getByText('Hammer')).toBeOnTheScreen();
      expect(repository.items.map(item => item.name)).toEqual(['Hammer']);
    });

    it('shows the empty state after deleting the last item', async () => {
      await renderApp(new InMemoryInventoryRepository([{ name: 'Hammer' }]));
      await fireEvent.press(screen.getByTestId('item-row-1'));
      await fireEvent.press(await screen.findByTestId('delete-item-button'));
      await fireEvent.press(screen.getByTestId('confirm-delete-button'));

      expect(
        await screen.findByText(
          'Your inventory is empty. Tap + to add an item.',
        ),
      ).toBeOnTheScreen();
    });
  });

  describe('when the item no longer exists', () => {
    it('closes and refreshes the list instead of saving', async () => {
      const { repository } = await openMilk();
      repository.items.splice(0, 1); // deleted elsewhere while the view was open

      await type('item-name-input', 'Oat milk');
      await fireEvent.press(screen.getByTestId('save-item-button'));

      await sheetClosed();
      await waitFor(() =>
        expect(screen.queryByText('Milk 1 gallon')).toBeNull(),
      );
      expect(screen.queryByText('Oat milk')).toBeNull();
      expect(screen.queryByTestId('fatal-error-screen')).toBeNull();
    });

    it('closes and refreshes the list instead of deleting', async () => {
      const { repository } = await openMilk();
      repository.items.splice(0, 1);

      await fireEvent.press(screen.getByTestId('delete-item-button'));
      await fireEvent.press(screen.getByTestId('confirm-delete-button'));

      await sheetClosed();
      await waitFor(() =>
        expect(screen.queryByText('Milk 1 gallon')).toBeNull(),
      );
      expect(screen.queryByTestId('fatal-error-screen')).toBeNull();
    });
  });
});
