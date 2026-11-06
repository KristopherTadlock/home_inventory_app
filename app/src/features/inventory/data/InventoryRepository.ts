/**
 * The inventory as the UI sees it. Screens and hooks depend only on this interface; the
 * app supplies the Rust core adapter and tests supply an in-memory fake.
 */

/** Item ids are 64-bit in the core; strings keep them exact and usable as React keys. */
export type ItemId = string;

export type ItemField = 'name' | 'location' | 'quantity' | 'expirationDate';

export interface InventoryItem {
  id: ItemId;
  name: string;
  location: string;
  /** Always at least 1: items whose quantity reaches 0 are deleted. */
  quantity: number;
  /** `YYYY-MM-DD`, or null if the item does not expire. */
  expirationDate: string | null;
  /** UTC insert time, `YYYY-MM-DDTHH:MM:SS.SSSZ`. */
  createdDate: string;
}

export interface NewInventoryItem {
  name: string;
  location: string;
  quantity: number;
  expirationDate: string | null;
}

/** The input breaks a rule; nothing was written. Shown next to `field`. */
export class ItemValidationError extends Error {
  constructor(readonly field: ItemField, message: string) {
    super(message);
    this.name = 'ItemValidationError';
    Object.setPrototypeOf(this, ItemValidationError.prototype);
  }
}

/** The item no longer exists; nothing was written. Not fatal: the UI refreshes. */
export class ItemNotFoundError extends Error {
  constructor(readonly id: ItemId) {
    super(`Item ${id} not found`);
    this.name = 'ItemNotFoundError';
    Object.setPrototypeOf(this, ItemNotFoundError.prototype);
  }
}

/** Storage is unavailable or a read or write failed. Fatal: the app shows an error and
 * closes. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export interface InventoryRepository {
  /** All items, or those whose name contains `query` (case-insensitive). Ordered by
   * expiration date (soonest first, non-expiring last), then name. */
  listItems(query?: string): Promise<InventoryItem[]>;
  /** Validates and stores an item; rejects with `ItemValidationError` on bad input. */
  addItem(item: NewInventoryItem): Promise<InventoryItem>;
  /** Replaces an item's fields, keeping its id and created date, and returns it as
   * stored. Rejects with `ItemValidationError` on bad input (quantity 0 included: use
   * `deleteItem`) and `ItemNotFoundError` if the item no longer exists. */
  updateItem(id: ItemId, item: NewInventoryItem): Promise<InventoryItem>;
  /** Deletes an item; rejects with `ItemNotFoundError` if it no longer exists. */
  deleteItem(id: ItemId): Promise<void>;
  /** Distinct locations in use, alphabetical. */
  listLocations(): Promise<string[]>;
}
