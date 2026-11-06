import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Inventory, InventoryError, selfCheck } from 'core-bridge';
import App from '../src/App';
import { resetFatalErrorForTests } from '../src/errors/fatalError';
import NativeAppHost from '../src/platform/NativeAppHost';

jest.mock('../src/platform/NativeAppHost', () => ({
  __esModule: true,
  default: {
    getConstants: () => ({ databaseDir: '/data/databases' }),
    exitApp: jest.fn(),
  },
}));

jest.mock('core-bridge', () => {
  class Storage extends Error {
    static instanceOf(obj: unknown) {
      return obj instanceof Storage;
    }
    inner: { reason: string };
    constructor(fields: { reason: string }) {
      super(fields.reason);
      this.inner = fields;
    }
  }
  const never = { instanceOf: () => false };
  return {
    selfCheck: jest.fn(() => ({
      sqliteVersion: '3.0.0',
      ducklingTomorrow: '2026-01-02',
      llamaSystemInfo: 'CPU',
      whisperSystemInfo: 'WHISPER',
    })),
    Inventory: {
      open: jest.fn(() => ({
        listItems: () => [],
        listLocations: () => [],
        addItem: jest.fn(),
      })),
    },
    InventoryError: { Invalid: never, NotFound: never, Storage },
    ItemField: { Name: 0, Location: 1, Quantity: 2, ExpirationDate: 3 },
  };
});

beforeEach(() => {
  resetFatalErrorForTests();
});

test('runs the native self-check on startup', async () => {
  await render(<App />);
  expect(selfCheck).toHaveBeenCalled();
});

test('opens the database in the host directory and shows the inventory', async () => {
  await render(<App />);
  expect(
    await screen.findByText('Your inventory is empty. Tap + to add an item.'),
  ).toBeOnTheScreen();
  expect(Inventory.open).toHaveBeenCalledWith(
    '/data/databases/inventory.sqlite3',
  );
});

test('closes the app through the host module after a storage failure', async () => {
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  (Inventory.open as jest.Mock).mockImplementationOnce(() => {
    throw new InventoryError.Storage({ reason: 'unable to open database' });
  });
  await render(<App />);

  await fireEvent.press(await screen.findByTestId('close-app-button'));

  expect(NativeAppHost!.exitApp).toHaveBeenCalledTimes(1);
  expect(consoleError).toHaveBeenCalledWith(
    'storage failure',
    'unable to open database',
  );
  consoleError.mockRestore();
});
