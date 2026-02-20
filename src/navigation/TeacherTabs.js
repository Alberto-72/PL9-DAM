import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import ScannerScreen from '../views/teacher/ScannerScreen';
import StudentsListScreen from '../views/teacher/StudentsListScreen';
import SettingsScreen from '../views/teacher/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TeacherTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: '#1D4ED8' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Escáner') iconName = 'radio';
          else if (route.name === 'Alumnos') iconName = 'users';
          else if (route.name === 'Ajustes') iconName = 'settings';
          return <Feather name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Escáner" component={ScannerScreen} options={{ title: 'Control Guardia' }} />
      <Tab.Screen name="Alumnos" component={StudentsListScreen} options={{ title: 'Búsqueda Manual' }} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ title: 'Mi Perfil' }} />
    </Tab.Navigator>
  );
}