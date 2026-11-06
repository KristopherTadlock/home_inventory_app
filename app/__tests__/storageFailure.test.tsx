import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppRoot } from '../src/AppRoot';
import {
  raiseFatalError,
  resetFatalErrorForTests,
} from '../src/errors/fatalError';
import {
  InMemoryInventoryRepository,
  storageFailure,
} from './support/InMemoryInventoryRepository';
import { renderApp } from './support/renderApp';

let consoleError: jest.SpyInstance;

beforeEach(() => {
  resetFatalErrorForTests();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

const fatalScreen = () => screen.findByTestId('fatal-error-screen');

describe('storage failures', () => {
  it('replace the inventory with the error screen when the first load fails', async () => {
    const repository = new InMemoryInventoryRepository();
    repository.failWith.listItems = storageFailure();

    await render(<AppRoot repository={repository} onExit={jest.fn()} />);

    expect(await fatalScreen()).toBeOnTheScreen();
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.queryByTestId('search-input')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      'storage failure',
      'disk I/O error',
    );
  });

  it('replace everything, including the open form, when saving fails', async () => {
    const { repository } = await renderApp();
    await fireEvent.press(screen.getByTestId('add-item-button'));
    await fireEvent.changeText(screen.getByTestId('item-name-input'), 'Milk');
    await fireEvent.changeText(
      screen.getByTestId('item-location-input'),
      'Fridge',
    );
    repository.failWith.addItem = storageFailure();

    await fireEvent.press(screen.getByTestId('save-item-button'));

    expect(await fatalScreen()).toBeOnTheScreen();
    expect(screen.queryByTestId('item-name-input')).toBeNull();
    expect(repository.items).toEqual([]);
  });

  it.each([
    ['saving an edit', 'updateItem', 'save-item-button'],
    ['deleting', 'deleteItem', 'confirm-delete-button'],
  ] as const)(
    'replace the open edit view when %s fails',
    async (_action, method, button) => {
      const { repository } = await renderApp(
        new InMemoryInventoryRepository([{ name: 'Milk', location: 'Fridge' }]),
      );
      await fireEvent.press(screen.getByTestId('item-row-1'));
      await screen.findByText('Edit item');
      if (method === 'deleteItem') {
        await fireEvent.press(screen.getByTestId('delete-item-button'));
      }
      repository.failWith[method] = storageFailure();

      await fireEvent.press(screen.getByTestId(button));

      expect(await fatalScreen()).toBeOnTheScreen();
      expect(screen.queryByText('Edit item')).toBeNull();
      expect(repository.items.map(item => item.name)).toEqual(['Milk']);
    },
  );

  it('show the error screen when a search fails', async () => {
    const { repository } = await renderApp(
      new InMemoryInventoryRepository([{ name: 'Milk' }]),
    );
    repository.failWith.listItems = storageFailure();

    await fireEvent.changeText(screen.getByTestId('search-input'), 'mi');

    expect(await fatalScreen()).toBeOnTheScreen();
  });

  it('show the error screen when loading location suggestions fails', async () => {
    const { repository } = await renderApp();
    repository.failWith.listLocations = storageFailure();

    await fireEvent.press(screen.getByTestId('add-item-button'));

    expect(await fatalScreen()).toBeOnTheScreen();
  });

  it('close the app from the button', async () => {
    const repository = new InMemoryInventoryRepository();
    repository.failWith.listItems = storageFailure();
    const onExit = jest.fn();
    await render(<AppRoot repository={repository} onExit={onExit} />);

    await fireEvent.press(await screen.findByTestId('close-app-button'));

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('close the app from the back button', async () => {
    const handlers: Array<() => boolean | null | undefined> = [];
    const addListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.push(handler);
        return { remove: jest.fn() };
      });
    const repository = new InMemoryInventoryRepository();
    repository.failWith.listItems = storageFailure();
    const onExit = jest.fn();
    await render(<AppRoot repository={repository} onExit={onExit} />);
    await fatalScreen();

    const handled = handlers[handlers.length - 1]();

    expect(handled).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
    addListener.mockRestore();
  });

  it('are reported once even if several happen', async () => {
    const repository = new InMemoryInventoryRepository();
    repository.failWith.listItems = storageFailure();
    await render(<AppRoot repository={repository} onExit={jest.fn()} />);
    await fatalScreen();

    await act(() => raiseFatalError(new Error('second failure')));

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('fatal-error-screen')).toHaveLength(1);
  });
});
