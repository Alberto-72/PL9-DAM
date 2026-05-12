import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Image, TextInput, Alert, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fetchOdooData } from '../../services/LogInService';
import * as DocumentPicker from 'expo-document-picker'; 

const API_URL = 'http://10.102.7.2:3001/api';

export default function ListScreen({ route, navigation }) {
  const { type } = route.params;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false); 
  
  const [busqueda, setBusqueda] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');

  const loadData = async () => {
    setLoading(true);
    const isAlumnado = type === 'alumnado';
    const model = isAlumnado ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor'; 
    const fields = isAlumnado 
    ? ["uid", "name", "surname", "school_year", "can_bus", "photo", "birth_date", "email"] 
    : ["uid", "name", "surname", "email", "photo", "username", "birth_date"];

    try {
      const result = await fetchOdooData(model, fields);
      setData(result);
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  };

  //Cargamos alumnos o profesores segun el tipo recibido por params
  useEffect(() => {
    loadData();
  }, [type]);

  // --- LÓGICA DE IMPORTACIÓN CSV ---
  const seleccionarCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/comma-separated-values', // Solo CSV
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const archivo = result.assets[0];
        importarArchivo(archivo);
      }
    } catch (err) {
      console.error("Error al seleccionar archivo:", err);
    }
  };

  const importarArchivo = async (archivo) => {
    setImporting(true);
    const formData = new FormData();
    
    if (Platform.OS === 'web') {
        const response = await fetch(archivo.uri);
        const blob = await response.blob();
        formData.append('archivo', blob, archivo.name);
    } else {
        formData.append('archivo', {
            uri: archivo.uri,
            name: archivo.name,
            type: 'text/csv',
        });
    }

    try {
        const endpoint = type === 'alumnado' ? 'alumnos' : 'profesores';
        const response = await fetch(`${API_URL}/importar-csv/${endpoint}`, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' },
        });

        const resData = await response.json();
        
        if (resData.success) {
            // MOSTRAMOS EL RESULTADO DETALLADO
            const msj = `Importación terminada.\n${resData.message}`;
            if (Platform.OS === 'web') window.alert(msj);
            else Alert.alert("Resultado", msj);
            
            await loadData(); 
        } else {
            alert("Error: " + resData.message);
        }
    } catch (error) {
        console.error(error);
        alert("Fallo en la conexión con el servidor");
    } finally {
        setImporting(false);
    }
};

  const datosFiltrados = data.filter(item => {
    const nombre = item.name ? String(item.name).toLowerCase() : '';
    const apellido = item.surname ? String(item.surname).toLowerCase() : '';
    const curso = item.school_year ? String(item.school_year).toLowerCase() : '';
    const coincideNombre = nombre.includes(busqueda.toLowerCase()) || apellido.includes(busqueda.toLowerCase());
    const coincideCurso = type === 'alumnado' ? curso.includes(cursoFiltro.toLowerCase()) : true;
    return coincideNombre && coincideCurso;
  });

  const irADetalle = (item) => {
    if (type === 'alumnado') navigation.navigate('StudentDetail', { student: item });
    else navigation.navigate('TeacherDetail', { teacher: item });
  };

  const confirmarEliminacion = (item) => {
    const mensaje = `¿Estás seguro de eliminar a ${item.name}?`;
    if (Platform.OS === 'web') {
        if (window.confirm(mensaje)) ejecutarBorrado(item.id);
    } else {
        Alert.alert("⚠️ Eliminar", mensaje, [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: () => ejecutarBorrado(item.id) }
        ]);
    }
  };

  const ejecutarBorrado = async (id) => {
    try {
        const endpoint = type === 'alumnado' ? 'alumnos' : 'profesores';
        await fetch(`${API_URL}/${endpoint}/${id}`, { method: 'DELETE' });
        setData(prevData => prevData.filter(i => i.id !== id));
    } catch (error) { console.error(error); }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.avatarMini}>
          {item.photo && item.photo !== false ? (
            <Image source={{ uri: `data:image/png;base64,${item.photo}` }} style={styles.avatarImage} />
          ) : <Ionicons name="person" size={20} color="#94A3B8" />}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.name} {item.surname || ''}</Text>
            <Text style={[styles.uid, !item.uid && styles.uidMissing]}>{item.uid || 'Sin NFC'}</Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={{ flex: 1 }}>
              {type === 'alumnado' ? (
                <Text style={styles.detailText}>{item.school_year} - {item.can_bus ? '🚌 Bus' : '❌ Sin Bus'}</Text>
              ) : (
                <Text style={styles.detailText}>{item.email || 'Sin email'}</Text>
              )}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity style={styles.btnIconoVerde} onPress={() => irADetalle(item)}>
                <Feather name="edit-2" size={16} color="#059669" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnIconoRojo} onPress={() => confirmarEliminacion(item)}>
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filtrosContenedor}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.buscadorInputWrapper, { flex: 1 }]}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.buscadorInput}
              placeholder="Buscar por nombre..."
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>
          
          {/* BOTÓN CSV */}
          <TouchableOpacity 
            style={styles.btnCSV} 
            onPress={seleccionarCSV} 
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialCommunityIcons name="file-import" size={22} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {type === 'alumnado' && (
          <View style={[styles.buscadorInputWrapper, { marginTop: 8 }]}>
            <Feather name="book" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.buscadorInput}
              placeholder="Filtrar por curso..."
              value={cursoFiltro}
              onChangeText={setCursoFiltro}
            />
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1D4ED8" /></View>
      ) : (
        <FlatList
          data={datosFiltrados}
          keyExtractor={(item) => (item.id || Math.random()).toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
        />
      )}

      {!loading && (
        <TouchableOpacity 
            style={styles.fab} 
            onPress={() => navigation.navigate(type === 'alumnado' ? 'StudentDetail' : 'TeacherDetail', { [type === 'alumnado' ? 'student' : 'teacher']: { isNew: true } })}
        >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.fabText}>Añadir</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Asegúrate de importar esto arriba si no lo tienes:
import { MaterialCommunityIcons } from '@expo/vector-icons';

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  filtrosContenedor: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  buscadorInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  buscadorInput: { flex: 1, fontSize: 15, color: '#1F2937', padding: 0 },
  
  // Botón CSV estilo azul oscuro profesional
  btnCSV: { backgroundColor: '#1E293B', padding: 12, borderRadius: 12, marginLeft: 8, justifyContent: 'center', alignItems: 'center', width: 50 },
  
  listPadding: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, elevation: 2 },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatarMini: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', marginRight: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '700', color: '#1E293B', flex: 1 },
  uid: { fontSize: 10, fontWeight: '800', color: '#1D4ED8', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  uidMissing: { color: '#EF4444', backgroundColor: '#FEF2F2' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  detailText: { fontSize: 12, color: '#64748B' },
  btnIconoVerde: { backgroundColor: '#ECFDF5', padding: 8, borderRadius: 8, marginLeft: 8 },
  btnIconoRojo: { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginLeft: 8 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 5 },
  fabText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 16 }
});