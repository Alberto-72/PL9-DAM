import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

const API_URL = 'http://10.102.7.185:3001/api/verificar-tarjeta'; 

export default function ScannerScreen({ route, navigation }) {
  const [alumno, setAlumno] = useState(null);
  const [escaneando, setEscaneando] = useState(false);

  useEffect(() => {
    async function initNfc() {
      try {
        const supported = await NfcManager.isSupported();
        if (supported) await NfcManager.start();
      } catch (ex) {
        console.warn("Error iniciando NFC:", ex)
      }
    }
    initNfc();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  useEffect(() => {
    if (route.params?.studentToValidate) {
      procesarValidacion(route.params.studentToValidate);
      navigation.setParams({ studentToValidate: undefined });
    }
  }, [route.params?.studentToValidate]);

  const esMayorDeEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return false;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad >= 18;
  };

  const procesarValidacion = (datosAlumno) => {
    const esAdulto = esMayorDeEdad(datosAlumno.fechaNacimiento);
    
    if (esAdulto) {
      setAlumno({ ...datosAlumno, autorizado: true, estado: 'exito', mensajeEstado: 'AUTORIZADO' });
      return;
    }

    if (datosAlumno.tieneTransporte) {
      setAlumno({ ...datosAlumno, autorizado: true, estado: 'precaucion', mensajeEstado: 'Menor con permiso de transporte' });
      return;
    }

    Alert.alert(
      "Control de Menores",
      `El alumno ${datosAlumno.nombre} es menor y NO tiene transporte.\n\n¿Va acompañado de un adulto?`,
      [
        {
          text: "NO - Denegar",
          style: "destructive",
          onPress: () => setAlumno({ ...datosAlumno, autorizado: false, estado: 'error', mensajeEstado: 'Salida denegada' })
        },
        {
          text: "SÍ - Autorizar",
          onPress: () => setAlumno({ ...datosAlumno, autorizado: true, estado: 'precaucion', mensajeEstado: 'Autorizado por adulto' })
        }
      ]
    );
  };

  const leerNFC = async () => {
    try {
      setEscaneando(true);
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() =>
        NfcManager.requestTechnology(NfcTech.NfcA)
      );
      const tag = await NfcManager.getTag();
      console.log("AQUI SI LLEGO")
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarjetaId: tag.id })
      });
      console.log(response)
      const data = await response.json();
      
      if (data.success) {
        procesarValidacion({
          nombre: data.nombre,
          curso: data.curso || 'Sin curso asignado',
          cursoCompleto: data.cursoCompleto,
          foto: data.foto || null,
          fechaNacimiento: data.fechaNacimiento,
          tieneTransporte: data.tieneTransporte
        });
      } else {
        setAlumno({ nombre: 'Desconocido', curso: 'UID: ' + tag.id, autorizado: false, estado: 'error', mensajeEstado: 'NO REGISTRADO' });
      }
    } catch (networkError) {
      Alert.alert("Error", "No se puede conectar con el servidor.");
    } finally {
      NfcManager.cancelTechnologyRequest();
      setEscaneando(false);
    }
  };

  if (!alumno) {
    return (
      <View style={styles.container}>
        <View style={styles.cajaBlanca}>
          <View style={[styles.circuloIcono, escaneando && styles.circuloIconoActivo]}>
            <Ionicons name={escaneando ? "hourglass-outline" : "radio-outline"} size={80} color={escaneando ? "#15803D" : "#2563EB"} style={!escaneando && { transform: [{ rotate: '90deg' }] }} />
          </View>
          <Text style={styles.tituloVacio}>{escaneando ? "Conectando..." : "Control de Acceso"}</Text>
          <Text style={styles.subtituloVacio}>{escaneando ? "Validando..." : "Pulsa y acerca la tarjeta."}</Text>

          {!escaneando ? (
            <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
              <Ionicons name="radio" size={30} color="white" style={{ marginRight: 10, transform: [{ rotate: '90deg' }] }} />
              <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.botonGrande, { backgroundColor: '#EF4444' }]} onPress={() => { NfcManager.cancelTechnologyRequest(); setEscaneando(false); }}>
              <Text style={styles.textoBotonGrande}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  let badgeStyle = alumno.estado === 'error' ? styles.badgeError : alumno.estado === 'precaucion' ? styles.badgePrecaucion : styles.badgeExito;
  let textStyle = alumno.estado === 'error' ? styles.textoError : alumno.estado === 'precaucion' ? styles.textoPrecaucion : styles.textoExito;
  let iconName = alumno.estado === 'error' ? "close-circle" : alumno.estado === 'precaucion' ? "alert-circle" : "checkmark-circle";
  let iconColor = alumno.estado === 'error' ? "#DC2626" : alumno.estado === 'precaucion' ? "#A16207" : "#15803D";

  return (
    <View style={styles.container}>
      <View style={styles.tarjeta}>
        <View style={[styles.avatar, { borderColor: alumno.estado === 'error' ? "#DC2626" : alumno.estado === 'precaucion' ? "#FACC15" : "#4ADE80" }]}>
          {alumno.foto ? (
            <Image source={{ uri: `data:image/png;base64,${alumno.foto}` }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={60} color={alumno.autorizado ? "#9CA3AF" : "#DC2626"} />
          )}
        </View>
        <Text style={styles.nombreAlumno}>{alumno.nombre}</Text>
        <Text style={styles.cursoAlumno}>{alumno.curso}</Text>
        <View style={badgeStyle}>
          <Ionicons name={iconName} size={24} color={iconColor} style={{ marginRight: 8 }} />
          <Text style={textStyle}>{alumno.mensajeEstado}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.botonSiguiente} onPress={() => setAlumno(null)}>
        <Ionicons name="arrow-forward" size={24} color="white" style={{ marginRight: 10 }} />
        <Text style={styles.textoBotonSiguiente}>Leer Siguiente</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 20, justifyContent: 'center' },
  cajaBlanca: { backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5 },
  circuloIcono: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circuloIconoActivo: { backgroundColor: '#DCFCE7' },
  tituloVacio: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 10 },
  subtituloVacio: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 30 },
  botonGrande: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textoBotonGrande: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  tarjeta: { backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', marginBottom: 16, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  nombreAlumno: { fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  cursoAlumno: { fontSize: 16, color: '#6B7280', marginBottom: 20 },
  badgeExito: { flexDirection: 'row', backgroundColor: '#DCFCE7', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoExito: { color: '#15803D', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  badgeError: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoError: { color: '#DC2626', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  badgePrecaucion: { flexDirection: 'row', backgroundColor: '#FEF9C3', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoPrecaucion: { color: '#A16207', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  botonSiguiente: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textoBotonSiguiente: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});