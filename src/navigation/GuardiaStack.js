import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import ScannerScreen from '../views/teacher/ScannerScreen';
import StudentsListScreen from '../views/teacher/StudentsListScreen';
import SettingsScreen from '../views/teacher/SettingsScreen';
const Tab = createBottomTabNavigator(); 

export default function GuardiaStack({ navigation, route }) {
  const esDesdeDirectiva = route.params?.origin === 'directiva';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1D4ED8' }, 
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: '#1D4ED8',
        headerLeft: () => esDesdeDirectiva ? (
          <TouchableOpacity 
            style={styles.btnSalir} 
            onPress={() => navigation.navigate('Panel')} 
          >
            <Feather name="arrow-left" size={18} color="white" />
            <Text style={styles.txtSalir}> Salir de Guardia</Text>
          </TouchableOpacity>
        ) : null,
      }}
    >
      <Tab.Screen 
        name="Escáner" 
        component={ScannerScreen} 
        options={{ 
          title: 'Control de Acceso', 
          tabBarLabel: 'Escáner',
          tabBarIcon: ({color}) => <Feather name="radio" size={20} color={color}/> 
        }} 
      />
      <Tab.Screen 
        name="BusquedaManual" 
        component={StudentsListScreen} 
        initialParams={{ origin: route.params?.origin }}
        options={{ 
          title: 'Búsqueda Manual', 
          tabBarLabel: 'Alumnos',
          tabBarIcon: ({color}) => <Feather name="users" size={20} color={color}/> 
        }} 
      />
      <Tab.Screen 
        name="MiPerfil" 
        component={SettingsScreen} 
        options={{ 
          title: 'Mi Perfil', 
          tabBarLabel: 'Perfil',
          tabBarIcon: ({color}) => <Feather name="settings" size={20} color={color}/> 
        }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  btnSalir: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginLeft: 15, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingVertical: 5, 
    paddingHorizontal: 10, 
    borderRadius: 8 
  },
  txtSalir: { color: 'white', fontWeight: 'bold', fontSize: 13, marginLeft: 5 }
});