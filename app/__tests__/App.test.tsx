import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from '../src/App';

test('renders Hello World', async () => {
  await render(<App />);
  expect(screen.getByText('Hello World')).toBeOnTheScreen();
});
