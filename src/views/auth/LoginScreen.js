import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { loginToOdoo } from '../../services/LogInService';

export default function LoginScreen({ route }) {
  const { onLogin } = route.params;
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      
      const userData = await loginToOdoo(username, password);
      if (userData) {
        onLogin(userData.token || 'fake-token', userData.role || 'directiva');
      } else {
        setError('Usuario o contraseña no válidos');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const Wrapper = Platform.OS === 'web' ? View : TouchableWithoutFeedback;
  const wrapperProps = Platform.OS === 'web' ? {} : { onPress: Keyboard.dismiss };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Wrapper {...wrapperProps}>
        <View style={styles.innerContainer}>
          
          <View style={styles.card}>
            {/* Cabecera */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Feather name="bar-chart-2" size={32} color="white" />
              </View>
              <Text style={styles.title}>Panel de Jefatura</Text>
              <Text style={styles.subtitle}>IES San Juan de la Rambla</Text>
            </View>

            {/* Formulario */}
            <View style={styles.form}>
              
              {/* Input Usuario */}
              <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color="#CBD5E1" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Usuario"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {/* Input Contraseña */}
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color="#CBD5E1" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              {/* Mensaje de Error */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Botón de Entrar */}
              <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Entrar</Text>
                )}
              </TouchableOpacity>

            </View>
          </View>

        </View>
      </Wrapper>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    backgroundColor: '#1D4ED8',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 16,
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 40,
    paddingRight: 16,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    // Outline none para web para que no salga el borde azul feo por defecto del navegador
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});