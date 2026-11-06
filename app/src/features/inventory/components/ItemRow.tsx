import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../../../theme/tokens';
import type { InventoryItem } from '../data/InventoryRepository';
import {
  describeExpiration,
  formatAddedDate,
  type ExpiryStatus,
} from '../domain/dates';

const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  expired: colors.danger,
  soon: colors.warning,
  later: colors.textMuted,
};

export function ItemRow({
  item,
  today,
  now,
  onPress,
}: {
  item: InventoryItem;
  /** Local date, `YYYY-MM-DD`. */
  today: string;
  now: Date;
  /** Opens the item's edit view. */
  onPress: (item: InventoryItem) => void;
}): React.JSX.Element {
  const expiration = item.expirationDate
    ? describeExpiration(item.expirationDate, today)
    : null;
  const added = formatAddedDate(item.createdDate, now);
  const accessibilityLabel = [
    item.name,
    `quantity ${item.quantity}`,
    item.location,
    expiration?.accessibilityText,
    added.accessibilityText,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      testID={`item-row-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the item to edit or delete it"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.titleLine}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.quantity}>×{item.quantity}</Text>
      </View>
      <View style={styles.detailLine}>
        <Text style={styles.details}>
          {item.location}
          {expiration && (
            <>
              {' · '}
              <Text
                style={[
                  styles.expiry,
                  { color: EXPIRY_COLORS[expiration.status] },
                  expiration.status !== 'later' && styles.expiryEmphasis,
                ]}
              >
                {expiration.text}
              </Text>
            </>
          )}
        </Text>
        <Text style={styles.added}>{added.text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  pressed: {
    backgroundColor: colors.chip,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  quantity: {
    color: colors.text,
    fontSize: fontSizes.body,
    fontVariant: ['tabular-nums'],
  },
  // Wraps so that on narrow screens the "Added" caption moves below the details
  // instead of truncating them.
  detailLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.md,
  },
  details: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: fontSizes.small,
  },
  expiry: {
    fontSize: fontSizes.small,
  },
  expiryEmphasis: {
    fontWeight: '600',
  },
  added: {
    marginLeft: 'auto',
    color: colors.textMuted,
    fontSize: fontSizes.caption,
  },
});
