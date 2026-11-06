import React from 'react';
import { Keyboard, Modal, ScrollView, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useKeyboardInset } from '../../../hooks/useKeyboardInset';
import { colors, contentMaxWidth, spacing } from '../../../theme/tokens';
import { useInventoryRepository } from '../data/InventoryContext';
import type { InventoryItem } from '../data/InventoryRepository';
import { useItemForm } from '../hooks/useItemForm';
import { ItemForm } from './ItemForm';

/** What the sheet is open for: a new item, or editing `item`. */
export type ItemSheetTarget =
  | { mode: 'add' }
  | { mode: 'edit'; item: InventoryItem };

interface SheetCallbacks {
  onCancel: () => void;
  onSaved: (item: InventoryItem) => void;
  onDeleted: (item: InventoryItem) => void;
  /** The edited item no longer exists. */
  onGone: () => void;
}

/** The add or edit form in a modal sheet; closed while `target` is null. */
export function ItemSheet({
  target,
  today,
  ...callbacks
}: SheetCallbacks & {
  target: ItemSheetTarget | null;
  today: string;
}): React.JSX.Element {
  const { onCancel } = callbacks;
  return (
    <Modal
      visible={target !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      navigationBarTranslucent
      // Back closes the keyboard first, so a stray press doesn't discard the form.
      onRequestClose={() =>
        Keyboard.isVisible() ? Keyboard.dismiss() : onCancel()
      }
    >
      {/* Mounted only while visible, so every opening starts with a fresh form. The
          Modal is its own native window, so it gets its own SafeAreaProvider: insets from
          the app's root provider came through as 0 here, leaving the bottom of a long
          form under the navigation bar. */}
      {target && (
        <SafeAreaProvider>
          <SheetContent
            item={target.mode === 'edit' ? target.item : undefined}
            today={today}
            {...callbacks}
          />
        </SafeAreaProvider>
      )}
    </Modal>
  );
}

function SheetContent({
  item,
  today,
  onCancel,
  onSaved,
  onDeleted,
  onGone,
}: SheetCallbacks & {
  item: InventoryItem | undefined;
  today: string;
}): React.JSX.Element {
  const repository = useInventoryRepository();
  const form = useItemForm({ repository, item, onSaved, onDeleted, onGone });
  const insets = useSafeAreaInsets();
  const { keyboardInset, onLayout } = useKeyboardInset();

  return (
    <View
      style={[styles.sheet, { paddingBottom: keyboardInset }]}
      onLayout={onLayout}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.lg,
            // The keyboard, when open, covers the navigation bar area too.
            paddingBottom: (keyboardInset ? 0 : insets.bottom) + spacing.lg,
          },
        ]}
      >
        <View style={styles.inner}>
          <ItemForm form={form} today={today} onCancel={onCancel} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  inner: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
  },
});
