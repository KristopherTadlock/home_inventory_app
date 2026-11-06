import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { resetFatalErrorForTests } from '../src/errors/fatalError';
import type { InventoryItem } from '../src/features/inventory/data/InventoryRepository';
import { todayIso } from '../src/features/inventory/domain/dates';
import { InMemoryInventoryRepository } from './support/InMemoryInventoryRepository';
import { renderApp } from './support/renderApp';

function seeded() {
  return new InMemoryInventoryRepository([
    { name: 'Hammer', location: 'Garage' },
    {
      name: 'Milk 1 gallon',
      location: 'Fridge',
      quantity: 2,
      expirationDate: '2027-10-27',
    },
    { name: 'Almond milk', location: 'Pantry' },
  ]);
}

beforeEach(resetFatalErrorForTests);

describe('InventoryScreen', () => {
  it('lists items with quantity, location, expiration and created date', async () => {
    await renderApp(seeded());

    expect(screen.getByText('Milk 1 gallon')).toBeOnTheScreen();
    expect(screen.getByText('×2')).toBeOnTheScreen();
    expect(screen.getByText('Expires Oct 27, 2027')).toBeOnTheScreen();
    expect(screen.getByText('Hammer')).toBeOnTheScreen();
    expect(screen.getByText('Garage')).toBeOnTheScreen();
    expect(screen.getAllByText('Added today')).toHaveLength(3);
  });

  it('gives each row a full accessibility label', async () => {
    await renderApp(seeded());
    expect(screen.getByTestId('item-row-2')).toHaveAccessibleName(
      `Milk 1 gallon, quantity 2, Fridge, Expires October 27, 2027, Added ${new Date().toLocaleDateString(
        'en-US',
        { month: 'long', day: 'numeric', year: 'numeric' },
      )}`,
    );
  });

  it('orders items by expiration, then name', async () => {
    await renderApp(seeded());
    const rows = screen.getAllByTestId(/^item-row-/);
    expect(rows.map(row => row.props.testID)).toEqual([
      'item-row-2', // Milk 1 gallon (expires)
      'item-row-3', // Almond milk
      'item-row-1', // Hammer
    ]);
  });

  it('flags expired items', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await renderApp(
      new InMemoryInventoryRepository([
        { name: 'Yogurt', expirationDate: todayIso(yesterday) },
      ]),
    );
    expect(screen.getByText(/^Expired /)).toBeOnTheScreen();
  });

  it('shows an empty state when the inventory is empty', async () => {
    await renderApp();
    expect(
      screen.getByText('Your inventory is empty. Tap + to add an item.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Built with Llama')).toBeOnTheScreen();
  });

  it('filters by partial, case-insensitive item name', async () => {
    const { repository } = await renderApp(seeded());
    const listItems = jest.spyOn(repository, 'listItems');

    await fireEvent.changeText(screen.getByTestId('search-input'), 'MIL');

    await waitFor(() => expect(screen.queryByText('Hammer')).toBeNull());
    expect(listItems).toHaveBeenLastCalledWith('MIL');
    expect(screen.getByText('Milk 1 gallon')).toBeOnTheScreen();
    expect(screen.getByText('Almond milk')).toBeOnTheScreen();
  });

  it('shows a no-match message and clears the search', async () => {
    await renderApp(seeded());

    await fireEvent.changeText(screen.getByTestId('search-input'), 'bread');
    expect(
      await screen.findByText('No items match “bread”.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Clear search'));
    expect(await screen.findByText('Hammer')).toBeOnTheScreen();
    expect(screen.getByTestId('search-input').props.value).toBe('');
  });

  it('ignores results for an older search that arrive late', async () => {
    const { repository } = await renderApp(seeded());
    const pending = new Map<string, (items: InventoryItem[]) => void>();
    jest
      .spyOn(repository, 'listItems')
      .mockImplementation(
        query => new Promise(resolve => pending.set(query ?? '', resolve)),
      );
    const item = (name: string): InventoryItem => ({
      id: name,
      name,
      location: 'Pantry',
      quantity: 1,
      expirationDate: null,
      createdDate: new Date().toISOString(),
    });

    await fireEvent.changeText(screen.getByTestId('search-input'), 'a');
    await waitFor(() => expect(pending.has('a')).toBe(true));
    await fireEvent.changeText(screen.getByTestId('search-input'), 'b');
    await waitFor(() => expect(pending.has('b')).toBe(true));

    await act(async () => pending.get('b')!([item('Bread')]));
    await act(async () => pending.get('a')!([item('Apple')]));

    expect(screen.getByText('Bread')).toBeOnTheScreen();
    expect(screen.queryByText('Apple')).toBeNull();
  });

  it('accepts chat text without doing anything with it', async () => {
    const { repository } = await renderApp(seeded());
    const addItem = jest.spyOn(repository, 'addItem');
    const listItems = jest.spyOn(repository, 'listItems');
    const chat = screen.getByTestId('chat-input');

    await fireEvent.changeText(chat, 'add two cartons of milk');
    await fireEvent(chat, 'submitEditing');

    expect(chat.props.value).toBe('add two cartons of milk');
    expect(addItem).not.toHaveBeenCalled();
    expect(listItems).not.toHaveBeenCalled();
    expect(screen.getAllByTestId(/^item-row-/)).toHaveLength(3);
  });

  it('opens the add-item form from the plus button', async () => {
    await renderApp();
    expect(screen.queryByTestId('item-name-input')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Add item'));

    expect(await screen.findByTestId('item-name-input')).toBeOnTheScreen();
  });
});
