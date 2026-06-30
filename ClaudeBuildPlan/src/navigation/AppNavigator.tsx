import React from 'react';
import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme';
import { TabBar, type TabItem } from '@/components';
import { HomeScreen } from '@/screens/HomeScreen';
import { ScanScreen } from '@/screens/ScanScreen';
import { TimelineScreen } from '@/screens/TimelineScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { DoseSheetScreen } from '@/screens/DoseSheetScreen';
import { CreateFamilyScreen } from '@/screens/CreateFamilyScreen';
import { AcceptInviteScreen } from '@/screens/AcceptInviteScreen';
import { AddChildScreen } from '@/screens/AddChildScreen';
import { ChildDetailScreen } from '@/screens/ChildDetailScreen';

import type { AppStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

// Icon mapping for each tab (inactive / active glyphs).
const TAB_ICONS: Record<
  keyof TabParamList,
  { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }
> = {
  Home: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  ScanTab: { label: 'Scan', icon: 'scan-outline', iconActive: 'scan' },
  Timeline: { label: 'Timeline', icon: 'time-outline', iconActive: 'time' },
  Settings: { label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
};

/** Renders the design-system TabBar from React Navigation tab state. */
const CappyTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const items: TabItem[] = state.routes.map((route, index) => {
    const meta = TAB_ICONS[route.name as keyof TabParamList];
    const isFocused = state.index === index;
    return {
      key: route.key,
      label: meta.label,
      icon: meta.icon,
      iconActive: meta.iconActive,
      active: isFocused,
      onPress: () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      },
    };
  });
  return <TabBar items={items} />;
};

/** The Scan tab — no incoming tag, started manually by the user. */
const ScanTabScreen: React.FC = () => <ScanScreen />;

/**
 * The Scan stack screen — entered via deep link `t/:initialTagUid`.
 * Reads the tag UID from route params and hands it to ScanScreen.
 */
const ScanDeepLinkScreen: React.FC<{
  route: RouteProp<AppStackParamList, 'Scan'>;
}> = ({ route }) => <ScanScreen initialTagUid={route.params?.initialTagUid} />;

const Tabs: React.FC = () => (
  <Tab.Navigator
    screenOptions={{ headerShown: false }}
    tabBar={(props) => <CappyTabBar {...props} />}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="ScanTab" component={ScanTabScreen} />
    <Tab.Screen name="Timeline" component={TimelineScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

export const AppNavigator: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />

      {/* Modal-presentation flows */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="DoseSheet" component={DoseSheetScreen} />
        <Stack.Screen name="CreateFamily" component={CreateFamilyScreen} />
        <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} />
        <Stack.Screen name="AddChild" component={AddChildScreen} />
      </Stack.Group>

      {/* Card-presentation screens */}
      <Stack.Screen name="ChildDetail" component={ChildDetailScreen} />

      {/* Scan via NFC cold-launch — show a header with a Home button so the
          user can always get back to the tabs (this screen lives outside the
          tab navigator, so there's no tab bar otherwise). */}
      <Stack.Screen
        name="Scan"
        component={ScanDeepLinkScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: 'Scan tag',
          headerStyle: { backgroundColor: t.bgCard },
          headerTintColor: t.fg1,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.navigate('Tabs')}
              accessibilityRole="button"
              accessibilityLabel="Go to Home"
              hitSlop={12}
              style={{ paddingHorizontal: 4 }}
            >
              <Ionicons name="home-outline" size={22} color={t.brand} />
            </Pressable>
          ),
        })}
      />
    </Stack.Navigator>
  );
};
