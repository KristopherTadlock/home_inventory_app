import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  colors,
  fontSizes,
  hitSlop,
  radii,
  spacing,
  touchTarget,
} from '../../../theme/tokens';

export function SearchBar({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.container}>
      <SearchIcon />
      <TextInput
        testID="search-input"
        accessibilityLabel="Search items"
        placeholder="Search items"
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.input}
      />
      {value.length > 0 && (
        <Pressable
          testID="clear-search"
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={hitSlop}
          onPress={() => onChangeText('')}
          style={styles.clear}
        >
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A magnifying glass drawn with Views. */
function SearchIcon(): React.JSX.Element {
  return (
    <View style={styles.icon} accessible={false}>
      <View style={styles.iconLens} />
      <View style={styles.iconHandle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSizes.body,
  },
  clear: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
  },
  icon: {
    width: 18,
    height: 18,
  },
  iconLens: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  iconHandle: {
    position: 'absolute',
    top: 13,
    left: 11,
    width: 7,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textMuted,
    transform: [{ rotate: '45deg' }],
  },
});
