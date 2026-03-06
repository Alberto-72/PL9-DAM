import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

// const NODE_SERVER_URL = 'http://192.168.1.10:3001'; 
// const NODE_SERVER_URL = 'http://10.102.7.192:3001';
const NODE_SERVER_URL = 'http://10.102.8.22:3001';

export default function ScannerScreen({ route, navigation }) {
  const [alumno, setAlumno] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [uidWeb, setUidWeb] = useState('');

  useEffect(() => {
    async function initNfc() {
      try {
        if (Platform.OS !== 'web' && NfcManager) {
          const supported = await NfcManager.isSupported();
          if (supported) await NfcManager.start();
        }
      } catch (ex) {
        console.warn("Error iniciando NFC:", ex);
      }
    }
    initNfc();

    return () => {
      if (Platform.OS !== 'web' && NfcManager) {
        NfcManager.cancelTechnologyRequest().catch(() => 0);
      }
    };
  }, []);

  useEffect(() => {
    if (route.params?.studentToValidate) {
      const alumnoManual = route.params.studentToValidate;
      procesarValidacion({
        ...alumnoManual,
        uid: alumnoManual.uid || 'SIN_NFC',
        usr_type: 'alumno'
      });
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

  const addRegister = async (uid, usr_type, mensajeEstado) => {
    try {
      const now = new Date();
      const dateTime = now.toISOString().replace('T', ' ').substring(0, 19);

      await fetch(`${NODE_SERVER_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, usr_type, mensajeEstado, dateTime }),
      });
    } catch (error) {
      console.error("Error saving register:", error);
    }
  };

  const procesarValidacion = (datosAlumno) => {
    const esAdulto = esMayorDeEdad(datosAlumno.fechaNacimiento);
    
    const now = new Date();
    const hora = now.getHours();
    const minutos = now.getMinutes();
    const totalMinutos = hora * 60 + minutos;

    const inicioJornada = 8 * 60;      // 08:00
    const finJornada = 14 * 60;        // 14:00
    const inicioRecreo = 10 * 60 + 45; // 10:45
    const finRecreo = 11 * 60 + 20;    // 11:20
    const horaTransporte = 13 * 60 + 50; // 13:50

    const esRecreo = totalMinutos >= inicioRecreo && totalMinutos <= finRecreo;
    const esHoraTransporte = totalMinutos >= horaTransporte;

    let mensajeEstado = 'error';       // internal key for database
    let displayText = 'Error';         // text shown in the badge
    let autorizado = false;
    let estado = 'error';              // 'exito', 'precaucion', 'error'

    // === BEFORE 08:00 → Salida Antes de las 8 ===
    if (totalMinutos < inicioJornada) {
      mensajeEstado = 'salida_antes_8';
      displayText = 'Salida Antes de las 8';
      autorizado = true;
      estado = 'exito';
    } 
    // === AFTER 14:00 → Autorizado ===
    else if (totalMinutos > finJornada) {
      mensajeEstado = 'autorizado';
      displayText = 'Autorizado';
      autorizado = true;
      estado = 'exito';
    } 
    // === NORMAL HOURS (08:00 - 14:00) ===
    else {
      if (esAdulto) {
        if (esRecreo) {
          mensajeEstado = 'recreo';
          displayText = 'Recreo';
        } else if (datosAlumno.tieneTransporte && esHoraTransporte) {
          mensajeEstado = 'transporte';
          displayText = 'Salida Transporte';
        } else {
          mensajeEstado = 'anticipada';
          displayText = 'Salida Anticipada';
        }
        autorizado = true;
        estado = 'exito';
      } 
      else {
        // === MINOR ===
        if (Platform.OS === 'web') {
          const confirmado = window.confirm(`Control de Menores\n\nEl alumno ${datosAlumno.nombre} es menor de edad.\n\n¿Va acompañado de un adulto?`);
          if (confirmado) {
            mensajeEstado = 'salida_autorizada_anticipada';
            displayText = 'Salida Autorizada Anticipada';
            autorizado = true;
            estado = 'precaucion';
          } else {
            mensajeEstado = 'no_autorizado';
            displayText = 'No Autorizado';
            autorizado = false;
            estado = 'error';
          }
        } else {
          Alert.alert(
            "Control de Menores",
            `El alumno ${datosAlumno.nombre} es menor de edad.\n\n¿Va acompañado de un adulto?`,
            [
              {
                text: "NO - Denegar",
                style: "destructive",
                onPress: () => {
                  const newState = { 
                    ...datosAlumno, 
                    autorizado: false, 
                    estado: 'error', 
                    mensajeEstado: 'no_autorizado',
                    displayText: 'No Autorizado'
                  };
                  setAlumno(newState);
                  addRegister(newState.uid || 'SIN_NFC', newState.usr_type || 'alumno', 'no_autorizado');
                }
              },
              {
                text: "SÍ - Autorizar",
                onPress: () => {
                  const newState = { 
                    ...datosAlumno, 
                    autorizado: true, 
                    estado: 'precaucion', 
                    mensajeEstado: 'salida_autorizada_anticipada',
                    displayText: 'Salida Autorizada Anticipada'
                  };
                  setAlumno(newState);
                  addRegister(newState.uid || 'SIN_NFC', newState.usr_type || 'alumno', 'salida_autorizada_anticipada');
                }
              }
            ]
          );
          return; // exit because Alert is async
        }
      }
    }

    // Save state and register (for non-Alert cases)
    const newStudentState = { 
      ...datosAlumno, 
      autorizado, 
      estado, 
      mensajeEstado,
      displayText 
    };
    setAlumno(newStudentState);
    addRegister(newStudentState.uid || 'SIN_NFC', newStudentState.usr_type || 'alumno', mensajeEstado);
  };

  const procesarLectorWeb = async () => {
    if (!uidWeb) return;
    
    try {
      setEscaneando(true);
      
      let hexOriginal = BigInt(uidWeb).toString(16).padStart(8, '0');
      let byte1 = hexOriginal.substring(6, 8); 
      let byte2 = hexOriginal.substring(4, 6); 
      let byte3 = hexOriginal.substring(2, 4); 
      let byte4 = hexOriginal.substring(0, 2); 
      let hexInvertido = (byte1 + byte2 + byte3 + byte4).toUpperCase(); 

      const response = await fetch(`${NODE_SERVER_URL}/api/verificar-tarjeta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarjetaId: hexInvertido })
      });
      const data = await response.json();
      
      if (data.success) {
        procesarValidacion({
          nombre: data.nombre,
          curso: data.curso || 'Sin curso',
          foto: data.foto || null,
          fechaNacimiento: data.fechaNacimiento,
          tieneTransporte: data.tieneTransporte,
          uid: hexInvertido, 
          usr_type: 'alumno' 
        });
      } else {
        setAlumno({ 
          nombre: 'Desconocido', 
          curso: 'UID: ' + hexInvertido, 
          autorizado: false, 
          estado: 'error', 
          mensajeEstado: 'error',
          displayText: 'No Registrado' 
        });
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se puede conectar con el servidor.");
    } finally {
      setEscaneando(false);
      setUidWeb(''); 
    }
  };

  const leerNFC = async () => {
    if (Platform.OS === 'web') return; 

    try {
      setEscaneando(true);
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() =>
        NfcManager.requestTechnology(NfcTech.NfcA)
      );
      const tag = await NfcManager.getTag();
      const response = await fetch(`${NODE_SERVER_URL}/api/verificar-tarjeta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarjetaId: tag.id })
      });
      const data = await response.json();
      
      if (data.success) {
        procesarValidacion({
          nombre: data.nombre,
          curso: data.curso || 'Sin curso asignado',
          foto: data.foto || null,
          fechaNacimiento: data.fechaNacimiento,
          tieneTransporte: data.tieneTransporte,
          uid: tag.id,
          usr_type: 'alumno'
        });
      } else {
        setAlumno({ 
          nombre: 'Desconocido', 
          curso: 'UID: ' + tag.id, 
          autorizado: false, 
          estado: 'error', 
          mensajeEstado: 'error',
          displayText: 'No Registrado' 
        });
      }
    } catch (networkError) {
      Alert.alert("Error", "No se puede conectar con el servidor.");
    } finally {
      if (NfcManager) NfcManager.cancelTechnologyRequest();
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

          {!escaneando && Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
              <Ionicons name="radio" size={30} color="white" style={{ marginRight: 10, transform: [{ rotate: '90deg' }] }} />
              <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
            </TouchableOpacity>
          )}

          {!escaneando && Platform.OS === 'web' && (
            <TextInput
              style={[styles.botonGrande, { backgroundColor: '#F3F4F6', color: '#1F2937', textAlign: 'center' }]}
              placeholder="Pasa la tarjeta por el lector USB..."
              placeholderTextColor="#9CA3AF"
              value={uidWeb}
              onChangeText={setUidWeb}
              onSubmitEditing={procesarLectorWeb}
              autoFocus={true} 
            />
          )}

          {escaneando && (
            <TouchableOpacity style={[styles.botonGrande, { backgroundColor: '#EF4444' }]} onPress={() => { 
                if (Platform.OS !== 'web' && NfcManager) NfcManager.cancelTechnologyRequest(); 
                setEscaneando(false); 
              }}>
              <Text style={styles.textoBotonGrande}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Dynamic badge styles
  let badgeStyle = styles.badgeExito;
  let textStyle = styles.textoExito;
  let iconName = "checkmark-circle";
  let iconColor = "#15803D";

  if (alumno.mensajeEstado === 'no_autorizado' || alumno.mensajeEstado === 'error') {
    badgeStyle = styles.badgeError;
    textStyle = styles.textoError;
    iconName = "close-circle";
    iconColor = "#DC2626";
  } else if (alumno.mensajeEstado === 'salida_autorizada_anticipada') {
    badgeStyle = styles.badgePrecaucion;
    textStyle = styles.textoPrecaucion;
    iconName = "alert-circle";
    iconColor = "#A16207";
  }

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
          <Text style={textStyle}>{alumno.displayText || alumno.mensajeEstado}</Text>
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