import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { resetFatalErrorForTests } from '../src/errors/fatalError';
import { ItemValidationError } from '../src/features/inventory/data/InventoryRepository';
import { InMemoryInventoryRepository } from './support/InMemoryInventoryRepository';
import { renderApp } from './support/renderApp';

beforeEach(resetFatalErrorForTests);

async function openForm(repository = new InMemoryInventoryRepository()) {
  const result = await renderApp(repository);
  await fireEvent.press(screen.getByTestId('add-item-button'));
  await screen.findByTestId('item-name-input');
  return result;
}

const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);

/** Opens the inline date picker (iOS/Windows; Jest runs as iOS) and picks a date. */
async function pickDate(date: Date) {
  await fireEvent.press(screen.getByTestId('expiration-input'));
  await fireEvent(
    screen.getByTestId('expiration-picker'),
    'change',
    { type: 'set' },
    date,
  );
}

describe('add-item form', () => {
  it('starts with quantity 1, no expiration and no created-date field', async () => {
    await openForm();
    expect(screen.getByTestId('quantity-input').props.value).toBe('1');
    expect(screen.getByText('No expiration')).toBeOnTheScreen();
    expect(screen.queryByText(/created|added/i)).toBeNull();
  });

  it('enables Save only once item and location are filled', async () => {
    await openForm();
    const save = screen.getByTestId('save-item-button');
    expect(save).toBeDisabled();

    await type('item-name-input', 'Hammer');
    expect(save).toBeDisabled();

    await type('item-location-input', 'Garage');
    expect(save).toBeEnabled();
  });

  it('keeps the quantity a whole number of at least 1', async () => {
    await openForm();
    const quantity = () => screen.getByTestId('quantity-input').props.value;

    expect(screen.getByTestId('quantity-decrement')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('quantity-increment'));
    await fireEvent.press(screen.getByTestId('quantity-increment'));
    expect(quantity()).toBe('3');
    await fireEvent.press(screen.getByTestId('quantity-decrement'));
    expect(quantity()).toBe('2');

    await type('quantity-input', '1-2.5a');
    expect(quantity()).toBe('125');
  });

  it('rejects a quantity of 0 without saving', async () => {
    const { repository } = await openForm();
    const addItem = jest.spyOn(repository, 'addItem');
    await type('item-name-input', 'Hammer');
    await type('item-location-input', 'Garage');
    await type('quantity-input', '0');

    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(screen.getByText('Quantity must be at least 1')).toBeOnTheScreen();
    expect(addItem).not.toHaveBeenCalled();
  });

  it('picks an expiration date with the date picker', async () => {
    await openForm();
    expect(screen.queryByTestId('expiration-picker')).toBeNull();

    await pickDate(new Date(2027, 9, 27));

    expect(screen.getByTestId('expiration-input')).toHaveTextContent(
      'Wed, Oct 27, 2027',
    );
    expect(screen.queryByTestId('expiration-picker')).toBeNull();
    expect(screen.getByLabelText('Clear expiration date')).toBeOnTheScreen();
  });

  it('opens the picker on today when no date is set', async () => {
    await openForm();
    await fireEvent.press(screen.getByTestId('expiration-input'));
    const value: Date = screen.getByTestId('expiration-picker').props.value;
    expect(value.toDateString()).toBe(new Date().toDateString());
  });

  it('keeps no expiration when the picker is dismissed', async () => {
    await openForm();
    await fireEvent.press(screen.getByTestId('expiration-input'));
    await fireEvent(screen.getByTestId('expiration-picker'), 'change', {
      type: 'dismissed',
    });
    expect(screen.getByText('No expiration')).toBeOnTheScreen();
  });

  it('clears a picked expiration date', async () => {
    await openForm();
    await pickDate(new Date(2027, 9, 27));

    await fireEvent.press(screen.getByLabelText('Clear expiration date'));

    expect(screen.getByText('No expiration')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Clear expiration date')).toBeNull();
  });

  it('notes when the picked date has already passed', async () => {
    await openForm();
    await pickDate(new Date(2020, 0, 15));
    expect(screen.getByText('Already expired')).toBeOnTheScreen();
  });

  it('uses the native date dialog on Android', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    const open = DateTimePickerAndroid.open as jest.Mock;
    open.mockClear();
    try {
      await openForm();
      await fireEvent.press(screen.getByTestId('expiration-input'));

      expect(open).toHaveBeenCalledTimes(1);
      const options = open.mock.calls[0][0];
      expect(options.mode).toBe('date');
      expect(screen.queryByTestId('expiration-picker')).toBeNull();

      await act(async () =>
        options.onChange({ type: 'set' }, new Date(2027, 9, 27)),
      );
      expect(screen.getByTestId('expiration-input')).toHaveTextContent(
        'Wed, Oct 27, 2027',
      );
    } finally {
      os.restore();
    }
  });

  it('saves the item, closes the form and shows the item in the list', async () => {
    const { repository } = await openForm();
    const addItem = jest.spyOn(repository, 'addItem');

    await type('item-name-input', '  Milk 1 gallon ');
    await type('item-location-input', 'Fridge');
    await fireEvent.press(screen.getByTestId('quantity-increment'));
    await pickDate(new Date(2027, 9, 27));
    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(addItem).toHaveBeenCalledWith({
      name: 'Milk 1 gallon',
      location: 'Fridge',
      quantity: 2,
      expirationDate: '2027-10-27',
    });
    await waitFor(() =>
      expect(screen.queryByTestId('item-name-input')).toBeNull(),
    );
    expect(await screen.findByText('Milk 1 gallon')).toBeOnTheScreen();
    expect(screen.getByText('×2')).toBeOnTheScreen();
    expect(screen.getByText('Expires Oct 27, 2027')).toBeOnTheScreen();
    expect(screen.getByText('Added today')).toBeOnTheScreen();
  });

  it('saves items without an expiration date', async () => {
    const { repository } = await openForm();
    await type('item-name-input', 'Hammer');
    await type('item-location-input', 'Garage');
    await fireEvent.press(screen.getByTestId('save-item-button'));

    await screen.findByText('Hammer');
    expect(repository.items[0]).toMatchObject({
      quantity: 1,
      expirationDate: null,
    });
  });

  it('cancel closes the form without saving', async () => {
    const { repository } = await openForm();
    await type('item-name-input', 'Hammer');
    await fireEvent.press(screen.getByTestId('cancel-item-button'));

    expect(screen.queryByTestId('item-name-input')).toBeNull();
    expect(repository.items).toEqual([]);
  });

  it('suggests starter locations when the inventory is empty', async () => {
    await openForm();
    for (const location of ['Fridge', 'Freezer', 'Pantry', 'Garage']) {
      expect(
        await screen.findByTestId(`location-chip-${location}`),
      ).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId('location-chip-Pantry'));
    expect(screen.getByTestId('item-location-input').props.value).toBe(
      'Pantry',
    );
  });

  it('suggests existing locations once there are items', async () => {
    await openForm(
      new InMemoryInventoryRepository([
        { name: 'Drill', location: 'Basement' },
        { name: 'Milk', location: 'Fridge' },
      ]),
    );
    expect(
      await screen.findByTestId('location-chip-Basement'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('location-chip-Fridge')).toBeOnTheScreen();
    expect(screen.queryByTestId('location-chip-Garage')).toBeNull();
  });

  it('shows a validation error from the core on its field', async () => {
    const repository = new InMemoryInventoryRepository();
    repository.failWith.addItem = new ItemValidationError(
      'location',
      'Location is not allowed',
    );
    await openForm(repository);
    await type('item-name-input', 'Hammer');
    await type('item-location-input', 'Garage');

    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(
      await screen.findByText('Location is not allowed'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('item-name-input')).toBeOnTheScreen();
    expect(screen.queryByTestId('fatal-error-screen')).toBeNull();

    // Editing the field clears the core's error.
    await type('item-location-input', 'Shed');
    expect(screen.queryByText('Location is not allowed')).toBeNull();
  });

  it('clears a search that would hide the new item', async () => {
    await renderApp(
      new InMemoryInventoryRepository([{ name: 'Hammer', location: 'Garage' }]),
    );
    await fireEvent.changeText(screen.getByTestId('search-input'), 'ham');
    await fireEvent.press(screen.getByTestId('add-item-button'));
    await type('item-name-input', 'Milk');
    await type('item-location-input', 'Fridge');
    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(await screen.findByText('Milk')).toBeOnTheScreen();
    expect(screen.getByTestId('search-input').props.value).toBe('');
    expect(screen.getByText('Hammer')).toBeOnTheScreen();
  });

  it('keeps a search that still shows the new item', async () => {
    await renderApp(
      new InMemoryInventoryRepository([{ name: 'Hammer', location: 'Garage' }]),
    );
    await fireEvent.changeText(screen.getByTestId('search-input'), 'ham');
    await fireEvent.press(screen.getByTestId('add-item-button'));
    await type('item-name-input', 'Sledgehammer');
    await type('item-location-input', 'Garage');
    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(await screen.findByText('Sledgehammer')).toBeOnTheScreen();
    expect(screen.getByTestId('search-input').props.value).toBe('ham');
  });
});
