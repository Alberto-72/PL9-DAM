import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../views/auth/LoginScreen'; 
import TeacherTabs from './TeacherTabs';
import DirectiveTabs from './DirectiveTabs';
import { AuthProvider } from '../context/AuthContext';   // nuevo

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [userToken, setUserToken] = useState(null); 
  const [userRole, setUserRole] = useState(null);
  const [username, setUsername] = useState(null);

  const handleLogin = (token, role, username) => {
    setUserToken(token);
    setUserRole(role);
    setUsername(username);
  };

  const handleLogout = () => {
    setUserToken(null);
    setUserRole(null);
    setUsername(null);
  };

  return (
    <NavigationContainer>
      <AuthProvider username={username} role={userRole} onLogout={handleLogout}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userToken == null ? (
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
              initialParams={{ onLogin: handleLogin }}
            />
          ) : userRole === 'directiva' ? (
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
        </Stack.Navigator>
      </AuthProvider>
    </NavigationContainer>
  );
}