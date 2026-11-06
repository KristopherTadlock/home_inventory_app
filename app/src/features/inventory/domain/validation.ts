/**
 * Add-item form rules. They mirror the Rust core's validation (core/crates/inventory-core/
 * src/inventory.rs) so errors appear immediately; the core remains authoritative.
 */
import type { ItemField } from '../data/InventoryRepository';

export const MAX_NAME_CHARS = 200;
export const MAX_LOCATION_CHARS = 100;
export const MAX_QUANTITY = 999_999;

/** Suggested when the inventory has no locations yet. */
export const STARTER_LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Garage'];

export interface ItemFormValues {
  name: string;
  location: string;
  /** Raw text of the quantity field (digits only). */
  quantity: string;
  /** `YYYY-MM-DD` from the date picker, or null for no expiration. */
  expirationDate: string | null;
}

export type FieldErrors = Partial<Record<ItemField, string>>;

/** Counts code points, as the core does (Rust `chars().count()`). */
const charCount = (text: string) => [...text].length;

export function parseQuantity(text: string): number | null {
  return /^\d+$/.test(text) ? Number(text) : null;
}

function textError(
  value: string,
  label: string,
  maxChars: number,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required`;
  }
  if (charCount(trimmed) > maxChars) {
    return `${label} must be at most ${maxChars} characters`;
  }
  return undefined;
}

function quantityError(text: string): string | undefined {
  const quantity = parseQuantity(text);
  if (quantity === null) {
    return 'Quantity is required';
  }
  if (quantity < 1) {
    return 'Quantity must be at least 1';
  }
  if (quantity > MAX_QUANTITY) {
    return `Quantity must be at most ${MAX_QUANTITY}`;
  }
  return undefined;
}

/** The expiration date needs no check: the date picker only produces valid dates. */
export function validateItemForm(values: ItemFormValues): FieldErrors {
  const errors: FieldErrors = {
    name: textError(values.name, 'Item', MAX_NAME_CHARS),
    location: textError(values.location, 'Location', MAX_LOCATION_CHARS),
    quantity: quantityError(values.quantity),
  };
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as FieldErrors;
}
