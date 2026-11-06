import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  colors,
  fontSizes,
  hitSlop,
  radii,
  spacing,
  touchTarget,
} from '../../../theme/tokens';
import {
  formatPreviewDate,
  isPast,
  isoToLocalDate,
  todayIso,
} from '../domain/dates';

const LABEL = 'Expiration date (optional)';

/**
 * Optional expiration date chosen with the platform date picker: Android's calendar
 * dialog, or an inline calendar on iOS and Windows. Empty means the item does not expire.
 */
export function ExpirationField({
  value,
  today,
  onChange,
}: {
  /** `YYYY-MM-DD`, or null for no expiration. */
  value: string | null;
  today: string;
  onChange: (date: string | null) => void;
}): React.JSX.Element {
  const [inlineOpen, setInlineOpen] = useState(false);
  const pickerValue = isoToLocalDate(value ?? today);

  const handlePicked = (event: DateTimePickerEvent, date?: Date) => {
    setInlineOpen(false);
    if (event.type === 'set' && date) {
      onChange(todayIso(date));
    }
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerValue,
        mode: 'date',
        onChange: handlePicked,
      });
    } else {
      setInlineOpen(current => !current);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{LABEL}</Text>
      <View style={styles.row}>
        <Pressable
          testID="expiration-input"
          accessibilityRole="button"
          accessibilityLabel={`${LABEL}: ${
            value ? formatPreviewDate(value) : 'none'
          }`}
          accessibilityHint="Opens a date picker"
          onPress={open}
          style={styles.field}
        >
          <Text style={value ? styles.value : styles.placeholder}>
            {value ? formatPreviewDate(value) : 'No expiration'}
          </Text>
        </Pressable>
        {value !== null && (
          <Pressable
            testID="clear-expiration"
            accessibilityRole="button"
            accessibilityLabel="Clear expiration date"
            hitSlop={hitSlop}
            onPress={() => onChange(null)}
            style={styles.clear}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>
      {value !== null && isPast(value, today) && (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          Already expired
        </Text>
      )}
      {inlineOpen && Platform.OS !== 'android' && (
        <DateTimePicker
          testID="expiration-picker"
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : undefined}
          value={pickerValue}
          onChange={handlePicked}
        />
      )}
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
  field: {
    flex: 1,
    minHeight: touchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  value: {
    color: colors.text,
    fontSize: fontSizes.body,
  },
  placeholder: {
    color: colors.placeholder,
    fontSize: fontSizes.body,
  },
  clear: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  clearText: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  note: {
    color: colors.warning,
    fontSize: fontSizes.small,
  },
});
