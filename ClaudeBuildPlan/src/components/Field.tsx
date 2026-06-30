import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';

export type FieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  errorText?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  multiline?: boolean;
};

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  errorText,
  containerStyle,
  labelStyle,
  multiline,
  onFocus,
  onBlur,
  style,
  ...inputProps
}) => {
  const theme = useTheme();
  const t = theme.tokens;
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);

  return (
    <View style={[styles.container, { gap: theme.spacing.sm }, containerStyle]}>
      {label ? (
        <Text
          style={[
            {
              color: t.fg2,
              fontSize: theme.fontSize.sm,
              fontFamily: theme.fonts.sansSemibold,
              fontWeight: '600',
            },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={t.fgMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            minHeight: multiline ? 96 : theme.spacing.tapMin,
            paddingHorizontal: theme.spacing.base,
            paddingVertical: multiline ? theme.spacing.md : 0,
            backgroundColor: t.bgCard,
            borderColor: hasError ? t.error : focused ? t.focus : t.borderStrong,
            borderWidth: focused || hasError ? 2 : 1,
            borderRadius: theme.radii.md,
            fontSize: theme.fontSize.base,
            fontFamily: theme.fonts.sans,
            color: t.fg1,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
      {hasError ? (
        <Text style={{ color: t.error, fontSize: theme.fontSize.sm }}>{errorText}</Text>
      ) : hint ? (
        <Text style={{ color: t.fg3, fontSize: theme.fontSize.sm }}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
});
