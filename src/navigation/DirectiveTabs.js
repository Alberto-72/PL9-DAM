import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import DashboardScreen from '../views/directive/DashboardScreen';
import ListScreen from '../views/directive/ListScreen';
import NFCBindingScreen from '../views/directive/NFCBindingScreen';
import SettingsScreen from '../views/teacher/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function DirectiveTabs({ route }) {
  const { username } = route.params || {};   // solo username (sin función)

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
          if (route.name === 'Panel') iconName = 'bar-chart-2';
          else if (route.name === 'Alumnado') iconName = 'users';
          else if (route.name === 'Profesores') iconName = 'user';
          else if (route.name === 'NFC') iconName = 'link';
          else if (route.name === 'Ajustes') iconName = 'settings';
          return <Feather name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Panel" component={DashboardScreen} options={{ title: 'Estadísticas' }}/>
      
      <Tab.Screen 
        name="Alumnado" 
        component={ListScreen} 
        initialParams={{ type: 'alumnado' }} 
      />
      <Tab.Screen 
        name="Profesores" 
        component={ListScreen} 
        initialParams={{ type: 'profesorado' }} 
      />
      
      <Tab.Screen name="NFC" component={NFCBindingScreen} options={{ title: 'Vincular NFC' }}/>

      <Tab.Screen 
        name="Ajustes" 
        component={SettingsScreen} 
        options={{ title: 'Mi Perfil' }} 
        initialParams={{ username }} 
        key={`ajustes-directiva-${username || 'no-user'}`}
      />
    </Tab.Navigator>
  );
}