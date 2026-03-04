import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../views/auth/LoginScreen'; 
import TeacherTabs from './TeacherTabs';
import DirectiveTabs from './DirectiveTabs';

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
        ) : userRole === 'directiva' ? (
          <Stack.Screen name="DirectiveApp" component={DirectiveTabs} />
        ) : (
          <Stack.Screen name="TeacherApp" component={TeacherTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}