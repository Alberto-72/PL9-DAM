import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { fetchOdooData } from '../../services/LogInService';
import { API_ENDPOINTS } from '../../config/api';
import { apiClient } from '../../services/apiClient';

//Mapeo de codigo corto de curso -> texto legible para el usuario.
//Mismo mapa que en StudentsListScreen para mantener consistencia visual.
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

export default function ListScreen({ route, navigation }) {
  const { type } = route.params;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');

  //Helper para mostrar alertas: en web usa window.alert/confirm, en movil usa Alert.alert
  const mostrarAlerta = (titulo, mensaje) => {
    if (Platform.OS === 'web') window.alert(`${titulo}\n\n${mensaje}`);
    else Alert.alert(titulo, mensaje);
  };

  const cargarDatos = async () => {
    setLoading(true);
    const isAlumnado = type === 'alumnado';
    const model = isAlumnado ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor';

    try {
      //fetchOdooData solo recibe el modelo. El backend decide que campos devolver.
      const result = await fetchOdooData(model);
      setData(result);
    } catch (e) {
      console.error("Error cargando datos:", e.message);
    } finally {
      setLoading(false);
    }
  };

  //Cargamos alumnos o profesores segun el tipo recibido por params
  useEffect(() => {
    cargarDatos();
  }, [type]);

  //============================================
  //IMPORTACION CSV
  //============================================

  //Abre el selector de archivos para elegir un CSV
  const seleccionarCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const archivo = result.assets[0];
        await importarArchivo(archivo);
      }
    } catch (err) {
      console.error("Error al seleccionar archivo:", err.message);
      mostrarAlerta('Error', 'No se pudo abrir el selector de archivos.');
    }
  };

  //Envia el archivo CSV al backend como multipart/form-data
  const importarArchivo = async (archivo) => {
    setImporting(true);

    const formData = new FormData();

    //En web, fetch devuelve un Blob a partir de la uri del archivo seleccionado.
    //En movil, FormData acepta directamente el objeto {uri, name, type}.
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
      const tipo = type === 'alumnado' ? 'alumnos' : 'profesores';
      const resData = await apiClient.post(API_ENDPOINTS.IMPORTAR_CSV(tipo), formData);

      if (resData.success) {
        mostrarAlerta('Resultado', `Importación terminada.\n${resData.message}`);
        await cargarDatos();
      } else {
        mostrarAlerta('Error', resData.message || 'No se pudo importar el archivo.');
      }
    } catch (error) {
      console.error('Error importando CSV:', error.message);
      mostrarAlerta('Error', error.message || 'Fallo en la conexión con el servidor.');
    } finally {
      setImporting(false);
    }
  };

  //============================================
  //FILTROS
  //============================================

  const datosFiltrados = data.filter(item => {
    const nombre = item.name ? String(item.name).toLowerCase() : '';
    const apellido = item.surname ? String(item.surname).toLowerCase() : '';
    const curso = item.school_year ? String(item.school_year).toLowerCase() : '';
    const coincideNombre = nombre.includes(busqueda.toLowerCase()) || apellido.includes(busqueda.toLowerCase());
    const coincideCurso = type === 'alumnado' ? curso.includes(cursoFiltro.toLowerCase()) : true;
    return coincideNombre && coincideCurso;
  });

  //============================================
  //NAVEGACION A DETALLE
  //============================================

  const irADetalle = (item) => {
    if (type === 'alumnado') navigation.navigate('StudentDetail', { student: item });
    else navigation.navigate('TeacherDetail', { teacher: item });
  };

  //============================================
  //ELIMINAR
  //============================================

  const confirmarEliminacion = (item) => {
    const mensaje = `¿Estás seguro de eliminar a ${item.name}?`;
    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) ejecutarBorrado(item.id);
    } else {
      Alert.alert('Eliminar', mensaje, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => ejecutarBorrado(item.id) }
      ]);
    }
  };

  const ejecutarBorrado = async (id) => {
    try {
      const endpoint = type === 'alumnado'
        ? API_ENDPOINTS.ALUMNO_BY_ID(id)
        : API_ENDPOINTS.PROFESOR_BY_ID(id);

      await apiClient.delete(endpoint);
      //Optimistic update: quitamos el elemento localmente sin esperar a recargar todo
      setData(prevData => prevData.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error eliminando:', error.message);
      mostrarAlerta('Error', error.message || 'No se pudo eliminar.');
    }
  };

  //============================================
  //RENDER
  //============================================

  const renderItem = ({ item }) => {
    //Traducimos el codigo de curso al texto legible
    const cursoTexto = MAPA_CURSOS[item.school_year] || item.school_year || 'Sin curso';

    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.avatarMini}>
            {item.photo && item.photo !== false ? (
              <Image source={{ uri: `data:image/png;base64,${item.photo}` }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={20} color="#94A3B8" />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name} {item.surname || ''}</Text>
              <Text style={[styles.uid, !item.uid && styles.uidMissing]}>{item.uid || 'Sin NFC'}</Text>
            </View>

            <View style={styles.cardFooter}>
              <View style={{ flex: 1 }}>
                {type === 'alumnado' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.detailText}>{cursoTexto}</Text>
                    <Text style={{ marginHorizontal: 6, color: '#CBD5E1' }}>·</Text>
                    <Feather
                      name="truck"
                      size={12}
                      color={item.can_bus ? '#22C55E' : '#EF4444'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.detailText, { color: item.can_bus ? '#22C55E' : '#EF4444', fontWeight: 'bold' }]}>
                      {item.can_bus ? 'Bus' : 'Sin Bus'}
                    </Text>
                  </View>
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.filtrosContenedor}>

        {/*Fila superior: buscador + boton CSV*/}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.buscadorInputWrapper, { flex: 1 }]}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.buscadorInput}
              placeholder="Buscar por nombre..."
              placeholderTextColor="#9CA3AF"
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>

          <TouchableOpacity
            style={[styles.btnCSV, importing && { opacity: 0.6 }]}
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

        {/*Filtro por curso solo aplicable a alumnado*/}
        {type === 'alumnado' && (
          <View style={[styles.buscadorInputWrapper, { marginTop: 8 }]}>
            <Feather name="book" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.buscadorInput}
              placeholder="Filtrar por curso..."
              placeholderTextColor="#9CA3AF"
              value={cursoFiltro}
              onChangeText={setCursoFiltro}
            />
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <FlatList
          data={datosFiltrados}
          keyExtractor={(item) => (item.id || Math.random()).toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
        />
      )}

      {/*Boton flotante para anadir nuevo alumno/profesor*/}
      {!loading && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate(
            type === 'alumnado' ? 'StudentDetail' : 'TeacherDetail',
            { [type === 'alumnado' ? 'student' : 'teacher']: { isNew: true } }
          )}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.fabText}>Añadir</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filtrosContenedor: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  buscadorInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buscadorInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },
  btnCSV: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
  },
  listPadding: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  avatarMini: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    marginRight: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  uid: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  uidMissing: {
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
  },
  btnIconoVerde: {
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  btnIconoRojo: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 5,
  },
  fabText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
});