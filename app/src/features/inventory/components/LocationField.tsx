import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextField } from '../../../components/TextField';
import { colors, fontSizes, radii, spacing } from '../../../theme/tokens';

export function LocationField({
  value,
  error,
  suggestions,
  onChangeText,
  onBlur,
}: {
  value: string;
  error?: string;
  suggestions: string[];
  onChangeText: (text: string) => void;
  onBlur: () => void;
}): React.JSX.Element {
  const selected = value.trim().toLowerCase();
  return (
    <View style={styles.container}>
      <TextField
        testID="item-location-input"
        label="Location"
        placeholder="e.g. Fridge, Garage"
        autoCapitalize="words"
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        error={error}
      />
      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {suggestions.map(location => {
            const isSelected = location.toLowerCase() === selected;
            return (
              <Pressable
                key={location}
                testID={`location-chip-${location}`}
                accessibilityRole="button"
                accessibilityLabel={`Location ${location}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => onChangeText(location)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text style={styles.chipText}>{location}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
  },
  chipSelected: {
    backgroundColor: colors.chipSelected,
  },
  chipText: {
    color: colors.text,
    fontSize: fontSizes.small,
  },
});
