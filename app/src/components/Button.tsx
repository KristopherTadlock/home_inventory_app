import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  colors,
  fontSizes,
  radii,
  spacing,
  touchTarget,
} from '../theme/tokens';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
}: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.title, TITLE_STYLES[variant]]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    minWidth: 96,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
  title: {
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  primaryTitle: {
    color: colors.onPrimary,
  },
  secondaryTitle: {
    color: colors.text,
  },
  dangerTitle: {
    color: colors.onDanger,
  },
});

const TITLE_STYLES = {
  primary: styles.primaryTitle,
  secondary: styles.secondaryTitle,
  danger: styles.dangerTitle,
};
