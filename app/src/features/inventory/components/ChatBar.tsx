import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { IconButton } from '../../../components/IconButton';
import { PlusIcon } from '../../../components/PlusIcon';
import {
  colors,
  fontSizes,
  radii,
  spacing,
  touchTarget,
} from '../../../theme/tokens';

const MAX_LINES = 4;
const LINE_HEIGHT = 22;

export function ChatBar({
  onSubmit,
  onAddPress,
}: {
  /** Receives the typed request. Will send it to Llama; currently a no-op. */
  onSubmit: (text: string) => void;
  onAddPress: () => void;
}): React.JSX.Element {
  const [text, setText] = useState('');

  return (
    <View style={styles.container}>
      <TextInput
        testID="chat-input"
        accessibilityLabel="Ask or tell me something"
        placeholder="Ask or tell me something…"
        placeholderTextColor={colors.placeholder}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => onSubmit(text)}
        submitBehavior="submit"
        returnKeyType="send"
        multiline
        style={styles.input}
      />
      <IconButton
        testID="add-item-button"
        accessibilityLabel="Add item"
        variant="primary"
        onPress={onAddPress}
      >
        <PlusIcon color={colors.onPrimary} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: touchTarget,
    maxHeight: MAX_LINES * LINE_HEIGHT + 2 * spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSizes.body,
    lineHeight: LINE_HEIGHT,
    textAlignVertical: 'center',
  },
});
