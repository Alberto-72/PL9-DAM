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

//Lectura directa del storage al arrancar
//AuthProvider tambien lee storage, pero necesitamos saber si hay sesion ANTES
//de montar el Navigator: en funcion de eso mostramos Login o TeacherApp/DirectiveApp.
//Por eso lo hacemos tambien aqui.

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
  // Estados locales para mantener la sesion a nivel de enrutador
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [username, setUsername] = useState(null);
  // Mantiene la pantalla en negro o cargando hasta que se termine de leer la sesion
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // Efecto que se ejecuta solo una vez cuando se momnta la aplicacion
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const sesion = await leerSesionGuardada();
      if (cancelado) return;
      if (sesion) { // Si encuentra sesion valida actualiza estados
        setUserToken(sesion.token);
        setUserRole(sesion.role);
        setUsername(sesion.username);
      }
      // Termina prodceso de carga permitiendo que react muestre pantallas
      setCargandoSesion(false);
    })();
    return () => { cancelado = true; };
  }, []);

  // Funcion para inyectar la sesion cuando el uisuario hace login manual
  const handleLogin = useCallback((token, role, username) => {
    setUserToken(token);
    setUserRole(role);
    setUsername(username);
  }, []);

  // Funcion para borrar la sesion de los estados locales
  const handleLogout = useCallback(() => {
    setUserToken(null);
    setUserRole(null);
    setUsername(null);
  }, []);

  // Pantalla de carga inicial mientras cargando sesion sea true
  if (cargandoSesion) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // renderizado del arbol principal de navegacion
  return (
    <NavigationContainer>
      {/* AuthProvider envuelve las rutas para que cualquier pantalla pueda consumir 'useAuth()' */}  
      <AuthProvider
        username={username}
        role={userRole}
        token={userToken}
        onLogout={handleLogout}
        onSessionRestored={handleLogin}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userToken == null ? (
            // Si no hay token lo unico que puede mostrar es el login
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              initialParams={{ onLogin: handleLogin }}
            />
          ) : (
            <>
              {/*Bifurcacion dependiendo del rol de usuario*/}
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
              
              {/* Pantallas de detalle comunes a ambos roles. Se apilan sobre los Tabs cuando se navega hacia ellas. */}
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