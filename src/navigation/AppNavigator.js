import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import LoginScreen from '../views/auth/LoginScreen';
import TeacherTabs from './TeacherTabs';
import DirectiveTabs from './DirectiveTabs';
import StudentDetailScreen from '../views/directive/StudentDetailScreen';
import TeacherDetailScreen from '../views/directive/TeacherDetailScreen';
import { AuthProvider } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

//============================================
//Lectura directa del storage al arrancar
//
//AuthProvider tambien lee storage, pero necesitamos saber si hay sesion ANTES
//de montar el Navigator: en funcion de eso mostramos Login o TeacherApp/DirectiveApp.
//Por eso lo hacemos tambien aqui.
//
//En web: localStorage (sincrono). En movil: AsyncStorage si esta instalado.
//============================================
let asyncStorage = null;
try {
  asyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) { /* no instalado: degrada a null */ }

const STORAGE_KEY = 'controlAcceso.session';

async function leerSesionGuardada() {
  try {
    let raw = null;
    if (Platform.OS === 'web') {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } else if (asyncStorage) {
      raw = await asyncStorage.getItem(STORAGE_KEY);
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.username && data.token) return data;
    return null;
  } catch (e) {
    return null;
  }
}

export default function AppNavigator() {
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [username, setUsername] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  //Restaurar sesion al arrancar
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const sesion = await leerSesionGuardada();
      if (cancelado) return;
      if (sesion) {
        setUserToken(sesion.token);
        setUserRole(sesion.role);
        setUsername(sesion.username);
      }
      setCargandoSesion(false);
    })();
    return () => { cancelado = true; };
  }, []);

  const handleLogin = useCallback((token, role, username) => {
    setUserToken(token);
    setUserRole(role);
    setUsername(username);
  }, []);

  const handleLogout = useCallback(() => {
    setUserToken(null);
    setUserRole(null);
    setUsername(null);
  }, []);

  //Mostrar splash mientras hidratamos
  if (cargandoSesion) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AuthProvider
        username={username}
        role={userRole}
        token={userToken}
        onLogout={handleLogout}
        //Si el AuthProvider restaura una sesion antes que nosotros (raro pero posible),
        //le permitimos notificarnos. Por simetria.
        onSessionRestored={handleLogin}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userToken == null ? (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              initialParams={{ onLogin: handleLogin }}
            />
          ) : (
            <>
              {userRole === 'directiva' ? (
                <Stack.Screen
                  name="DirectiveApp"
                  component={DirectiveTabs}
                  initialParams={{ username: username }}
                  key={`directive-${username || 'no-user'}`}
                />
              ) : (
                <Stack.Screen
                  name="TeacherApp"
                  component={TeacherTabs}
                  initialParams={{ username: username }}
                  key={`teacher-${username || 'no-user'}`}
                />
              )}

              <Stack.Screen
                name="StudentDetail"
                component={StudentDetailScreen}
                options={{
                  headerShown: true,
                  title: 'Detalle del Alumno',
                  headerBackTitle: 'Volver'
                }}
              />

              <Stack.Screen
                name="TeacherDetail"
                component={TeacherDetailScreen}
                options={{
                  headerShown: true,
                  title: 'Detalle del Profesor',
                  headerBackTitle: 'Volver'
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </AuthProvider>
    </NavigationContainer>
  );
}