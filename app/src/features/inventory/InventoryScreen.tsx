import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { colors, contentMaxWidth } from '../../theme/tokens';
import { ChatBar } from './components/ChatBar';
import { ItemList } from './components/ItemList';
import { ItemSheet, type ItemSheetTarget } from './components/ItemSheet';
import { SearchBar } from './components/SearchBar';
import { useInventoryRepository } from './data/InventoryContext';
import type { InventoryItem } from './data/InventoryRepository';
import { todayIso } from './domain/dates';
import { useInventoryItems } from './hooks/useInventoryItems';

/** The single inventory page: search at the top, the scrolling item list, and the chat
 * bar with the add button at the bottom. Tapping an item opens it for editing. */
export function InventoryScreen(): React.JSX.Element {
  const repository = useInventoryRepository();
  const insets = useSafeAreaInsets();
  const { keyboardInset, onLayout } = useKeyboardInset();
  const { query, setQuery, items, loading, refresh } =
    useInventoryItems(repository);
  const [sheet, setSheet] = useState<ItemSheetTarget | null>(null);
  const now = new Date();
  const today = todayIso(now);

  const handleSaved = useCallback(
    async (item: InventoryItem) => {
      setSheet(null);
      const visible = await refresh();
      // If the current search hides the added or edited item, clear it so the user sees
      // what they saved.
      if (visible && !visible.some(({ id }) => id === item.id)) {
        setQuery('');
      }
    },
    [refresh, setQuery],
  );

  // After a delete, or when the edited item turned out to be gone already.
  const closeAndRefresh = useCallback(() => {
    setSheet(null);
    refresh();
  }, [refresh]);

  const handleChat = useCallback((_text: string) => {
    // TODO: send the request to the Llama pipeline (README, "How a request will flow").
  }, []);

  return (
    <View style={styles.screen} onLayout={onLayout}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top,
            // The keyboard, when open, covers the navigation bar area too.
            paddingBottom: keyboardInset || insets.bottom,
          },
        ]}
      >
        <SearchBar value={query} onChangeText={setQuery} />
        <ItemList
          items={items}
          query={query}
          loading={loading}
          today={today}
          now={now}
          onItemPress={item => setSheet({ mode: 'edit', item })}
        />
        <ChatBar
          onSubmit={handleChat}
          onAddPress={() => setSheet({ mode: 'add' })}
        />
      </View>
      <ItemSheet
        target={sheet}
        today={today}
        onCancel={() => setSheet(null)}
        onSaved={handleSaved}
        onDeleted={closeAndRefresh}
        onGone={closeAndRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
  },
});
