import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * App-level services the host platform provides. Implemented natively per platform
 * (Android: app/android/.../AppHostModule.kt).
 */
export interface Spec extends TurboModule {
  readonly getConstants: () => {
    /** Private, app-only directory for the SQLite database. */
    databaseDir: string;
  };
  /** Terminates the app process. */
  exitApp(): void;
}

// `get`, not `getEnforcing`: a missing module must surface as a storage failure on the
// error screen, not as a crash while modules load.
export default TurboModuleRegistry.get<Spec>('AppHost');
