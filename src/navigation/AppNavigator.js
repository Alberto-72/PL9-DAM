import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../views/auth/LoginScreen'; 
import TeacherTabs from './TeacherTabs';
import DirectiveTabs from './DirectiveTabs';
import StudentDetailScreen from '../views/directive/StudentDetailScreen';
import TeacherDetailScreen from '../views/directive/TeacherDetailScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [userToken, setUserToken] = useState(null); 
  const [userRole, setUserRole] = useState(null);

  const handleLogin = (token, role) => {
    setUserToken(token);
    setUserRole(role);
  };

  return (
    <NavigationContainer>
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
              <Stack.Screen name="DirectiveApp" component={DirectiveTabs} />
            ) : (
              <Stack.Screen name="TeacherApp" component={TeacherTabs} />
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

            {/* AÑADIMOS LA PANTALLA DE PROFESORES */}
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
    </NavigationContainer>
  );
}