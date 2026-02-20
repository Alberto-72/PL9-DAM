import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ALUMNOS_URL = 'http://10.102.7.185:3001/api/alumnos';

export default function StudentsListScreen({ navigation }) {
  const [listaAlumnos, setListaAlumnos] = useState([]);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const cargarAlumnos = async () => {
      try {
        setCargandoAlumnos(true);
        const response = await fetch(ALUMNOS_URL);
        const data = await response.json();
        if (data.success) setListaAlumnos(data.alumnos);
      } catch (err) {
        console.error(err);
      } finally {
        setCargandoAlumnos(false);
      }
    };
    cargarAlumnos();
  }, []);

  const alumnosFiltrados = listaAlumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const seleccionarDeLista = (item) => {
    navigation.navigate('Escáner', { studentToValidate: item });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => seleccionarDeLista(item)}>
      <View style={styles.alumnoFila}>
        <View style={styles.alumnoFotoContenedor}>
          {item.foto ? (
            <Image source={{ uri: `data:image/png;base64,${item.foto}` }} style={styles.alumnoFoto} />
          ) : (
            <View style={styles.alumnoFotoPlaceholder}>
              <Ionicons name="person" size={30} color="#9CA3AF" />
            </View>
          )}
        </View>
        <View style={styles.alumnoInfo}>
          <Text style={styles.alumnoListaNombre}>{item.nombre}</Text>
          <Text style={styles.alumnoListaCurso}>{item.cursoCompleto || 'Sin curso asignado'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
          value={busqueda}
          onChangeText={setBusqueda}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={alumnosFiltrados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buscadorContenedor: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 16, elevation: 2 },
  buscadorInput: { flex: 1, fontSize: 16, color: '#1F2937', padding: 0 },
  alumnoFila: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 8, elevation: 2 },
  alumnoFotoContenedor: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', marginRight: 12 },
  alumnoFoto: { width: '100%', height: '100%', borderRadius: 25 },
  alumnoFotoPlaceholder: { width: '100%', height: '100%', borderRadius: 25, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  alumnoInfo: { flex: 1 },
  alumnoListaNombre: { fontSize: 16, fontWeight: '600', color: '#111827' },
  alumnoListaCurso: { fontSize: 13, color: '#6B7280', marginTop: 2 }
});