import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';

const ALUMNOS_URL = 'http://10.102.6.247:3001/api/alumnos';

const MAPA_CURSOS = {
  '1ESO': '1º ESO',
  '2ESO': '2º ESO',
  '3ESO': '3º ESO',
  '4ESO': '4º ESO',
  '1BACH': '1º Bachillerato',
  '2BACH': '2º Bachillerato',
  '1CFGM_SM': '1º CFGM Ciclo Medio SMYR',
  '2CFGM_SM': '2º CFGM Ciclo Medio SMYR',
  '1CFGS_CS_DAM': '1º CFGS Ciclo Superior DAM',
  '2CFGS_CS_DAM': '2º CFGS Ciclo Superior DAM',
  '1CFGS_GFMN': '1º CFGS Gestión Forestal y del Medio Natural',
  '2CFGS_GFMN': '2º CFGS Gestión Forestal y del Medio Natural'
};

export default function StudentsListScreen({ navigation, route }) {
  const [listaAlumnos, setListaAlumnos] = useState([]);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  useEffect(() => {
    const esDesdeDirectiva = route.params?.origin === 'directiva';

    navigation.setOptions({
      headerLeft: () => esDesdeDirectiva ? (
        <TouchableOpacity 
          style={styles.btnSalir} 
          onPress={() => navigation.navigate('Panel')} 
        >
          <Feather name="arrow-left" size={18} color="white" />
          <Text style={styles.txtSalir}> Salir de Guardia</Text>
        </TouchableOpacity>
      ) : null,
    });
  }, [navigation, route.params]);

  //Si entramos desde directiva, mostramos un boton "Salir de Guardia" en la cabecera para volver al panel
  useEffect(() => {
    const esDesdeDirectiva = route.params?.origin === 'directiva';

    navigation.setOptions({
      headerLeft: () => esDesdeDirectiva ? (
        <TouchableOpacity
          style={styles.btnSalir}
          onPress={() => navigation.navigate('Panel')}
        >
          <Feather name="arrow-left" size={18} color="white" />
          <Text style={styles.txtSalir}> Salir de Guardia</Text>
        </TouchableOpacity>
      ) : null,
    });
  }, [navigation, route.params]);

  //Carga de alumnos desde el backend. El backend devuelve datos crudos de Odoo,
  //asi que aqui los formateamos para que la UI pueda mostrarlos directamente.
  useEffect(() => {
    const cargarAlumnos = async () => {
      try {
        setCargandoAlumnos(true);
        const response = await fetch(ALUMNOS_URL);
        const data = await response.json();
        
        if (data.success) {
            const alumnosFormateados = data.alumnos.map(a => ({
                ...a,
                nombreCompleto: `${a.name} ${a.surname || ''}`.trim(),
                cursoTexto: MAPA_CURSOS[a.school_year] || a.school_year || 'Sin curso',
                emailValidado: (a.email && a.email !== false && a.email !== "false") ? a.email : 'Sin email'
            }));
            setListaAlumnos(alumnosFormateados);
        }
      } catch (err) {
        console.error("Error en la carga de alumnado"); 
      } finally {
        setCargandoAlumnos(false);
      }
    };
    cargarAlumnos();
  }, []);

  const alumnosFiltrados = listaAlumnos.filter(a =>
    a.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase())
  );

  //Al seleccionar un alumno, lo pasamos al scanner con los campos que este espera
  const seleccionarDeLista = (item) => {
    navigation.navigate('Escáner', { 
      studentToValidate: {
        id: item.id,
        nombre: item.nombreCompleto,
        cursoCorto: item.school_year,
        tieneTransporte: item.can_bus,
        foto: item.photo,
        email: item.emailValidado || 'Sin email'
      } 
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => seleccionarDeLista(item)} activeOpacity={0.7}>
      <View style={styles.alumnoFila}>
        <View style={styles.alumnoFotoContenedor}>
          {item.photo && item.photo !== false ? (
            <Image 
                source={{ uri: `data:image/png;base64,${item.photo}` }} 
                style={styles.alumnoFoto}
                resizeMode="cover"
            />
          ) : (
            <View style={styles.alumnoFotoPlaceholder}>
              <Ionicons name="person" size={26} color="#9CA3AF" />
            </View>
          )}
        </View>

        <View style={styles.alumnoInfo}>
          <Text style={styles.alumnoListaNombre} numberOfLines={1}>{item.nombreCompleto}</Text>
          <Text style={styles.alumnoListaCurso} numberOfLines={2}>{item.cursoTexto}</Text>
        </View>

        <View style={styles.busIndicator}>
            <FontAwesome5 
                name="bus" 
                size={14} 
                color={item.can_bus ? "#22C55E" : "#EF4444"} 
            />
            <Text style={[styles.busText, { color: item.can_bus ? "#22C55E" : "#EF4444" }]}>
                {item.can_bus ? 'BUS' : 'NO'}
            </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );

  if (cargandoAlumnos) return <View style={styles.centrado}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.buscadorContenedor}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.buscadorInput}
          placeholder="Buscar alumno..."
          placeholderTextColor="#9CA3AF"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      <FlatList
        data={alumnosFiltrados}
        keyExtractor={(item) => (item.id || Math.random()).toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnSalir: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginLeft: 10, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    borderRadius: 8 
  },
  txtSalir: { color: 'white', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
  buscadorContenedor: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginTop: 20, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  buscadorInput: { flex: 1, fontSize: 16, color: '#1F2937' },
  alumnoFila: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 22, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  alumnoFotoContenedor: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', overflow: 'hidden', marginRight: 14, borderWidth: 2, borderColor: '#F3F4F6' },
  alumnoFoto: { width: '100%', height: '100%' },
  alumnoFotoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  alumnoInfo: { flex: 1 },
  alumnoListaNombre: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  alumnoListaCurso: { fontSize: 12, color: '#6B7280', fontWeight: '500', lineHeight: 16 },
  busIndicator: { alignItems: 'center', justifyContent: 'center', minWidth: 40, marginRight: 10 },
  busText: { fontSize: 9, fontWeight: '800', marginTop: 2 }
});