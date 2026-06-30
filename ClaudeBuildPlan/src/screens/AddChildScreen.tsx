import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Button, Field, Sheet } from '@/components';
import { children as childrenApi } from '@/api';
import { useTheme } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'AddChild'>;

const formatDateToYYYYMMDD = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const AddChildScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { familyId } = route.params;

  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date>(new Date());
  const [weightLb, setWeightLb] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError, setNameError] = useState('');
  const [weightError, setWeightError] = useState('');

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Name is required.');
      return;
    }
    setNameError('');

    let weightGrams: number | null = null;
    if (weightLb.trim()) {
      const parsedWeight = parseFloat(weightLb);
      if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
        setWeightError('Please enter a valid weight (greater than 0).');
        return;
      }
      weightGrams = Math.round(parsedWeight * 453.59237);
      setWeightError('');
    }

    setLoading(true);
    try {
      const dobString = formatDateToYYYYMMDD(dob);
      const child = await childrenApi.createChild({
        familyId,
        displayName: trimmedName,
        dateOfBirth: dobString,
      });

      if (weightGrams !== null) {
        await childrenApi.recordWeight(child.id, weightGrams);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add child.';
      Alert.alert('Error', message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xxl,
            fontWeight: '800',
            marginBottom: theme.spacing.sm,
          }}
        >
          Add a child
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
          {"Enter your child's profile details to calculate dosage limits and track their medications."}
        </Text>

        <View style={{ gap: theme.spacing.lg }}>
          <Field
            label="Display Name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (text.trim()) setNameError('');
            }}
            placeholder="e.g. Tommy"
            editable={!loading}
            errorText={nameError}
            accessibilityLabel="Child's display name"
            accessibilityHint="Enter the name of the child"
          />

          <Pressable onPress={() => !loading && setShowDatePicker(true)}>
            <View pointerEvents="none">
              <Field
                label="Date of Birth"
                value={dob.toLocaleDateString()}
                editable={false}
                placeholder="Select date"
                accessibilityLabel={`Date of birth. Currently selected: ${dob.toLocaleDateString()}`}
                accessibilityHint="Toggles birthdate calendar picker"
              />
            </View>
          </Pressable>

          <Field
            label="Weight (optional, lb)"
            value={weightLb}
            onChangeText={(text) => {
              setWeightLb(text);
              setWeightError('');
            }}
            placeholder="e.g. 24"
            keyboardType="numeric"
            editable={!loading}
            errorText={weightError}
            accessibilityLabel="Child's weight in pounds"
            accessibilityHint="Enter child's weight in pounds if known"
          />
        </View>

        <View style={{ height: theme.spacing.xxl }} />

        <Button
          label={loading ? 'Adding…' : 'Add child'}
          onPress={handleSave}
          disabled={loading}
          loading={loading}
          block
          accessibilityLabel="Save Child Button"
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
      </ScrollView>

      {/* Date Picker Sheet for iOS */}
      {Platform.OS === 'ios' ? (
        <Sheet visible={showDatePicker} onClose={() => setShowDatePicker(false)}>
          <Text
            style={{
              color: t.fg1,
              fontFamily: theme.fonts.display,
              fontSize: theme.fontSize.lg,
              fontWeight: '700',
              marginBottom: theme.spacing.md,
              textAlign: 'center',
            }}
          >
            Select Date of Birth
          </Text>
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={dob}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, selectedDate) => {
                if (selectedDate) setDob(selectedDate);
              }}
              textColor={t.fg1}
            />
          </View>
          <View style={{ height: theme.spacing.base }} />
          <Button
            label="Done"
            onPress={() => setShowDatePicker(false)}
            block
          />
        </Sheet>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={dob}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDob(selectedDate);
            }}
          />
        )
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  datePickerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
