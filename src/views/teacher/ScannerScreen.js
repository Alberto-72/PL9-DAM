import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Platform, SafeAreaView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

const NODE_SERVER_URL = 'http://10.102.8.22:3001';

export default function ScannerScreen({ route, navigation }) {
  const [alumno, setAlumno] = useState(null);
  const [escaneando, setEscaneando] = useState(false);

  // Enables mode for checking students in the school guard post
  const esModoGuardiaDirectiva = route.params?.modoGuardia === true;

  useEffect(() => {
    async function initNfc() {
      try {
        if (Platform.OS !== 'web' && NfcManager) {
            const supported = await NfcManager.isSupported();
            if (supported) await NfcManager.start();
        }
      } catch (ex) {
        console.warn("Error iniciando NFC:", ex)
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
      const datosManuales = route.params.studentToValidate;
      procesarValidacion({
        nombre: datosManuales.nombre,
        curso: datosManuales.cursoCorto || datosManuales.curso,
        foto: datosManuales.foto || null,
        fechaNacimiento: datosManuales.fechaNacimiento,
        tieneTransporte: datosManuales.tieneTransporte
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

  const procesarValidacion = (datosAlumno) => {
    const esAdulto = esMayorDeEdad(datosAlumno.fechaNacimiento);
    
    // Calcular minutos actuales para las comparaciones de hora
    const now = new Date();
    const hora = now.getHours();
    const minutos = now.getMinutes();
    const totalMinutos = hora * 60 + minutos;

    const inicioJornada = 8 * 60; // 08:00 -> 480
    const finJornada = 14 * 60;   // 14:00 -> 840
    const inicioRecreo = 10 * 60 + 45; // 10:45 -> 645
    const finRecreo = 11 * 60 + 20;    // 11:20 -> 680
    const horaTransporte = 13 * 60 + 50; // 13:50 -> 830

    const fueraDeHorario = totalMinutos < inicioJornada || totalMinutos > finJornada;
    const esRecreo = totalMinutos >= inicioRecreo && totalMinutos <= finRecreo;
    const esHoraTransporte = totalMinutos >= horaTransporte;

    // Si está fuera del horario restringido (antes de las 08:00 o después de las 14:00), se acepta la salida a cualquiera
    if (fueraDeHorario) {
      const newStudentState = { ...datosAlumno, autorizado: true, estado: 'exito', mensajeEstado: 'anticipada' };
      setAlumno(newStudentState);
      addRegister(newStudentState.uid, newStudentState.usr_type, newStudentState.mensajeEstado);
      return;
    }

    // Si es mayor de edad:
    if (esAdulto) {
      if (esRecreo) {
        const newStudentState = { ...datosAlumno, autorizado: true, estado: 'exito', mensajeEstado: 'recreo' };
        setAlumno(newStudentState);
        addRegister(newStudentState.uid, newStudentState.usr_type, newStudentState.mensajeEstado);
      } else if (datosAlumno.tieneTransporte && esHoraTransporte) {
        const newStudentState = { ...datosAlumno, autorizado: true, estado: 'exito', mensajeEstado: 'transporte' };
        setAlumno(newStudentState);
        addRegister(newStudentState.uid, newStudentState.usr_type, newStudentState.mensajeEstado);
      } else {
        const newStudentState = { ...datosAlumno, autorizado: true, estado: 'exito', mensajeEstado: 'anticipada' };
        setAlumno(newStudentState);
        addRegister(newStudentState.uid, newStudentState.usr_type, newStudentState.mensajeEstado);
      }
      return;
    }

    // Si es menor: a la hora del recreo o a cualquier otra hora, no está autorizado salir salvo si va acompañado
    if (Platform.OS === 'web') {
      const confirmado = window.confirm(`Control de Menores\n\nEl alumno ${datosAlumno.nombre} es menor de edad.\n\n¿Va acompañado de un adulto?\n(Aceptar = SÍ / Cancelar = NO)`);
      
      if (confirmado) {
        const newStudentState = { ...datosAlumno, autorizado: true, estado: 'precaucion', mensajeEstado: esRecreo ? 'recreo' : 'anticipada' };
        setAlumno(newStudentState);
        addRegister(datosAlumno.uid, datosAlumno.usr_type, newStudentState.mensajeEstado);
      } else {
        const newStudentState = { ...datosAlumno, autorizado: false, estado: 'error', mensajeEstado: 'error' };
        setAlumno(newStudentState);
        addRegister(datosAlumno.uid, datosAlumno.usr_type, newStudentState.mensajeEstado);
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
              const newStudentState = { ...datosAlumno, autorizado: false, estado: 'error', mensajeEstado: 'error' }
              setAlumno(newStudentState)
              addRegister(datosAlumno.uid, datosAlumno.usr_type, newStudentState.mensajeEstado)
            }
          },
          {
            text: "SÍ - Autorizar",
            onPress: () => {
              const newStudentState = { ...datosAlumno, autorizado: true, estado: 'precaucion', mensajeEstado: esRecreo ? 'recreo' : 'anticipada' }
              setAlumno(newStudentState)
              addRegister(datosAlumno.uid, datosAlumno.usr_type, newStudentState.mensajeEstado)
            }
          }
        ]
      );
    }
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

      console.log(`USB Decimal: ${uidWeb} | Hex Corregido: ${hexInvertido}`);

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
        setAlumno({ nombre: 'Desconocido', curso: 'UID: ' + hexInvertido, autorizado: false, estado: 'error', mensajeEstado: 'NO REGISTRADO' });
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
    if (Platform.OS === 'web') {
        Alert.alert("NFC No Disponible", "El escaneo NFC solo funciona en dispositivos móviles.");
        return;
    }
    try {
      setEscaneando(true);
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() =>
        NfcManager.requestTechnology(NfcTech.NfcA)
      );
      const tag = await NfcManager.getTag();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarjetaId: tag.id })
      });
      const data = await response.json();
      if (data.success) {
        procesarValidacion({
          nombre: data.nombre,
          curso: data.curso || 'Sin curso',
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
      if (NfcManager) NfcManager.cancelTechnologyRequest();
      setEscaneando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* CABECERA DE CONVERSIÓN: Indica que estás en modo profesorado */}
      {esModoGuardiaDirectiva && (
        <View style={styles.headerModoGuardia}>
          <View>
            <Text style={styles.txtModo}>MODO PROFESORADO</Text>
            <Text style={styles.txtSubModo}>Control de Guardia Activo</Text>
          </View>
          <TouchableOpacity 
            style={styles.btnSalirModo} 
            onPress={() => navigation.navigate('Profesores')} 
          >
            <Feather name="log-out" size={16} color="white" />
            <Text style={styles.textBtnSalir}> SALIR</Text>
          </TouchableOpacity>
        </View>
      )}

      {!alumno ? (
        <View style={styles.cajaBlanca}>
          <View style={[styles.circuloIcono, escaneando && styles.circuloIconoActivo]}>
            <Ionicons name={escaneando ? "hourglass-outline" : "radio-outline"} size={80} color={escaneando ? "#15803D" : "#2563EB"} />
          </View>
          <Text style={styles.tituloVacio}>{escaneando ? "Conectando..." : "Escáner de Guardia"}</Text>
          <Text style={styles.subtituloVacio}>Pase la tarjeta por el lector o use la búsqueda manual.</Text>

          {!escaneando ? (
            <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
              <Ionicons name="radio" size={30} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.botonGrande, { backgroundColor: '#EF4444' }]} onPress={() => setEscaneando(false)}>
              <Text style={styles.textoBotonGrande}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.tarjetaAlumnoContainer}>
          <View style={styles.tarjeta}>
            <View style={[styles.avatar, { borderColor: alumno.estado === 'error' ? "#DC2626" : "#15803D" }]}>
              {alumno.foto ? (
                <Image source={{ uri: `data:image/png;base64,${alumno.foto}` }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={60} color="#9CA3AF" />
              )}
            </View>
            <Text style={styles.nombreAlumno}>{alumno.nombre}</Text>
            <Text style={styles.cursoAlumno}>{alumno.curso}</Text>
            
            <View style={alumno.estado === 'error' ? styles.badgeError : alumno.estado === 'precaucion' ? styles.badgePrecaucion : styles.badgeExito}>
               <Text style={alumno.estado === 'error' ? styles.textoError : alumno.estado === 'precaucion' ? styles.textoPrecaucion : styles.textoExito}>
                 {alumno.mensajeEstado}
               </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.botonSiguiente} onPress={() => setAlumno(null)}>
            <Text style={styles.textoBotonSiguiente}>SIGUIENTE / LISTO</Text>
            <Ionicons name="arrow-forward" size={24} color="white" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center' },
  cajaBlanca: { backgroundColor: 'white', margin: 20, padding: 30, borderRadius: 20, alignItems: 'center', elevation: 4 },
  circuloIcono: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circuloIconoActivo: { backgroundColor: '#DCFCE7' },
  tituloVacio: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 10 },
  subtituloVacio: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 30 },
  botonGrande: { backgroundColor: '#2563EB', flexDirection: 'row', padding: 18, borderRadius: 15, width: '100%', justifyContent: 'center', alignItems: 'center' },
  textoBotonGrande: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  tarjetaAlumnoContainer: { padding: 20 },
  tarjeta: { backgroundColor: 'white', padding: 25, borderRadius: 25, alignItems: 'center', elevation: 8 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 5, marginBottom: 15, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  nombreAlumno: { fontSize: 26, fontWeight: 'bold', color: '#111827' },
  cursoAlumno: { fontSize: 18, color: '#6B7280', marginBottom: 20 },
  badgeExito: { backgroundColor: '#DCFCE7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  textoExito: { color: '#15803D', fontWeight: 'bold', fontSize: 18 },
  badgeError: { backgroundColor: '#FEF2F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  textoError: { color: '#DC2626', fontWeight: 'bold', fontSize: 18 },
  badgePrecaucion: { backgroundColor: '#FEF9C3', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, elevation: 2 },
  textoPrecaucion: { color: '#A16207', fontWeight: 'bold', fontSize: 16 },
  botonSiguiente: { backgroundColor: '#2563EB', marginTop: 20, flexDirection: 'row', padding: 18, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  textoBotonSiguiente: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});