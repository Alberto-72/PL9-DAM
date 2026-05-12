import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../../config/api';
import { apiClient } from '../../services/apiClient';
//Fuente unica de cursos: ver src/config/cursos.js
import { FILTRO_TODOS, getNombreCurso } from '../../config/cursos';

export default function StudentsListScreen({ navigation, route }) {
  const [listaAlumnos, setListaAlumnos] = useState([]);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  //Estado del filtro por curso
  const [cursoFiltro, setCursoFiltro] = useState(FILTRO_TODOS);
  const [mostrarFiltroCursos, setMostrarFiltroCursos] = useState(false);

  //Estado del modal de detalles del alumno
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);

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

  //Carga de alumnos desde el backend. Se extrae como funcion separada (con useCallback)
  //para poder reutilizarla desde el boton de refresco y el pull-to-refresh.
  const cargarAlumnos = useCallback(async (esRefresco = false) => {
    try {
      if (esRefresco) {
        setRefrescando(true);
      } else {
        setCargandoAlumnos(true);
      }

      const data = await apiClient.get(API_ENDPOINTS.ALUMNOS);

      if (data.success) {
        const alumnosFormateados = data.alumnos.map(a => ({
          ...a,
          nombreCompleto: `${a.name} ${a.surname || ''}`.trim(),
          cursoTexto: getNombreCurso(a.school_year),
          emailValidado: (a.email && a.email !== false && a.email !== "false") ? a.email : 'Sin email'
        }));
        setListaAlumnos(alumnosFormateados);
      }
    } catch (err) {
      console.error("Error en la carga de alumnado:", err.message);
    } finally {
      setCargandoAlumnos(false);
      setRefrescando(false);
    }
  }, []);

  //Carga inicial al entrar en la pantalla
  useEffect(() => {
    cargarAlumnos(false);
  }, [cargarAlumnos]);

  //Lista de cursos disponibles para el desplegable (dinamica: solo los que tienen alumnos).
  //Calculada en cada render porque es barato y siempre refleja los datos actuales.
  const cursosDisponibles = (() => {
    const codigos = new Set();
    listaAlumnos.forEach(a => {
      if (a.school_year) codigos.add(a.school_year);
    });
    //Convertimos a array de objetos { codigo, etiqueta } y ordenamos alfabeticamente
    return Array.from(codigos)
      .sort()
      .map(codigo => ({
        codigo,
        etiqueta: getNombreCurso(codigo)
      }));
  })();

  //Filtro combinado: aplicamos texto de busqueda Y filtro de curso a la vez
  const alumnosFiltrados = listaAlumnos.filter(a => {
    const coincideBusqueda = a.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCurso = cursoFiltro === FILTRO_TODOS || a.school_year === cursoFiltro;
    return coincideBusqueda && coincideCurso;
  });

  //Etiqueta del filtro de curso actual, para mostrar en el boton
  const etiquetaCursoActual = cursoFiltro === FILTRO_TODOS
    ? 'Todos'
    : getNombreCurso(cursoFiltro);

  //Abre el modal de detalle del alumno
  const verDetalleAlumno = (item) => {
    setAlumnoSeleccionado(item);
    setModalDetalleVisible(true);
  };

  //Navega al scanner pasando el alumno. Se usa tanto desde la fila como desde el boton Validar del modal.
  //Reutilizamos la logica de validacion del ScannerScreen para no duplicarla.
  const validarAlumno = (item) => {
    setModalDetalleVisible(false);
    navigation.navigate('Escáner', {
      studentToValidate: {
        id: item.id,
        nombre: item.nombreCompleto,
        cursoCorto: item.school_year,
        curso: item.cursoTexto,
        tieneTransporte: item.can_bus,
        foto: item.photo,
        email: item.emailValidado || 'Sin email',
        fechaNacimiento: item.birth_date,
        uid: item.uid
      }
    });
  };

  const renderItem = ({ item }) => (
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

      {/*Boton del ojo: abre el modal con todos los datos del alumno*/}
      <TouchableOpacity
        style={styles.btnOjo}
        onPress={() => verDetalleAlumno(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="eye" size={18} color="#2563EB" />
      </TouchableOpacity>
    </View>
  );

  //Pantalla de carga inicial (no aparece en pull-to-refresh, solo la primera vez)
  if (cargandoAlumnos && !refrescando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/*Fila superior: buscador + boton de filtro por curso + boton de refrescar*/}
      <View style={styles.barraSuperior}>
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

        {/*Boton de refrescar la lista manualmente*/}
        <TouchableOpacity
          style={styles.btnRefrescar}
          onPress={() => cargarAlumnos(true)}
          disabled={refrescando}
        >
          <Feather
            name="refresh-cw"
            size={18}
            color={refrescando ? '#9CA3AF' : '#2563EB'}
          />
        </TouchableOpacity>
      </View>

      {/*Boton del filtro por curso: abre el modal de seleccion*/}
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

      {/*Lista de alumnos con pull-to-refresh*/}
      <FlatList
        data={alumnosFiltrados}
        keyExtractor={(item) => (item.id || Math.random()).toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => cargarAlumnos(true)}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View style={styles.listaVacia}>
            <Feather name="users" size={32} color="#D1D5DB" />
            <Text style={styles.listaVaciaTexto}>No hay alumnos que coincidan</Text>
          </View>
        }
      />

      {/*Modal de seleccion de curso para el filtro*/}
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

              {/*Opcion "Todos" siempre visible al principio*/}
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

              {/*Resto de cursos disponibles*/}
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

      {/*Modal de detalles del alumno con boton Validar*/}
      <Modal
        animationType="fade"
        transparent
        visible={modalDetalleVisible}
        onRequestClose={() => setModalDetalleVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDetalle}>
            <TouchableOpacity
              style={styles.modalCerrar}
              onPress={() => setModalDetalleVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={30} color="#9CA3AF" />
            </TouchableOpacity>

            {alumnoSeleccionado && (
              <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 10 }}>

                {/*Avatar*/}
                <View style={styles.modalAvatarContenedor}>
                  {alumnoSeleccionado.photo && alumnoSeleccionado.photo !== false ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${alumnoSeleccionado.photo}` }}
                      style={styles.modalAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.modalAvatar, styles.modalAvatarPlaceholder]}>
                      <Ionicons name="person" size={50} color="#9CA3AF" />
                    </View>
                  )}
                </View>

                <Text style={styles.modalNombre}>{alumnoSeleccionado.nombreCompleto}</Text>
                <View style={styles.modalDivider} />

                {/*Datos del alumno en filas etiqueta-valor*/}
                <FilaDato etiqueta="Curso" valor={alumnoSeleccionado.cursoTexto} />
                <FilaDato etiqueta="Email" valor={alumnoSeleccionado.emailValidado} />
                <FilaDato
                  etiqueta="Fecha nac."
                  valor={alumnoSeleccionado.birth_date || 'No registrada'}
                />
                <FilaDato
                  etiqueta="Transporte"
                  valor={alumnoSeleccionado.can_bus ? 'Sí (BUS)' : 'No'}
                  color={alumnoSeleccionado.can_bus ? '#22C55E' : '#EF4444'}
                />
                <FilaDato
                  etiqueta="NFC UID"
                  valor={alumnoSeleccionado.uid || 'Sin vincular'}
                  color={alumnoSeleccionado.uid ? '#111827' : '#EF4444'}
                />

                {/*Boton Validar: navega al scanner igual que cuando se toca la fila desde la version antigua,
                   o igual que cuando se acerca una tarjeta NFC*/}
                <TouchableOpacity
                  style={styles.btnValidar}
                  onPress={() => validarAlumno(alumnoSeleccionado)}
                  activeOpacity={0.8}
                >
                  <Feather name="check-circle" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.btnValidarTexto}>Validar salida</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

//Componente auxiliar para las filas etiqueta-valor del modal de detalle.
//Lo extraigo aparte para no repetir el JSX cinco veces.
function FilaDato({ etiqueta, valor, color }) {
  return (
    <View style={styles.modalFilaDato}>
      <Text style={styles.modalEtiqueta}>{etiqueta}:</Text>
      <Text
        style={[styles.modalValor, color && { color }]}
        numberOfLines={1}
      >
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  btnSalir: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  txtSalir: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },

  //Fila superior: buscador + boton refrescar
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    gap: 10,
  },
  buscadorContenedor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buscadorInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  btnRefrescar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  //Boton del filtro por curso
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
    marginBottom: 12,
    maxWidth: '100%',
  },
  filtroCursoTexto: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
    marginRight: 6,
    maxWidth: 220,
  },

  //Fila de la lista de alumnos
  alumnoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  alumnoFotoContenedor: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  alumnoFoto: {
    width: '100%',
    height: '100%',
  },
  alumnoFotoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alumnoInfo: {
    flex: 1,
  },
  alumnoListaNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  alumnoListaCurso: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 16,
  },
  busIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    marginRight: 8,
  },
  busText: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  btnOjo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  //Estado lista vacia (sin resultados)
  listaVacia: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  listaVaciaTexto: {
    color: '#9CA3AF',
    marginTop: 10,
    fontWeight: '600',
  },

  //Overlay comun a todos los modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  //Modal del filtro de cursos
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

  //Modal de detalles del alumno
  modalDetalle: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 24,
    maxHeight: '85%',
  },
  modalCerrar: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  modalAvatarContenedor: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#DBEAFE',
  },
  modalAvatar: {
    width: '100%',
    height: '100%',
  },
  modalAvatarPlaceholder: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalNombre: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  modalFilaDato: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalEtiqueta: {
    fontWeight: 'bold',
    color: '#6B7280',
    fontSize: 13,
  },
  modalValor: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  btnValidar: {
    marginTop: 18,
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    elevation: 2,
  },
  btnValidarTexto: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
});