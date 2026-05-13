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
  Modal,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { fetchOdooData } from '../../services/LogInService';
import { API_ENDPOINTS } from '../../config/api';
import { apiClient } from '../../services/apiClient';
//Fuente unica de cursos: ver src/config/cursos.js
import { FILTRO_TODOS, getNombreCurso } from '../../config/cursos';

export default function ListScreen({ route, navigation }) {
  const { type } = route.params;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  //Filtro de curso (solo se usa para alumnado). Empieza en "Todos".
  const [cursoFiltro, setCursoFiltro] = useState(FILTRO_TODOS);
  const [mostrarFiltroCursos, setMostrarFiltroCursos] = useState(false);

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
      const result = await fetchOdooData(model);
      setData(result);
    } catch (e) {
      console.error("Error cargando datos:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    //Reseteamos filtros al cambiar de tipo (alumnado/profesorado)
    setCursoFiltro(FILTRO_TODOS);
    setBusqueda('');
  }, [type]);

  //============================================
  //LISTA DE CURSOS DISPONIBLES PARA EL FILTRO
  //
  //Solo mostramos cursos que tengan al menos un alumno asignado.
  //getNombreCurso() hace el fallback al codigo corto si no esta en MAPA_CURSOS.
  //============================================
  const cursosDisponibles = (() => {
    const codigos = new Set();
    data.forEach(item => {
      if (item.school_year) codigos.add(item.school_year);
    });
    return Array.from(codigos)
      .sort()
      .map(codigo => ({
        codigo,
        etiqueta: getNombreCurso(codigo),
      }));
  })();

  //Etiqueta del filtro activo
  const etiquetaCursoActual = cursoFiltro === FILTRO_TODOS
    ? 'Todos los cursos'
    : getNombreCurso(cursoFiltro);

  //============================================
  //IMPORTACION CSV
  //============================================

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
  //FILTROS COMBINADOS
  //============================================
  const textoBusqueda = busqueda.trim().toLowerCase();

  const datosFiltrados = data.filter(item => {
    const nombre = item.name ? String(item.name).toLowerCase() : '';
    const apellido = item.surname ? String(item.surname).toLowerCase() : '';
    const coincideNombre = nombre.includes(textoBusqueda) || apellido.includes(textoBusqueda);

    const coincideCurso = type !== 'alumnado'
      || cursoFiltro === FILTRO_TODOS
      || item.school_year === cursoFiltro;

    return coincideNombre && coincideCurso;
  });

  //============================================
  //NAVEGACION Y ACCIONES
  //============================================

  const irADetalle = (item) => {
    if (type === 'alumnado') navigation.navigate('StudentDetail', { student: item });
    else navigation.navigate('TeacherDetail', { teacher: item });
  };

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

      const resData = await apiClient.delete(endpoint);

      if (resData && resData.success !== false) {
        setData(prevData => prevData.filter(i => i.id !== id));
      } else {
        mostrarAlerta('Error', resData.message || 'No se pudo eliminar.');
      }
    } catch (error) {
      console.error('Error eliminando:', error.message);
      mostrarAlerta('Error', error.message || 'No se pudo eliminar.');
    }
  };

  //============================================
  //RENDER DE CADA FILA
  //============================================

  const renderItem = ({ item }) => {
    const cursoTexto = getNombreCurso(item.school_year);

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
              <View style={styles.cardFooterTexto}>
                {type === 'alumnado' ? (
                  <Text style={styles.detailText} numberOfLines={2}>{cursoTexto}</Text>
                ) : (
                  <Text style={styles.detailText} numberOfLines={2}>{item.email || 'Sin email'}</Text>
                )}
              </View>

              {type === 'alumnado' && (
                <View style={styles.busIcono}>
                  <FontAwesome5
                    name="bus"
                    size={18}
                    color={item.can_bus ? '#22C55E' : '#EF4444'}
                  />
                </View>
              )}

              <View style={styles.cardFooterAcciones}>
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

        {/*Filtro de curso (solo en alumnado). Mismo patron que StudentsListScreen.*/}
        {type === 'alumnado' && (
          <TouchableOpacity
            style={styles.filtroCurso}
            onPress={() => setMostrarFiltroCursos(true)}
            activeOpacity={0.7}
          >
            <Feather name="filter" size={16} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={styles.filtroCursoTexto} numberOfLines={1}>
              {etiquetaCursoActual}
            </Text>
            <Feather name="chevron-down" size={18} color="#2563EB" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <FlatList
          data={datosFiltrados}
          keyExtractor={(item, index) => (item.id != null ? String(item.id) : `idx-${index}`)}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
        />
      )}

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

      {/*Modal del filtro de curso*/}
      <Modal
        animationType="fade"
        transparent
        visible={mostrarFiltroCursos}
        onRequestClose={() => setMostrarFiltroCursos(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMostrarFiltroCursos(false)}
        >
          <View style={styles.modalFiltro} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalFiltroTitulo}>Filtrar por curso</Text>
            <ScrollView style={{ maxHeight: 400 }}>

              <TouchableOpacity
                style={[
                  styles.opcionCurso,
                  cursoFiltro === FILTRO_TODOS && styles.opcionCursoActiva
                ]}
                onPress={() => {
                  setCursoFiltro(FILTRO_TODOS);
                  setMostrarFiltroCursos(false);
                }}
              >
                <Text style={[
                  styles.opcionCursoTexto,
                  cursoFiltro === FILTRO_TODOS && styles.opcionCursoTextoActivo
                ]}>
                  Todos los cursos
                </Text>
                {cursoFiltro === FILTRO_TODOS && (
                  <Feather name="check" size={18} color="#2563EB" />
                )}
              </TouchableOpacity>

              {cursosDisponibles.map(c => (
                <TouchableOpacity
                  key={c.codigo}
                  style={[
                    styles.opcionCurso,
                    cursoFiltro === c.codigo && styles.opcionCursoActiva
                  ]}
                  onPress={() => {
                    setCursoFiltro(c.codigo);
                    setMostrarFiltroCursos(false);
                  }}
                >
                  <Text style={[
                    styles.opcionCursoTexto,
                    cursoFiltro === c.codigo && styles.opcionCursoTextoActivo
                  ]}>
                    {c.etiqueta}
                  </Text>
                  {cursoFiltro === c.codigo && (
                    <Feather name="check" size={18} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  filtroCurso: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    maxWidth: '100%',
  },
  filtroCursoTexto: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
    marginRight: 6,
    maxWidth: 220,
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
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  cardFooterTexto: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  busIcono: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  cardFooterAcciones: {
    flexDirection: 'row',
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 1,
    lineHeight: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalFiltro: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
  },
  modalFiltroTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 14,
  },
  opcionCurso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  opcionCursoActiva: {
    backgroundColor: '#EFF6FF',
  },
  opcionCursoTexto: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  opcionCursoTextoActivo: {
    color: '#2563EB',
    fontWeight: '700',
  },
});