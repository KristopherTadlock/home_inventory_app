import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ItemNotFoundError,
  ItemValidationError,
  type InventoryItem,
  type InventoryRepository,
  type ItemField,
} from '../data/InventoryRepository';
import {
  MAX_QUANTITY,
  STARTER_LOCATIONS,
  parseQuantity,
  validateItemForm,
  type FieldErrors,
  type ItemFormValues,
} from '../domain/validation';

const NEW_ITEM_VALUES: ItemFormValues = {
  name: '',
  location: '',
  quantity: '1',
  expirationDate: null,
};

function initialValues(item: InventoryItem | undefined): ItemFormValues {
  return item
    ? {
        name: item.name,
        location: item.location,
        quantity: String(item.quantity),
        expirationDate: item.expirationDate,
      }
    : NEW_ITEM_VALUES;
}

export interface ItemFormState {
  /** True when editing an existing item rather than adding one. */
  editing: boolean;
  /** The item being edited, as stored; undefined when adding. */
  item: InventoryItem | undefined;
  values: ItemFormValues;
  /** Errors to display: a field's error shows once it has been blurred or after Save. */
  errors: FieldErrors;
  locationSuggestions: string[];
  canSave: boolean;
  /** True while a save or delete is in flight. */
  saving: boolean;
  /** True after Delete was pressed once and is waiting for confirmation. */
  confirmingDelete: boolean;
  setName: (text: string) => void;
  setLocation: (text: string) => void;
  setQuantityText: (text: string) => void;
  incrementQuantity: () => void;
  decrementQuantity: () => void;
  setExpirationDate: (date: string | null) => void;
  blur: (field: ItemField) => void;
  submit: () => Promise<void>;
  /** Asks for confirmation; only an edited item can be deleted. */
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

/**
 * State for the item form, which adds an item or, given `item`, edits or deletes it.
 * Validation mirrors the core so errors appear without a round trip; errors the core
 * still reports are mapped back onto their field. If the edited item no longer exists,
 * `onGone` is called instead. Storage failures are fatal and handled by the guarded
 * repository.
 */
export function useItemForm({
  repository,
  item,
  onSaved,
  onDeleted = () => {},
  onGone = () => {},
}: {
  repository: InventoryRepository;
  /** The item to edit; omitted when adding. */
  item?: InventoryItem;
  onSaved: (item: InventoryItem) => void;
  onDeleted?: (item: InventoryItem) => void;
  onGone?: () => void;
}): ItemFormState {
  const [values, setValues] = useState(() => initialValues(item));
  const [touched, setTouched] = useState<Partial<Record<ItemField, boolean>>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [coreErrors, setCoreErrors] = useState<FieldErrors>({});
  const [existingLocations, setExistingLocations] = useState<string[] | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    repository.listLocations().then(
      locations => active && setExistingLocations(locations),
      () => {},
    );
    return () => {
      active = false;
    };
  }, [repository]);

  const validationErrors = useMemo(() => validateItemForm(values), [values]);

  const errors = useMemo(() => {
    const visible: FieldErrors = {};
    for (const field of Object.keys(validationErrors) as ItemField[]) {
      if (submitted || touched[field]) {
        visible[field] = validationErrors[field];
      }
    }
    return { ...visible, ...coreErrors };
  }, [validationErrors, coreErrors, submitted, touched]);

  const update = useCallback(
    <K extends keyof ItemFormValues>(field: K, value: ItemFormValues[K]) => {
      setValues(current => ({ ...current, [field]: value }));
      setCoreErrors(({ [field]: _cleared, ...rest }) => rest);
    },
    [],
  );

  const stepQuantity = useCallback(
    (delta: number) => {
      const current = parseQuantity(values.quantity) ?? 0;
      const next = Math.min(MAX_QUANTITY, Math.max(1, current + delta));
      update('quantity', String(next));
    },
    [values.quantity, update],
  );

  const submit = useCallback(async () => {
    setSubmitted(true);
    if (saving || Object.keys(validationErrors).length > 0) {
      return;
    }
    setSaving(true);
    const fields = {
      name: values.name.trim(),
      location: values.location.trim(),
      quantity: parseQuantity(values.quantity)!,
      expirationDate: values.expirationDate,
    };
    try {
      onSaved(
        item
          ? await repository.updateItem(item.id, fields)
          : await repository.addItem(fields),
      );
    } catch (error) {
      if (error instanceof ItemValidationError) {
        setCoreErrors(current => ({
          ...current,
          [error.field]: error.message,
        }));
      } else if (error instanceof ItemNotFoundError) {
        onGone();
      }
      // Anything else is a storage failure: the error screen is taking over.
    } finally {
      setSaving(false);
    }
  }, [saving, validationErrors, repository, item, values, onSaved, onGone]);

  const confirmDelete = useCallback(async () => {
    if (!item || saving) {
      return;
    }
    setSaving(true);
    try {
      await repository.deleteItem(item.id);
      onDeleted(item);
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        onGone();
      }
      // Anything else is a storage failure: the error screen is taking over.
    } finally {
      setSaving(false);
    }
  }, [item, saving, repository, onDeleted, onGone]);

  return {
    editing: item !== undefined,
    item,
    values,
    errors,
    locationSuggestions:
      existingLocations === null
        ? []
        : existingLocations.length > 0
        ? existingLocations
        : STARTER_LOCATIONS,
    canSave:
      values.name.trim() !== '' && values.location.trim() !== '' && !saving,
    saving,
    confirmingDelete,
    setName: text => update('name', text),
    setLocation: text => update('location', text),
    setQuantityText: text => update('quantity', text.replace(/[^0-9]/g, '')),
    incrementQuantity: () => stepQuantity(1),
    decrementQuantity: () => stepQuantity(-1),
    setExpirationDate: date => update('expirationDate', date),
    blur: field => setTouched(current => ({ ...current, [field]: true })),
    submit,
    requestDelete: () => {
      if (item) {
        setConfirmingDelete(true);
      }
    },
    cancelDelete: () => setConfirmingDelete(false),
    confirmDelete,
  };
}
