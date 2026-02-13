//React and React Native main imports
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, StatusBar as RNStatusBar, Alert, Image, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

//Base server URL
const BASE_URL = 'http://10.102.8.22:3001';
//NFC verification endpoint
const API_URL = `${BASE_URL}/api/verificar-tarjeta`;
//Student list endpoint
const ALUMNOS_URL = `${BASE_URL}/api/alumnos`;

//Root component of the application
export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

//Main screen with NFC logic and tab navigation
function MainScreen() {
  const [tabActiva, setTabActiva] = useState(0);
  const [alumno, setAlumno] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  //State for student list tab
  const [listaAlumnos, setListaAlumnos] = useState([]);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
  //State for search filter
  const [busqueda, setBusqueda] = useState('');

  //NFC module initialization on component mount
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

    //Clean up NFC request on unmount
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  //Load student list when switching to tab 1
  useEffect(() => {
    if (tabActiva === 1) {
      cargarAlumnos();
    }
  }, [tabActiva]);

  //Fetch all students from the server
  const cargarAlumnos = async () => {
    try {
      setCargandoAlumnos(true);
      const response = await fetch(ALUMNOS_URL);
      const data = await response.json();
      if (data.success) {
        setListaAlumnos(data.alumnos);
      } else {
        Alert.alert("Error", "No se pudieron cargar los alumnos.");
      }
    } catch (err) {
      console.error("Error cargando alumnos:", err);
      Alert.alert("Error", "No se puede conectar con el servidor.");
    } finally {
      setCargandoAlumnos(false);
    }
  };

  //Filter students by name based on search input
  const alumnosFiltrados = listaAlumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  //Calculate age helper
  const esMayorDeEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return false; //Si no hay fecha, asumimos menor por seguridad
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad >= 18;
  };

  //Core logic for validation (used by both NFC and List Click)
  const procesarValidacion = (datosAlumno) => {
    const esAdulto = esMayorDeEdad(datosAlumno.fechaNacimiento);
    
    //Case 1: Adult (Always authorized - Green)
    if (esAdulto) {
      setAlumno({
        ...datosAlumno,
        autorizado: true,
        estado: 'exito', //green
        mensajeEstado: 'AUTORIZADO'
      });
      setTabActiva(0);
      return;
    }

    //Case 2: Minor with transport (Authorized - Yellow)
    if (datosAlumno.tieneTransporte) {
      setAlumno({
        ...datosAlumno,
        autorizado: true,
        estado: 'precaucion', //yellow
        mensajeEstado: 'Menor de edad con permiso de transporte'
      });
      setTabActiva(0);
      return;
    }

    //Case 3: Minor without transport (Needs popup check)
    //We show the alert first, then set the state based on the answer
    Alert.alert(
      "Control de Menores",
      `El alumno ${datosAlumno.nombre} es menor y NO tiene transporte.\n\n¿Va acompañado de un adulto?`,
      [
        {
          text: "NO - Denegar",
          style: "destructive",
          onPress: () => {
             setAlumno({
              ...datosAlumno,
              autorizado: false,
              estado: 'error', //red
              mensajeEstado: 'Salida denegada'
            });
            setTabActiva(0);
          }
        },
        {
          text: "SÍ - Autorizar",
          onPress: () => {
            setAlumno({
              ...datosAlumno,
              autorizado: true,
              estado: 'precaucion', //yellow
              mensajeEstado: 'Autorizado por acompañamiento de un adulto'
            });
            setTabActiva(0);
          }
        }
      ]
    );
  };

  //Handle click on a student from the list
  const seleccionarDeLista = (item) => {
    procesarValidacion(item);
  };

  //Function that reads the NFC card and queries the server
  const leerNFC = async () => {
    try {
      setEscaneando(true);

      //Try NDEF first, fallback to NfcA
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() =>
        NfcManager.requestTechnology(NfcTech.NfcA)
      );

      //Get tag and its ID
      const tag = await NfcManager.getTag();
      const idLeido = tag.id;
      console.log("ID Leido del chip:", idLeido);

      try {
        //Send UID to server for Odoo verification
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tarjetaId: idLeido })
        });

        const data = await response.json();
        console.log("Respuesta del Servidor:", data);

        //If student exists in Odoo, process logic
        if (data.success) {
          const datosAlumno = {
            nombre: data.nombre,
            curso: data.curso || 'Sin curso asignado',
            cursoCompleto: data.cursoCompleto, //guardamos ambos
            foto: data.foto || null,
            fechaNacimiento: data.fechaNacimiento,
            tieneTransporte: data.tieneTransporte
          };
          
          procesarValidacion(datosAlumno);

        } else {
          //Student not found: show as unknown
          setAlumno({
            nombre: 'Desconocido',
            curso: 'UID: ' + idLeido,
            foto: null,
            autorizado: false,
            estado: 'error',
            mensajeEstado: 'NO REGISTRADO'
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
      //Always release NFC request
      NfcManager.cancelTechnologyRequest();
      setEscaneando(false);
    }
  };

  //Reset state to scan another card
  const reiniciar = () => {
    setAlumno(null);
    setEscaneando(false);
  };

  //Render each student row in the list
  const renderAlumnoItem = ({ item }) => {
    return (
      <TouchableOpacity onPress={() => seleccionarDeLista(item)}>
        <View style={styles.alumnoFila}>
          {/*Student photo or generic icon*/}
          <View style={styles.alumnoFotoContenedor}>
            {item.foto ? (
              <Image
                source={{ uri: `data:image/png;base64,${item.foto}` }}
                style={styles.alumnoFoto}
              />
            ) : (
              <View style={styles.alumnoFotoPlaceholder}>
                <Ionicons name="person" size={30} color="#9CA3AF" />
              </View>
            )}
          </View>
          {/*Student name and full course name*/}
          <View style={styles.alumnoInfo}>
            <Text style={styles.alumnoListaNombre}>{item.nombre}</Text>
            <Text style={styles.alumnoListaCurso}>{item.cursoCompleto || 'Sin curso asignado'}</Text>
          </View>
          {/*Chevron to indicate action*/}
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  //Render content based on active tab and student state
  const renderContent = () => {
    //Tab 0: NFC scan / Result View
    if (tabActiva === 0) {

      //Initial state: waiting for scan
      if (!alumno) {
        return (
          <View style={styles.cajaBlanca}>
            {/*Central icon based on scan state*/}
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
              {escaneando ? "Validando en Odoo..." : "Pulsa y acerca la tarjeta o selecciona de la lista."}
            </Text>

            {/*Button to start NFC scan*/}
            {!escaneando && (
              <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
                <Ionicons name="radio" size={30} color="white" style={{ marginRight: 10, transform: [{ rotate: '90deg' }] }} />
                <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
              </TouchableOpacity>
            )}

            {/*Button to cancel ongoing scan*/}
            {escaneando && (
              <TouchableOpacity style={[styles.botonGrande, { backgroundColor: '#EF4444' }]} onPress={() => {
                NfcManager.cancelTechnologyRequest();
                setEscaneando(false);
              }}>
                <Text style={styles.textoBotonGrande}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      } else {
        //Result state: show student data
        //Determine styles based on 'estado' (exito, error, precaucion)
        let badgeStyle = styles.badgeExito;
        let textStyle = styles.textoExito;
        let iconName = "checkmark-circle";
        let iconColor = "#15803D";
        let avatarBorderColor = "#4ADE80"; //Green default

        if (alumno.estado === 'error') {
            badgeStyle = styles.badgeError;
            textStyle = styles.textoError;
            iconName = "close-circle";
            iconColor = "#DC2626";
            avatarBorderColor = "#DC2626";
        } else if (alumno.estado === 'precaucion') {
            badgeStyle = styles.badgePrecaucion;
            textStyle = styles.textoPrecaucion;
            iconName = "alert-circle";
            iconColor = "#A16207"; //Dark Yellow/Brown
            avatarBorderColor = "#FACC15"; //Yellow
        }

        return (
          <>
            <View style={styles.tarjeta}>
              {/*Avatar: dynamic border color*/}
              <View style={[styles.avatar, { borderColor: avatarBorderColor }]}>
                {alumno.foto ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${alumno.foto}` }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={60} color={alumno.autorizado ? "#9CA3AF" : "#DC2626"} />
                )}
              </View>

              {/*Student full name*/}
              <Text style={styles.nombreAlumno}>{alumno.nombre}</Text>

              {/*Student school year (short nomenclature e.g. "2DAM")*/}
              <Text style={styles.cursoAlumno}>{alumno.curso}</Text>

              {/*Dynamic Status badge*/}
              <View style={badgeStyle}>
                <Ionicons name={iconName} size={24} color={iconColor} style={{ marginRight: 8 }} />
                <Text style={textStyle}>{alumno.mensajeEstado || "ESTADO DESCONOCIDO"}</Text>
              </View>
            </View>

            {/*Button to scan next card*/}
            <TouchableOpacity style={styles.botonSiguiente} onPress={reiniciar}>
              <Ionicons name="arrow-forward" size={24} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.textoBotonSiguiente}>Leer Siguiente</Text>
            </TouchableOpacity>
          </>
        );
      }
    }

    //Tab 1: Registered students list
    if (tabActiva === 1) {
      //Loading state
      if (cargandoAlumnos) {
        return (
          <View style={styles.centrado}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.textoCargando}>Cargando alumnos...</Text>
          </View>
        );
      }

      //Empty state (no students at all)
      if (listaAlumnos.length === 0) {
        return (
          <View style={styles.centrado}>
            <Ionicons name="people-outline" size={60} color="#9CA3AF" />
            <Text style={styles.textoVacio}>No hay alumnos registrados</Text>
          </View>
        );
      }

      //Student list with search bar
      return (
        <View style={styles.listaContenedor}>
          {/*Search input to filter students by name - Added Margin Top*/}
          <View style={styles.buscadorContenedor}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.buscadorIcono} />
            <TextInput
              style={styles.buscadorInput}
              placeholder="Buscar alumno..."
              placeholderTextColor="#9CA3AF"
              value={busqueda}
              onChangeText={setBusqueda}
              autoCorrect={false}
            />
            {/*Clear search button*/}
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/*No results for current search*/}
          {alumnosFiltrados.length === 0 ? (
            <View style={styles.centrado}>
              <Ionicons name="search-outline" size={50} color="#9CA3AF" />
              <Text style={styles.textoVacio}>Sin resultados para "{busqueda}"</Text>
            </View>
          ) : (
            <FlatList
              data={alumnosFiltrados}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderAlumnoItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listaScroll}
            />
          )}
        </View>
      );
    }

    //Tab 2: Settings (coming soon)
    return <View style={styles.centrado}><Text>Proximamente...</Text></View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#2563EB" />

      {/*Application header*/}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Control Guardia</Text>
        <Text style={styles.headerSubtitle}>IES San Juan de la Rambla</Text>
      </View>

      {/*Main content area*/}
      <View style={styles.content}>{renderContent()}</View>

      {/*Bottom navigation bar with 3 tabs*/}
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

//Application styles
const styles = StyleSheet.create({
  //Main container
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0
  },
  //Blue header with rounded bottom corners
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
  //Central content area
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: -30 },
  //White card for initial scan state
  cajaBlanca: {
    backgroundColor: 'white', width: '100%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  //NFC icon circle
  circuloIcono: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circuloIconoActivo: { backgroundColor: '#DCFCE7' },
  //Initial state texts
  tituloVacio: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 10 },
  subtituloVacio: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 30 },
  //Main scan button
  botonGrande: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textoBotonGrande: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  //Student result card
  tarjeta: { backgroundColor: 'white', width: '100%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, marginBottom: 20 },
  //Circular avatar with dynamic border
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', marginBottom: 16, overflow: 'hidden' },
  //Avatar image (student photo from Odoo)
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  //Student name on scan screen
  nombreAlumno: { fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  //Student school year on scan screen (short nomenclature)
  cursoAlumno: { fontSize: 16, color: '#6B7280', marginBottom: 20 },
  
  //Green authorized badge
  badgeExito: { flexDirection: 'row', backgroundColor: '#DCFCE7', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoExito: { color: '#15803D', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  
  //Red denied badge
  badgeError: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoError: { color: '#DC2626', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  
  //Yellow caution badge (new)
  badgePrecaucion: { flexDirection: 'row', backgroundColor: '#FEF9C3', padding: 10, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  textoPrecaucion: { color: '#A16207', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },

  //Scan next card button
  botonSiguiente: { backgroundColor: '#2563EB', flexDirection: 'row', width: '100%', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  textoBotonSiguiente: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  //Bottom navigation bar
  footer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: 60 },
  //Centered container for loading and empty states
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textoCargando: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  textoVacio: { fontSize: 16, color: '#9CA3AF', marginTop: 12 },
  //Student list container
  listaContenedor: { flex: 1, width: '100%' },
  listaScroll: { paddingBottom: 20 },
  //Search bar container
  buscadorContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 20, //Added margin top as requested
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  //Search icon
  buscadorIcono: { marginRight: 8 },
  //Search text input
  buscadorInput: { flex: 1, fontSize: 16, color: '#1F2937', padding: 0 },
  //Student row in the list
  alumnoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  //Student photo container in list
  alumnoFotoContenedor: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', marginRight: 12 },
  //Student photo in list
  alumnoFoto: { width: '100%', height: '100%', borderRadius: 25 },
  //Placeholder when no photo available
  alumnoFotoPlaceholder: { width: '100%', height: '100%', borderRadius: 25, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  //Student info container (name + full course name)
  alumnoInfo: { flex: 1 },
  //Student name in list
  alumnoListaNombre: { fontSize: 16, fontWeight: '600', color: '#111827' },
  //Student full course name in list
  alumnoListaCurso: { fontSize: 13, color: '#6B7280', marginTop: 2 }
});