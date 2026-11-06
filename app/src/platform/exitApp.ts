import { BackHandler } from 'react-native';
import NativeAppHost from './NativeAppHost';

/** Terminates the app. Falls back to leaving the screen if the host module is missing. */
export function exitApp(): void {
  if (NativeAppHost) {
    NativeAppHost.exitApp();
  } else {
    BackHandler.exitApp();
  }
}
