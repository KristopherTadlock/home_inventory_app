import NativeAppHost from './NativeAppHost';

const DATABASE_FILE = 'inventory.sqlite3';

/** Absolute path of the inventory database. Throws if the host module is missing. */
export function databasePath(): string {
  if (!NativeAppHost) {
    throw new Error('AppHost native module is not available');
  }
  return `${NativeAppHost.getConstants().databaseDir}/${DATABASE_FILE}`;
}
