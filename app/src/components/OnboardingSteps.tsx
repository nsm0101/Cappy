import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { useTheme } from '@/theme';

export type OnboardingStepsProps = {
  hasFamily: boolean;
  hasChild: boolean;
  hasWeight: boolean;
  hasDose: boolean;
  onCreateFamily: () => void;
  onAddChild: () => void;
  onAddWeight: () => void;
  onLogDose: () => void;
};

type Step = {
  id: 'family' | 'child' | 'weight' | 'dose';
  label: string;
  completed: boolean;
  onPress: () => void;
};

export const OnboardingSteps: React.FC<OnboardingStepsProps> = ({
  hasFamily,
  hasChild,
  hasWeight,
  hasDose,
  onCreateFamily,
  onAddChild,
  onAddWeight,
  onLogDose,
}) => {
  const theme = useTheme();
  const t = theme.tokens;

  const steps: Step[] = [
    {
      id: 'family',
      label: 'Create your family',
      completed: hasFamily,
      onPress: onCreateFamily,
    },
    {
      id: 'child',
      label: 'Add your first child',
      completed: hasChild,
      onPress: onAddChild,
    },
    {
      id: 'weight',
      label: 'Record a current weight — dosing depends on it',
      completed: hasWeight,
      onPress: onAddWeight,
    },
    {
      id: 'dose',
      label: 'Log a first dose (tap a Cappy tag or use Log a dose)',
      completed: hasDose,
      onPress: onLogDose,
    },
  ];

  return (
    <Card style={{ marginBottom: theme.spacing.lg }}>
      <Text
        style={{
          color: t.fg1,
          fontFamily: theme.fonts.displaySemibold,
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          marginBottom: theme.spacing.md,
        }}
      >
        Get set up
      </Text>
      <View style={{ gap: theme.spacing.sm }}>
        {steps.map((step) => (
          <StepRow key={step.id} step={step} theme={theme} />
        ))}
      </View>
    </Card>
  );
};

type StepRowProps = {
  step: Step;
  theme: ReturnType<typeof useTheme>;
};

const StepRow: React.FC<StepRowProps> = ({ step, theme }) => {
  const t = theme.tokens;

  if (step.completed) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={t.success}
        />
        <Text
          style={{
            color: t.fgMuted,
            fontSize: theme.fontSize.sm,
            flex: 1,
          }}
        >
          {step.label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={step.onPress}
      accessibilityRole="button"
      accessibilityLabel={step.label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons
        name="ellipse-outline"
        size={20}
        color={t.fgMuted}
      />
      <Text
        style={{
          color: t.fg1,
          fontSize: theme.fontSize.sm,
          flex: 1,
        }}
      >
        {step.label}
      </Text>
    </Pressable>
  );
};
