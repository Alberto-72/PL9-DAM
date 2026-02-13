import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, StatusBar as RNStatusBar, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const API_URL = 'http://10.102.8.22:3001/api/verificar-tarjeta';

export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

function MainScreen() {
  const [tabActiva, setTabActiva] = useState(0);
  const [alumno, setAlumno] = useState(null); 
  const [escaneando, setEscaneando] = useState(false);

  useEffect(() => {
    async function initNfc() {
      try {
        const supported = await NfcManager.isSupported();
        if (supported) {
          await NfcManager.start();
        } else {
          Alert.alert("Aviso", "Tu dispositivo no soporta NFC.");
        }
      } catch (ex) {
        console.warn("Error iniciando NFC:", ex);
      }
    }
    initNfc();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  const leerNFC = async () => {
    try {
      setEscaneando(true);
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() => 
         NfcManager.requestTechnology(NfcTech.NfcA)
      );

      const tag = await NfcManager.getTag();
      const idLeido = tag.id;
      console.log("ID Leído del chip:", idLeido);

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tarjetaId: idLeido })
        });

        const data = await response.json();
        console.log("Respuesta del Servidor:", data);

        if (data.success) {
          setAlumno({
            nombre: data.nombre,
            curso: data.curso,
            foto: data.foto || null,
            autorizado: true
          });
        } else {
          setAlumno({
            nombre: 'Desconocido',
            curso: 'UID: ' + idLeido,
            autorizado: false
          });
        }

      } catch (networkError) {
        console.error("Error de red:", networkError);
        Alert.alert("Error", "No se puede conectar con el servidor.");
      }

    } catch (ex) {
      console.warn("NFC Cancelado o Error:", ex);
      setEscaneando(false);
    } finally {
      NfcManager.cancelTechnologyRequest();
      setEscaneando(false);
    }
  };

  const reiniciar = () => {
    setAlumno(null);
    setEscaneando(false);
  };

  const renderContent = () => {
    if (tabActiva === 0) {
      if (!alumno) {
        return (
          <View style={styles.cajaBlanca}>
            <View style={[styles.circuloIcono, escaneando && styles.circuloIconoActivo]}>
              <Ionicons 
                name={escaneando ? "hourglass-outline" : "radio-outline"} 
                size={80} 
                color={escaneando ? "#15803D" : "#2563EB"} 
                style={!escaneando && { transform: [{ rotate: '90deg' }] }}
              />
            </View>
            <Text style={styles.tituloVacio}>
              {escaneando ? "Conectando..." : "Control de Acceso"}
            </Text>
            <Text style={styles.subtituloVacio}>
              {escaneando ? "Validando en Odoo..." : "Pulsa y acerca la tarjeta."}
            </Text>

            {!escaneando && (
              <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
                <Ionicons name="radio" size={30} color="white" style={{marginRight: 10, transform: [{ rotate: '90deg' }]}} />
                <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
              </TouchableOpacity>
            )}

            {escaneando && (
              <TouchableOpacity style={[styles.botonGrande, {backgroundColor: '#EF4444'}]} onPress={() => {
                  NfcManager.cancelTechnologyRequest();
                  setEscaneando(false);
              }}>
                <Text style={styles.textoBotonGrande}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      } else {
        return (
          <>
            <View style={styles.tarjeta}>
              <View style={[styles.avatar, !alumno.autorizado && {borderColor: '#DC2626', borderWidth: 2}]}>
                {alumno.foto ? (
                  <Image 
                    source={{ uri: `data:image/png;base64,${alumno.foto}` }} 
                    style={styles.avatarImage} 
                  />
                ) : (
                  <Ionicons name="person" size={60} color={!alumno.autorizado ? "#DC2626" : "#9CA3AF"} />
                )}
              </View>
              
              <Text style={styles.nombreAlumno}>{alumno.nombre}</Text>
              <Text style={styles.cursoAlumno}>{alumno.curso}</Text>

              {alumno.autorizado ? (
                <View style={styles.badgeExito}>
                  <Ionicons name="checkmark-circle" size={24} color="#15803D" style={{marginRight: 8}} />
                  <Text style={styles.textoExito}>AUTORIZADO</Text>
                </View>
              ) : (
                <View style={styles.badgeError}>
                  <Ionicons name="close-circle" size={24} color="#DC2626" style={{marginRight: 8}} />
                  <Text style={styles.textoError}>NO REGISTRADO</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.botonSiguiente} onPress={reiniciar}>
              <Ionicons name="arrow-forward" size={24} color="white" style={{marginRight: 10}} />
              <Text style={styles.textoBotonSiguiente}>Leer Siguiente</Text>
            </TouchableOpacity>
          </>
        );
      }
    }
    return <View style={styles.cajaVacia}><Text>Próximamente...</Text></View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#2563EB" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Control Guardia</Text>
        <Text style={styles.headerSubtitle}>IES San Juan de la Rambla</Text>
      </View>
      <View style={styles.content}>{renderContent()}</View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => setTabActiva(0)} style={styles.tabItem}>
          <Ionicons name="radio" size={28} color={tabActiva === 0 ? "#2563EB" : "#9CA3AF"} style={{ transform: [{ rotate: '90deg' }] }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTabActiva(1)} style={styles.tabItem}>
          <Ionicons name="people" size={28} color={tabActiva === 1 ? "#2563EB" : "#9CA3AF"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTabActiva(2)} style={styles.tabItem}>
          <Ionicons name="settings" size={28} color={tabActiva === 2 ? "#2563EB" : "#9CA3AF"} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  //contenedor principal
  container: { 
    flex: 1, 
    backgroundColor: '#F3F4F6', 
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 
  },

  //header
  header: { 
    backgroundColor: '#2563EB', 
    padding: 20, 
    paddingBottom: 40, 
    borderBottomLeftRadius: 20, 
    borderBottomRightRadius: 20, 
    alignItems: 'center',
    zIndex: 10
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 14, color: '#E0E7FF', marginTop: 4 },

  //content area
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: -30 },
  cajaBlanca: { 
    backgroundColor: 'white', width: '100%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  cajaVacia: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  //circular icon
  circuloIcono: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circuloIconoActivo: { backgroundColor: '#DCFCE7' },

  //texts
  tituloVacio: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 10 },
  subtituloVacio: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 30 },

  //buttons
  botonGrande: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textoBotonGrande: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  botonSiguiente: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  textoBotonSiguiente: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  //student card
  tarjeta: { backgroundColor: 'white', width: '100%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', marginBottom: 16, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  nombreAlumno: { fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  cursoAlumno: { fontSize: 16, color: '#6B7280', marginBottom: 20 },

  //badges
  badgeExito: { flexDirection: 'row', backgroundColor: '#DCFCE7', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoExito: { color: '#15803D', fontWeight: 'bold', fontSize: 16 },
  badgeError: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoError: { color: '#DC2626', fontWeight: 'bold', fontSize: 16 },

  //navigation footer
  footer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: 60 },
});