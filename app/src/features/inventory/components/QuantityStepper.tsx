import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { IconButton } from '../../../components/IconButton';
import { MinusIcon, PlusIcon } from '../../../components/PlusIcon';
import {
  colors,
  fontSizes,
  radii,
  spacing,
  touchTarget,
} from '../../../theme/tokens';
import { MAX_QUANTITY, parseQuantity } from '../domain/validation';

export function QuantityStepper({
  value,
  error,
  onChangeText,
  onIncrement,
  onDecrement,
  onBlur,
}: {
  /** Raw digits typed by the user. */
  value: string;
  error?: string;
  onChangeText: (text: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onBlur: () => void;
}): React.JSX.Element {
  const quantity = parseQuantity(value);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quantity</Text>
      <View style={styles.row}>
        <IconButton
          testID="quantity-decrement"
          accessibilityLabel="Decrease quantity"
          disabled={quantity === null || quantity <= 1}
          onPress={onDecrement}
        >
          <MinusIcon color={colors.text} size={16} />
        </IconButton>
        <TextInput
          testID="quantity-input"
          accessibilityLabel="Quantity"
          keyboardType="number-pad"
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          maxLength={String(MAX_QUANTITY).length}
          selectTextOnFocus
          style={[styles.input, error ? styles.inputError : null]}
        />
        <IconButton
          testID="quantity-increment"
          accessibilityLabel="Increase quantity"
          disabled={quantity !== null && quantity >= MAX_QUANTITY}
          onPress={onIncrement}
        >
          <PlusIcon color={colors.text} size={16} />
        </IconButton>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    width: 96,
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: fontSizes.body,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: fontSizes.small,
  },
});
