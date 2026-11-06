import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, spacing } from '../../../theme/tokens';
import type { InventoryItem } from '../data/InventoryRepository';
import { ItemRow } from './ItemRow';

export function ItemList({
  items,
  query,
  loading,
  today,
  now,
  onItemPress,
}: {
  items: InventoryItem[];
  /** The search the items are filtered by, for the no-match message. */
  query: string;
  loading: boolean;
  today: string;
  now: Date;
  onItemPress: (item: InventoryItem) => void;
}): React.JSX.Element {
  return (
    <FlatList
      testID="item-list"
      data={items}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <ItemRow item={item} today={today} now={now} onPress={onItemPress} />
      )}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={loading ? null : <EmptyState query={query.trim()} />}
      ListFooterComponent={Footer}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

function EmptyState({ query }: { query: string }): React.JSX.Element {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>
        {query
          ? `No items match “${query}”.`
          : 'Your inventory is empty. Tap + to add an item.'}
      </Text>
    </View>
  );
}

function Separator(): React.JSX.Element {
  return <View style={styles.separator} />;
}

/** Required by the Llama 3.2 license, since the app ships the model. */
function Footer(): React.JSX.Element {
  return <Text style={styles.footer}>Built with Llama</Text>;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  separator: {
    height: spacing.sm,
  },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    textAlign: 'center',
  },
  footer: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
