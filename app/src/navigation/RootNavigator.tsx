import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { linkingConfig } from './linking';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isLoading, isSignedIn } = useAuth();
  const theme = useTheme();
  const t = theme.tokens;
  const isDark = theme.mode === 'dark';

  const navTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: t.bg,
      card: t.bgCard,
      text: t.fg,
      border: t.border,
      primary: t.brand,
    },
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.brand} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} linking={linkingConfig}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isSignedIn ? (
          <RootStack.Screen name="App" component={AppNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
