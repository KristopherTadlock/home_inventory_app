import {
  MAX_LOCATION_CHARS,
  MAX_NAME_CHARS,
  parseQuantity,
  validateItemForm,
  type ItemFormValues,
} from '../../src/features/inventory/domain/validation';

const VALID: ItemFormValues = {
  name: 'Milk',
  location: 'Fridge',
  quantity: '1',
  expirationDate: null,
};

const validate = (values: Partial<ItemFormValues>) =>
  validateItemForm({ ...VALID, ...values });

describe('validateItemForm', () => {
  it('accepts a valid item with no expiration', () => {
    expect(validate({})).toEqual({});
  });

  it('requires item and location', () => {
    expect(validate({ name: '   ', location: '' })).toEqual({
      name: 'Item is required',
      location: 'Location is required',
    });
  });

  it('limits item and location length in characters', () => {
    expect(validate({ name: 'x'.repeat(MAX_NAME_CHARS + 1) }).name).toBe(
      'Item must be at most 200 characters',
    );
    expect(
      validate({ location: 'x'.repeat(MAX_LOCATION_CHARS + 1) }).location,
    ).toBe('Location must be at most 100 characters');
    // Emoji are two UTF-16 units but one character, as in the core.
    expect(validate({ name: '🥛'.repeat(MAX_NAME_CHARS) })).toEqual({});
  });

  it('rejects zero, missing and too-large quantities', () => {
    expect(validate({ quantity: '0' }).quantity).toBe(
      'Quantity must be at least 1',
    );
    expect(validate({ quantity: '' }).quantity).toBe('Quantity is required');
    expect(validate({ quantity: '1000000' }).quantity).toBe(
      'Quantity must be at most 999999',
    );
    expect(validate({ quantity: '999999' })).toEqual({});
  });

  it('accepts an item with an expiration date', () => {
    expect(validate({ expirationDate: '2027-10-27' })).toEqual({});
  });
});

describe('parseQuantity', () => {
  it('parses whole numbers only', () => {
    expect(parseQuantity('12')).toBe(12);
    expect(parseQuantity('0')).toBe(0);
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('1.5')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
  });
});
