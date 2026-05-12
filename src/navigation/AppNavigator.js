import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../views/auth/LoginScreen';
import TeacherTabs from './TeacherTabs';
import DirectiveTabs from './DirectiveTabs';
import StudentDetailScreen from '../views/directive/StudentDetailScreen';
import TeacherDetailScreen from '../views/directive/TeacherDetailScreen';
import { AuthProvider } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [username, setUsername] = useState(null);

  //Callback que recibe LoginScreen al hacer login con exito
  const handleLogin = (token, role, username) => {
    setUserToken(token);
    setUserRole(role);
    setUsername(username);
  };

  //Callback que se llama desde SettingsScreen via useAuth().onLogout
  const handleLogout = () => {
    setUserToken(null);
    setUserRole(null);
    setUsername(null);
  };

  return (
    <NavigationContainer>
      {/*AuthProvider expone username/role/onLogout a toda la app via useAuth().
         Necesario para que SettingsScreen pueda obtener el username del usuario logueado.*/}
      <AuthProvider username={username} role={userRole} onLogout={handleLogout}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>

          {userToken == null ? (
            //Sin login: solo la pantalla de Login
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              initialParams={{ onLogin: handleLogin }}
            />
          ) : (
            //Con login: pantallas principales segun el rol + pantallas de detalle
            <>
              {userRole === 'directiva' ? (
                <Stack.Screen
                  name="DirectiveApp"
                  component={DirectiveTabs}
                  initialParams={{ username: username }}
                  //La key cambia con el username para forzar remount al cambiar de usuario
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

              {/*Pantallas de detalle (alumno y profesor) accesibles desde ListScreen.
                 Con header visible y boton de Volver.*/}
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