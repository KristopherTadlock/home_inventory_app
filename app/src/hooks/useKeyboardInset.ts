import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from 'react-native';

const SHOW_EVENT =
  Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT =
  Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/**
 * How far the on-screen keyboard overlaps the bottom of a full-screen container, in dp
 * (0 when hidden). Pass `onLayout` to the container.
 *
 * Used instead of KeyboardAvoidingView: with Android edge-to-edge (enforced from
 * Android 15), the keyboard-hide event reports a `screenY` above the navigation bar, so
 * KeyboardAvoidingView keeps padding the bottom after the keyboard closes. Here hiding
 * always resets the overlap to 0.
 */
export function useKeyboardInset(): {
  keyboardInset: number;
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const [keyboardInset, setKeyboardInset] = useState(0);
  const containerBottom = useRef(Dimensions.get('window').height);
  const keyboardTop = useRef<number | null>(null);

  const update = useCallback(() => {
    setKeyboardInset(
      keyboardTop.current === null
        ? 0
        : Math.max(0, containerBottom.current - keyboardTop.current),
    );
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(SHOW_EVENT, (event: KeyboardEvent) => {
      keyboardTop.current = event.endCoordinates.screenY;
      update();
    });
    const hide = Keyboard.addListener(HIDE_EVENT, () => {
      keyboardTop.current = null;
      update();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [update]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      containerBottom.current = y + height;
      update();
    },
    [update],
  );

  return { keyboardInset, onLayout };
}
