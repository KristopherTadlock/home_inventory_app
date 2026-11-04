import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { selfCheck } from 'core-bridge';
import App from '../src/App';

jest.mock('core-bridge', () => ({
  selfCheck: jest.fn(() => ({
    sqliteVersion: '3.0.0',
    ducklingTomorrow: '2026-01-02',
    llamaSystemInfo: 'CPU',
    whisperSystemInfo: 'WHISPER',
  })),
}));

test('renders Hello World', async () => {
  await render(<App />);
  expect(screen.getByText('Hello World')).toBeOnTheScreen();
});

test('runs the native self-check on startup', async () => {
  await render(<App />);
  expect(selfCheck).toHaveBeenCalled();
});
