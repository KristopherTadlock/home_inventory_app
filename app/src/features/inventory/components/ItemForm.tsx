import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { colors, fontSizes, radii, spacing } from '../../../theme/tokens';
import type { ItemFormState } from '../hooks/useItemForm';
import { ExpirationField } from './ExpirationField';
import { LocationField } from './LocationField';
import { QuantityStepper } from './QuantityStepper';

/** The item fields and buttons, for adding an item or, with Delete, editing one.
 * Presentational: state comes from useItemForm. */
export function ItemForm({
  form,
  today,
  onCancel,
}: {
  form: ItemFormState;
  today: string;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text
        style={styles.title}
        accessibilityRole="header"
        testID="item-form-title"
      >
        {form.editing ? 'Edit item' : 'Add item'}
      </Text>
      <TextField
        testID="item-name-input"
        label="Item"
        placeholder="e.g. Milk 1 gallon, hammer"
        // When editing, the keyboard stays closed until a field is chosen.
        autoFocus={!form.editing}
        autoCapitalize="sentences"
        value={form.values.name}
        onChangeText={form.setName}
        onBlur={() => form.blur('name')}
        error={form.errors.name}
      />
      <LocationField
        value={form.values.location}
        suggestions={form.locationSuggestions}
        onChangeText={form.setLocation}
        onBlur={() => form.blur('location')}
        error={form.errors.location}
      />
      <QuantityStepper
        value={form.values.quantity}
        onChangeText={form.setQuantityText}
        onIncrement={form.incrementQuantity}
        onDecrement={form.decrementQuantity}
        onBlur={() => form.blur('quantity')}
        error={form.errors.quantity}
      />
      <ExpirationField
        value={form.values.expirationDate}
        today={today}
        onChange={form.setExpirationDate}
      />
      {form.item && form.confirmingDelete ? (
        <DeleteConfirmation name={form.item.name} form={form} />
      ) : (
        <View style={styles.actions} testID="item-form-actions">
          {form.editing && (
            <Button
              title="Delete"
              variant="danger"
              onPress={form.requestDelete}
              disabled={form.saving}
              testID="delete-item-button"
            />
          )}
          <View style={styles.buttonGroup}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              testID="cancel-item-button"
            />
            <Button
              title="Save"
              onPress={form.submit}
              disabled={!form.canSave}
              testID="save-item-button"
            />
          </View>
        </View>
      )}
    </View>
  );
}

/** Second step of Delete, so a stray tap can't remove an item. `name` is the stored
 * name, since that is what gets deleted. */
function DeleteConfirmation({
  name,
  form,
}: {
  name: string;
  form: ItemFormState;
}): React.JSX.Element {
  return (
    <View
      style={styles.confirmation}
      testID="delete-confirmation"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.confirmationText}>
        Delete “{name}” from your inventory? This can't be undone.
      </Text>
      <View style={styles.buttonGroup}>
        <Button
          title="Keep"
          variant="secondary"
          onPress={form.cancelDelete}
          disabled={form.saving}
          testID="cancel-delete-button"
        />
        <Button
          title="Delete"
          variant="danger"
          onPress={form.confirmDelete}
          disabled={form.saving}
          testID="confirm-delete-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.heading,
    fontWeight: '700',
  },
  // Delete sits at the start; the Cancel/Save group sits at the end. When the row is too
  // narrow (small screens, large system fonts) the group wraps below Delete as a unit,
  // and wraps internally if even it doesn't fit.
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginLeft: 'auto',
    flexShrink: 1,
    maxWidth: '100%',
  },
  confirmation: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  confirmationText: {
    color: colors.text,
    fontSize: fontSizes.body,
  },
});
