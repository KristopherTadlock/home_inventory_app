import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, hitSlop, radii, touchTarget } from '../theme/tokens';

export interface IconButtonProps {
  accessibilityLabel: string;
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'plain';
  disabled?: boolean;
  testID?: string;
}

export function IconButton({
  accessibilityLabel,
  onPress,
  children,
  variant = 'plain',
  disabled = false,
  testID,
}: IconButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.plain,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  plain: {
    backgroundColor: colors.chip,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
