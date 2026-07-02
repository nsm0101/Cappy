import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { useTheme } from '@/theme';
import { Sheet } from './Sheet';
import { Field } from './Field';
import { Button } from './Button';
import { Segmented } from './Segmented';

export type InputSheetProps = {
  visible: boolean;
  title: string;
  hint?: string;
  initialValue?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Return an error string to block submit, or null if valid. */
  validate?: (value: string) => string | null;
  submitLabel?: string;           // default 'Save'
  onSubmit: (value: string) => void | Promise<void>;
  onClose: () => void;
  /** Optional unit segmented control rendered above the field. */
  segments?: {
    options: ReadonlyArray<{ label: string; value: string }>;
    value: string;
    onChange: (v: string) => void;
  };
};

/**
 * InputSheet: a reusable input dialog built on Sheet + Field + Button.
 * Validates live after first submit attempt; disables submit while async operation is pending.
 */
export const InputSheet: React.FC<InputSheetProps> = ({
  visible,
  title,
  hint,
  initialValue = '',
  placeholder,
  keyboardType,
  validate,
  submitLabel = 'Save',
  onSubmit,
  onClose,
  segments,
}) => {
  const theme = useTheme();

  const [value, setValue] = useState(initialValue);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset local state whenever the sheet is (re)opened or the seed changes.
  React.useEffect(() => {
    setValue(initialValue);
    setAttempted(false);
  }, [initialValue, visible]);

  const errorText = attempted ? (validate?.(value) ?? undefined) : undefined;

  const handleSubmit = useCallback(async () => {
    setAttempted(true);
    const validationError = validate?.(value);
    if (validationError) {
      return; // Block submit, show error
    }
    setSubmitting(true);
    try {
      await onSubmit(value);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [value, validate, onSubmit, onClose]);

  const handleClose = useCallback(() => {
    setAttempted(false);
    setValue(initialValue);
    onClose();
  }, [initialValue, onClose]);

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      variant="center"
      accessibilityLabel={title}
    >
      <View style={{ gap: theme.spacing.md }}>
        {/* Segments (optional) */}
        {segments ? (
          <Segmented
            options={segments.options}
            value={segments.value}
            onChange={segments.onChange}
            accessibilityLabel={title}
          />
        ) : null}

        {/* Field */}
        <Field
          label={title}
          hint={hint}
          errorText={errorText}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          keyboardType={keyboardType}
          editable={!submitting}
          selectTextOnFocus
          autoFocus={visible}
        />

        {/* Action buttons */}
        <View style={[styles.buttons, { gap: theme.spacing.sm }]}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={handleClose}
            block
            disabled={submitting}
            accessibilityLabel="Cancel input"
          />
          <Button
            label={submitLabel}
            variant="primary"
            onPress={handleSubmit}
            block
            loading={submitting}
            disabled={submitting || (attempted && !!errorText)}
            accessibilityLabel={`${submitLabel} input`}
          />
        </View>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
