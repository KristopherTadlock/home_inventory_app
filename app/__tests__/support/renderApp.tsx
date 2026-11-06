import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AppRoot } from '../../src/AppRoot';
import { InMemoryInventoryRepository } from './InMemoryInventoryRepository';

/** Renders the app over `repository` and waits for the first list load. */
export async function renderApp(
  repository = new InMemoryInventoryRepository(),
  onExit: () => void = jest.fn(),
) {
  await render(<AppRoot repository={repository} onExit={onExit} />);
  await screen.findByText('Built with Llama');
  return { repository, onExit };
}
