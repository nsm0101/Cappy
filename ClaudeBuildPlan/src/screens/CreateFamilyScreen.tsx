import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Field } from '@/components';
import { families as familiesApi } from '@/api';
import { useTheme } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export const CreateFamilyScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();

  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleSubmit = async () => {
    const trimmed = familyName.trim();
    if (!trimmed) {
      setErrorText('Family name is required.');
      return;
    }
    setErrorText('');
    setLoading(true);
    try {
      await familiesApi.createFamily(trimmed);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create family.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.container, { padding: theme.spacing.lg }]}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xxl,
            fontWeight: '800',
            marginBottom: theme.spacing.sm,
          }}
        >
          Create a family
        </Text>
        <Text
          style={{
            color: t.fg2,
            fontFamily: theme.fonts.sans,
            fontSize: theme.fontSize.base,
            lineHeight: theme.lineHeight.base,
            marginBottom: theme.spacing.xl,
          }}
        >
          Create a shared family record. You will be able to invite other caregivers to coordinate doses.
        </Text>

        <Field
          label="Family Name"
          value={familyName}
          onChangeText={(text) => {
            setFamilyName(text);
            if (text.trim()) setErrorText('');
          }}
          placeholder="e.g. Smith Family"
          autoFocus
          editable={!loading}
          errorText={errorText}
          accessibilityLabel="Family Name Input Field"
          accessibilityHint="Enter the name for the new family"
        />

        <View style={{ height: theme.spacing.xl }} />

        <Button
          label={loading ? 'Creating…' : 'Create family'}
          onPress={handleSubmit}
          disabled={loading}
          loading={loading}
          block
          accessibilityLabel="Create Family Button"
        />
        <View style={{ height: theme.spacing.sm }} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => navigation.goBack()}
          disabled={loading}
          block
          accessibilityLabel="Cancel Button"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
});
