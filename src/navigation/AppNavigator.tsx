import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/theme';
import HistoryScreen from '../screens/HistoryScreen';
import MedicationDetailScreen from '../screens/MedicationDetailScreen';
import MedicationFormScreen from '../screens/MedicationFormScreen';
import MedicationsScreen from '../screens/MedicationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TodayScreen from '../screens/TodayScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

export default function AppNavigator({ onWiped }: { onWiped: () => void }) {
  const t = useTheme();
  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: t.primary,
      background: t.bg,
      card: t.card,
      text: t.text,
      border: t.border,
    },
  };

  const Tabs = () => (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: t.primary }}>
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: 'Hoje',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Medications"
        component={MedicationsScreen}
        options={{
          title: 'Medicamentos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="pill" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" color={color} size={size} />
          ),
        }}
      >
        {() => <SettingsScreen onWiped={onWiped} />}
      </Tab.Screen>
    </Tab.Navigator>
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="MedicationForm" component={MedicationFormScreen} options={{ title: 'Medicamento' }} />
        <Stack.Screen name="MedicationDetail" component={MedicationDetailScreen} options={{ title: 'Medicamento' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
