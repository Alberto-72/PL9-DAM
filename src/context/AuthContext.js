import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children, username: initialUsername, role: initialRole, onLogout: parentLogout }) => {
  // saves username globally after login
  const [username, setUsername] = useState(initialUsername);
  const [role, setRole] = useState(initialRole);

  useEffect(() => {
    setUsername(initialUsername);
    setRole(initialRole);
  }, [initialUsername, initialRole]);

  const logout = () => {
    setUsername(null);
    setRole(null);
    if (parentLogout) parentLogout();
  };

  return (
    <AuthContext.Provider value={{ username, role, onLogout: logout }}>
      {children}
    </AuthContext.Provider>
  );
};