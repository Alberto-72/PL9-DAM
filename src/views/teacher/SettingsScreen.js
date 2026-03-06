import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';   // nuevo

// const NODE_SERVER_URL = 'http://192.168.1.10:3001';
// const NODE_SERVER_URL = 'http://10.102.7.192:3001';
const NODE_SERVER_URL = 'http://10.102.8.22:3001';

export default function SettingsScreen() {
  const { username, onLogout } = useAuth();   // ahora viene del contexto global

  const [userData, setUserData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);

  // DEBUG
  console.log('DEBUG SettingsScreen - username desde contexto global:', username);

  useEffect(() => {
    console.log('DEBUG SettingsScreen - useEffect triggered con username:', username);
    if (username && username !== 'null' && username !== 'undefined' && username.trim() !== '') {
      fetchUserProfile();
    } else {
      setLoadingProfile(false);
    }
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      console.log('DEBUG SettingsScreen - pestaña Ajustes enfocada, username:', username);
      if (username && username !== 'null' && username !== 'undefined' && username.trim() !== '') {
        fetchUserProfile();
      }
      return () => {
        console.log('DEBUG SettingsScreen - pestaña Ajustes desenfocada');
      };
    }, [username])
  );

  const fetchUserProfile = async () => {
    if (!username || username === 'null' || username === 'undefined' || username.trim() === '') {
      console.log('DEBUG SettingsScreen - username inválido, saltando petición al servidor');
      setLoadingProfile(false);
      return;
    }

    console.log(`DEBUG SettingsScreen - Iniciando fetchUserProfile para username: ${username}`);

    try {
      const response = await fetch(`${NODE_SERVER_URL}/api/user/${username}`);
      const data = await response.json();
      
      console.log('DEBUG SettingsScreen - Respuesta completa del servidor /api/user:', data);

      if (data.success) {
        setUserData(data.user);
      } else {
        console.warn('Error al cargar perfil:', data.message);
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Por favor, rellena ambos campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    if (!username) {
      Alert.alert('Error', 'No se ha encontrado el nombre de usuario.');
      return;
    }

    setLoadingPassword(true);

    try {
      const response = await fetch(`${NODE_SERVER_URL}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Éxito', 'La contraseña se ha actualizado correctamente.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Error', data.message || 'No se pudo actualizar la contraseña.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Error al conectar con el servidor.');
    } finally {
      setLoadingPassword(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Cabecera */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name="settings" size={32} color="white" />
          </View>
          <Text style={styles.title}>Ajustes de Perfil</Text>
        </View>

        {/* Tarjeta de Información del Usuario */}
        {userData ? (
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
               <View style={styles.avatarCircle}>
                 <Ionicons name="person" size={36} color="#1D4ED8" />
               </View>
               <View style={styles.profileNameContainer}>
                 <Text style={styles.profileName}>{userData.nombre} {userData.apellidos}</Text>
                 <Text style={styles.profileUsername}>@{userData.username}</Text>
               </View>
            </View>

            <View style={styles.profileInfoRow}>
              <Feather name="shield" size={16} color="#94A3B8" />
              <Text style={styles.profileInfoLabel}>Rol:</Text>
              <Text style={styles.profileInfoValue}>{userData.rol}</Text>
            </View>

            <View style={styles.profileInfoRow}>
              <Feather name="radio" size={16} color="#94A3B8" />
              <Text style={styles.profileInfoLabel}>NFC:</Text>
              <View style={styles.uidBadge}>
                <Text style={styles.uidText}>{userData.uid}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.errorCard}>
            <Feather name="alert-triangle" size={24} color="#EF4444" style={{ marginBottom: 8 }}/>
            <Text style={styles.errorText}>No se pudo cargar la información del perfil.</Text>
            <TouchableOpacity onPress={fetchUserProfile} style={{ marginTop: 10 }}>
              <Text style={{ color: '#1D4ED8', textDecorationLine: 'underline' }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tarjeta de Cambio de Contraseña */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cambiar Contraseña</Text>
          
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color="#CBD5E1" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nueva contraseña"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!loadingPassword}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Feather name="check-circle" size={18} color="#CBD5E1" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirmar contraseña"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loadingPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loadingPassword && styles.buttonDisabled]} 
            onPress={handleChangePassword}
            disabled={loadingPassword}
          >
            {loadingPassword ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.buttonText}>Actualizar Contraseña</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Botón Cerrar Sesión */}
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Feather name="log-out" size={20} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: 'bold' },
  scrollContent: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  iconContainer: { backgroundColor: '#1D4ED8', padding: 12, borderRadius: 16, marginBottom: 12, shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  title: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  
  profileCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 16 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileNameContainer: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  profileUsername: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  profileInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  profileInfoLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748B', marginLeft: 8, width: 50 },
  profileInfoValue: { fontSize: 14, color: '#1E293B', fontWeight: '600', flex: 1 },
  uidBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  uidText: { fontSize: 12, fontWeight: 'bold', color: '#334155' },

  errorCard: { backgroundColor: '#FEF2F2', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
  errorText: { color: '#EF4444', fontWeight: 'bold', textAlign: 'center' },

  card: { backgroundColor: 'white', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 24 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 20 },
  inputWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 16 },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  input: { width: '100%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12, paddingLeft: 40, paddingRight: 16, fontSize: 14, color: '#0F172A', fontWeight: '500', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  button: { width: '100%', backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  buttonDisabled: { backgroundColor: '#93C5FD' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { flexDirection: 'row', width: '100%', backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  logoutText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});