import React, { useEffect, useState } from 'react';
import { selfCheck } from 'core-bridge';
import { AppRoot } from './AppRoot';
import { createCoreInventoryRepository } from './features/inventory/data/coreInventoryRepository';
import { exitApp } from './platform/exitApp';

/** The Android app: the Rust core for storage and the native host for exiting. */
function App(): React.JSX.Element {
  const [repository] = useState(() => createCoreInventoryRepository());

  useEffect(() => {
    console.log('core self-check', JSON.stringify(selfCheck()));
  }, []);

  return <AppRoot repository={repository} onExit={exitApp} />;
}

export default App;
