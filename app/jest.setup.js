/* eslint-env jest */
// A fixed zone west of UTC, so tests catch dates shown a day early (UTC parsing) and
// created dates near midnight. Node applies TZ changes made at runtime.
process.env.TZ = 'America/Los_Angeles';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// The native date picker has no JS fallback; render a plain View that tests can drive
// through its onChange prop, and stub the Android imperative API.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  const DateTimePicker = props => React.createElement(View, props);
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});
