// Persistencia de sesion en base a la plataforma donde se ejecute

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

let asyncStorage = null;
try { // Importamos AsyncStorage dinamicamente si falla significa que esta en web
  asyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  if (Platform.OS !== 'web') {
    console.warn('@react-native-async-storage/async-storage no instalado. Login no persistira en movil.');
  }
}

//API unificada de storage. Siempre async para que el codigo de consumo sea igual
//en web y movil.
const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      try { return window.localStorage.getItem(key); }
      catch { return null; }
    }
    if (!asyncStorage) return null;
    try { return await asyncStorage.getItem(key); }
    catch { return null; }
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(key, value); }
      catch { /* quota o privado */ }
      return;
    }
    if (!asyncStorage) return;
    try { await asyncStorage.setItem(key, value); }
    catch { /* nada */ }
  },
  async removeItem(key) {
    if (Platform.OS === 'web') {
      try { window.localStorage.removeItem(key); }
      catch { /* nada */ }
      return;
    }
    if (!asyncStorage) return;
    try { await asyncStorage.removeItem(key); }
    catch { /* nada */ }
  }
};

const STORAGE_KEY = 'controlAcceso.session'; // Clave bajo la que se guarda el json de la sesion en la memoria

const AuthContext = createContext(); // Contexto para no tener que pasarlo como props entre padres e hijos

export const useAuth = () => { // Hook para consumir el contexto
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

//Cargar sesion guardada al arrancar. Si hay sesion -> auto-login.
//Si no -> mostrar pantalla de login normal.
export const AuthProvider = ({
  children,
  username: initialUsername,
  role: initialRole,
  token: initialToken,
  onLogout: parentLogout,
  onSessionRestored,
}) => {
  const [username, setUsername] = useState(initialUsername);
  const [role, setRole] = useState(initialRole);
  const [token, setToken] = useState(initialToken);
  //hidratando: true mientras leemos el storage al arrancar. Evita un flash de
  //pantalla de login antes de descubrir que ya estabamos logueados.
  const [hidratando, setHidratando] = useState(true);

  //Sincronizar con props (si AppNavigator cambia el username por login normal)
  useEffect(() => {
    setUsername(initialUsername);
    setRole(initialRole);
    setToken(initialToken);
  }, [initialUsername, initialRole, initialToken]);

  //Cargar sesion guardada al montar. Solo una vez.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (!raw) { setHidratando(false); return; }

        const data = JSON.parse(raw);
        if (cancelado) return;

        //Validamos que tenga al menos username y token
        if (data && data.username && data.token) {
          //Notificamos al padre (AppNavigator) para que monte las pantallas correspondientes
          if (onSessionRestored) {
            onSessionRestored(data.token, data.role, data.username);
          }
        }
      } catch (e) {
        console.warn('No se pudo restaurar la sesion:', e.message);
      } finally {
        if (!cancelado) setHidratando(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  //Guardar sesion cuando cambien las credenciales (despues de login normal)
  useEffect(() => {
    if (username && token) {
      const data = { username, role, token };
      storage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => 0);
    }
  }, [username, role, token]);

  const logout = useCallback(async () => {
    //Borramos primero del storage, despues limpiamos el estado
    await storage.removeItem(STORAGE_KEY);
    setUsername(null);
    setRole(null);
    setToken(null);
    if (parentLogout) parentLogout();
  }, [parentLogout]);

  return (
    <AuthContext.Provider value={{ username, role, token, hidratando, onLogout: logout }}>
      {children}
    </AuthContext.Provider>
  );
};