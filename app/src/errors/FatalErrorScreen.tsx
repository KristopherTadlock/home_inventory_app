import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { colors, contentMaxWidth, fontSizes, spacing } from '../theme/tokens';

/**
 * Shown instead of the whole app after a storage failure. The only way forward is closing
 * the app; it waits for the user so the message can be read.
 */
export function FatalErrorScreen({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);

  return (
    <View
      testID="fatal-error-screen"
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Something went wrong
        </Text>
        <Text style={styles.message}>
          OPT Home Inventory couldn't read or save your inventory and needs to
          close. Any change you were making was not saved.
        </Text>
        <Button title="Close app" onPress={onClose} testID="close-app-button" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.heading,
    fontWeight: '700',
  },
  message: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    lineHeight: 24,
  },
});
