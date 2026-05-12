import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Linking,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { apiClient } from '../../services/apiClient';
import { FILTRO_TODOS, getNombreCurso } from '../../config/cursos';

//Tamano de pagina al pedir registros al backend
const PAGE_SIZE = 50;

//Etiquetas legibles para cada reg_type. Coinciden con la seleccion definida
//en el modelo gestion_entrada.registro de Odoo (campo reg_type).
const ETIQUETAS_REG_TYPE = {
  entrada_puntual:              'Entrada Puntual',
  entrada_recreo:               'Entrada Recreo',
  entrada_tardia:               'Entrada Tardia',
  salida_antes_8:               'Salida Antes de las 8',
  recreo:                       'Salida Recreo',
  anticipada:                   'Salida Anticipada',
  transporte:                   'Salida Transporte',
  autorizado:                   'Autorizado',
  no_autorizado:                'No Autorizado',
  salida_autorizada_anticipada: 'Salida Autorizada Anticipada',
  error:                        'Incidencia',
};

//Colores por reg_type para el badge de cada fila. Ordenados de exito a problema:
//verde = OK, ambar = precaucion, rojo = problema
const COLORES_REG_TYPE = {
  entrada_puntual:              { bg: '#DCFCE7', fg: '#15803D' },
  entrada_recreo:               { bg: '#DCFCE7', fg: '#15803D' },
  entrada_tardia:               { bg: '#FEF9C3', fg: '#A16207' },
  autorizado:                   { bg: '#DCFCE7', fg: '#15803D' },
  salida_antes_8:               { bg: '#DBEAFE', fg: '#1D4ED8' },
  recreo:                       { bg: '#DBEAFE', fg: '#1D4ED8' },
  transporte:                   { bg: '#DBEAFE', fg: '#1D4ED8' },
  anticipada:                   { bg: '#FEF9C3', fg: '#A16207' },
  salida_autorizada_anticipada: { bg: '#FEF9C3', fg: '#A16207' },
  no_autorizado:                { bg: '#FEE2E2', fg: '#B91C1C' },
  error:                        { bg: '#FEE2E2', fg: '#B91C1C' },
};

//Convierte "2026-05-12 09:30:15" a "09:30" para mostrar
function formatearHora(dateTime) {
  if (!dateTime) return '';
  const parte = String(dateTime).split(' ')[1] || '';
  return parte.substring(0, 5);
}

//Devuelve la fecha de hoy en formato YYYY-MM-DD (lo que espera el endpoint)
function fechaHoy() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

//Convierte YYYY-MM-DD a "12/05/2026" para mostrar en el boton
function formatearFechaParaApp(yyyymmdd) {
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
}

export default function DashboardScreen() {
  //============================================
  //ESTADO: KPIs y grafico (parte fija arriba)
  //============================================
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpis, setKpis] = useState({
    asistenciaHoy: 0,
    asistenciaMedia: '0%',
    incidenciasHoy: 0,
  });
  const [chartData, setChartData] = useState([]);

  //============================================
  //ESTADO: tablas (selector + filtros + datos)
  //============================================
  //Tabla activa: 'entrada' o 'salida'. Solo una visible a la vez para que no
  //choque el scroll infinito de dos FlatList apiladas.
  const [tipoActivo, setTipoActivo] = useState('entrada');

  //Filtros (compartidos entre las dos tablas, se aplican al cambiar tab)
  const [fecha, setFecha] = useState(fechaHoy());
  const [cursoFiltro, setCursoFiltro] = useState(FILTRO_TODOS);
  const [mostrarFiltroCursos, setMostrarFiltroCursos] = useState(false);

  //Datos paginados por tipo. Mantenemos las dos en estado para no recargar
  //cuando el usuario cambia entre tabs.
  const [registros, setRegistros] = useState({ entrada: [], salida: [] });
  const [totales, setTotales]     = useState({ entrada: 0, salida: 0 });
  const [offsets, setOffsets]     = useState({ entrada: 0, salida: 0 });
  const [cargando, setCargando]   = useState({ entrada: false, salida: false });
  const [cursosVistos, setCursosVistos] = useState(new Set()); //para el modal de filtro

  //============================================
  //CARGA DE KPIs (al montar y cuando se actualiza)
  //============================================
  const cargarKpis = useCallback(async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.DASHBOARD);
      if (data.success) {
        setKpis(data.kpis);
        setChartData(data.chartData);
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error.message);
    } finally {
      setLoadingKpis(false);
    }
  }, []);

  useEffect(() => {
    cargarKpis();
  }, [cargarKpis]);

  //============================================
  //CARGA DE REGISTROS (con filtros y paginacion)
  //
  //"reset" = si true, descarta lo que habia y empieza desde offset 0.
  //         Si false, anade al final (siguiente pagina).
  //============================================
  const cargarRegistros = useCallback(async (tipo, reset = false) => {
    if (cargando[tipo]) return; //ya hay una peticion en marcha, no duplicamos

    const offsetActual = reset ? 0 : offsets[tipo];
    const yaEnPantalla = reset ? 0 : registros[tipo].length;

    //Si no es reset, comprobamos que no hayamos alcanzado el total
    if (!reset && yaEnPantalla >= totales[tipo] && totales[tipo] > 0) return;

    setCargando(prev => ({ ...prev, [tipo]: true }));

    try {
      //Construimos query string manualmente. Solo anadimos curso si no es "todos"
      const params = new URLSearchParams({
        tipo,
        fecha,
        limit: String(PAGE_SIZE),
        offset: String(offsetActual),
      });
      if (cursoFiltro !== FILTRO_TODOS) {
        params.append('curso', cursoFiltro);
      }

      const url = `${API_BASE_URL}/api/registros-paginado?${params.toString()}`;
      const data = await apiClient.get(url);

      if (data.success) {
        const nuevos = data.registros || [];
        setRegistros(prev => ({
          ...prev,
          [tipo]: reset ? nuevos : [...prev[tipo], ...nuevos],
        }));
        setTotales(prev => ({ ...prev, [tipo]: data.total || 0 }));
        setOffsets(prev => ({ ...prev, [tipo]: offsetActual + nuevos.length }));

        //Vamos acumulando cursos vistos para el modal de filtro
        //(asi se va completando segun el usuario navega)
        setCursosVistos(prev => {
          const nuevo = new Set(prev);
          nuevos.forEach(r => { if (r.curso) nuevo.add(r.curso); });
          return nuevo;
        });
      }
    } catch (error) {
      console.error(`Error cargando registros (${tipo}):`, error.message);
    } finally {
      setCargando(prev => ({ ...prev, [tipo]: false }));
    }
  }, [fecha, cursoFiltro, offsets, registros, totales, cargando]);

  //============================================
  //EFECTOS DE RECARGA
  //
  //Al cambiar fecha o filtro de curso, reseteamos ambas tablas a offset 0.
  //Al cambiar de tab, cargamos esa tabla si esta vacia.
  //============================================
  useEffect(() => {
    //Reset de ambas tablas cuando cambian fecha o curso
    setRegistros({ entrada: [], salida: [] });
    setTotales({ entrada: 0, salida: 0 });
    setOffsets({ entrada: 0, salida: 0 });
    //Cargamos solo la tabla activa, la otra se cargara al cambiar de tab
    cargarRegistros(tipoActivo, true);
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, cursoFiltro]);

  useEffect(() => {
    //Si entramos a un tab sin datos, lo cargamos
    if (registros[tipoActivo].length === 0 && !cargando[tipoActivo]) {
      cargarRegistros(tipoActivo, true);
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoActivo]);

  //============================================
  //EXPORTAR CSV (igual que antes)
  //============================================
  const handleExportar = () => {
    const url = API_ENDPOINTS.EXPORTAR_ACCESOS;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url).catch(err => console.error('Error al abrir URL:', err.message));
  };

  //============================================
  //CAMBIAR FECHA
  //
  //RN no trae date picker propio. Implementamos lo mas portable: input nativo
  //type="date" en web, prompt en movil. Para algo mejor en movil, instalar
  //@react-native-community/datetimepicker (no esta en package.json ahora).
  //============================================
  const cambiarFecha = () => {
    if (Platform.OS === 'web') {
      //En web pedimos al usuario que escriba la fecha en formato ISO
      const nueva = window.prompt('Fecha (YYYY-MM-DD):', fecha);
      if (nueva && /^\d{4}-\d{2}-\d{2}$/.test(nueva)) setFecha(nueva);
    } else {
      //En movil, ofrecemos opciones rapidas (hoy, ayer, anteayer) + entrada manual
      //como solucion temporal sin libreria externa.
      const hoy = new Date();
      const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
      const anteayer = new Date(); anteayer.setDate(hoy.getDate() - 2);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

      //Para mantener la dependencia minima, usamos un Alert nativo con 3 opciones
      const { Alert } = require('react-native');
      Alert.alert(
        'Seleccionar fecha',
        'Elige una fecha rapida o vuelve atras para mantener la actual',
        [
          { text: 'Hoy', onPress: () => setFecha(fmt(hoy)) },
          { text: 'Ayer', onPress: () => setFecha(fmt(ayer)) },
          { text: 'Anteayer', onPress: () => setFecha(fmt(anteayer)) },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    }
  };

  //============================================
  //RENDER DE UNA FILA DE REGISTRO
  //============================================
  const renderRegistro = ({ item }) => {
    const color = COLORES_REG_TYPE[item.reg_type] || { bg: '#F1F5F9', fg: '#475569' };
    const etiqueta = ETIQUETAS_REG_TYPE[item.reg_type] || item.reg_type;
    //Si es alumno mostramos el curso largo; si es profesor, el rol
    const subtitulo = item.usr_type === 'alumno'
      ? (item.cursoLargo || 'Sin curso')
      : 'Profesor';

    return (
      <View style={styles.fila}>
        <View style={styles.filaAvatar}>
          {item.photo ? (
            <Image source={{ uri: `data:image/png;base64,${item.photo}` }} style={styles.filaFoto} />
          ) : (
            <Ionicons name="person" size={20} color="#94A3B8" />
          )}
        </View>

        <View style={styles.filaInfo}>
          <Text style={styles.filaNombre} numberOfLines={1}>{item.nombre}</Text>
          <Text style={styles.filaSub} numberOfLines={1}>{subtitulo}</Text>
        </View>

        <View style={styles.filaDerecha}>
          <Text style={styles.filaHora}>{formatearHora(item.dateTime)}</Text>
          <View style={[styles.badge, { backgroundColor: color.bg }]}>
            <Text style={[styles.badgeTexto, { color: color.fg }]} numberOfLines={1}>
              {etiqueta}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  //============================================
  //HEADER DE LA LISTA (KPIs + grafico + filtros + selector)
  //============================================
  const renderHeader = () => (
    <View>
      {/*Tarjetas de KPIs*/}
      {loadingKpis ? (
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <View style={styles.statsContainer}>
          <StatCard title="Asistencia Hoy" value={kpis.asistenciaHoy} />
          <StatCard title="Asist. Media" value={kpis.asistenciaMedia} />
          <StatCard title="Incidencias Hoy" value={kpis.incidenciasHoy} color="red" />
        </View>
      )}

      {/*Grafico semanal*/}
      {!loadingKpis && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="bar-chart-2" size={18} color="#1D4ED8" style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>Salidas (Semana)</Text>
          </View>

          <View style={styles.chartContainer}>
            {chartData.map((item, i) => (
              <View key={i} style={styles.barWrapper}>
                <View style={styles.barBackground}>
                  {item.segments.map((seg, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.barFillSegment,
                        { height: `${Math.min(seg.value, 100)}%`, backgroundColor: seg.color }
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.barLabel}>{item.day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.legendContainer}>
            <LegendItem color="#3B82F6" label="Autorizadas" />
            <LegendItem color="#EF4444" label="No Autoriz." />
            <LegendItem color="#10B981" label="Transp/Recreo" />
          </View>
        </View>
      )}

      {/*Selector Entradas/Salidas*/}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBoton, tipoActivo === 'entrada' && styles.tabBotonActivo]}
          onPress={() => setTipoActivo('entrada')}
          activeOpacity={0.7}
        >
          <Feather name="log-in" size={16} color={tipoActivo === 'entrada' ? '#fff' : '#475569'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabTexto, tipoActivo === 'entrada' && styles.tabTextoActivo]}>
            Entradas ({totales.entrada})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBoton, tipoActivo === 'salida' && styles.tabBotonActivo]}
          onPress={() => setTipoActivo('salida')}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={16} color={tipoActivo === 'salida' ? '#fff' : '#475569'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabTexto, tipoActivo === 'salida' && styles.tabTextoActivo]}>
            Salidas ({totales.salida})
          </Text>
        </TouchableOpacity>
      </View>

      {/*Filtros: fecha + curso*/}
      <View style={styles.filtrosFila}>
        <TouchableOpacity style={styles.filtroBoton} onPress={cambiarFecha} activeOpacity={0.7}>
          <Feather name="calendar" size={14} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.filtroTexto} numberOfLines={1}>
            {formatearFechaParaApp(fecha)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filtroBoton, { marginLeft: 8, flex: 1 }]}
          onPress={() => setMostrarFiltroCursos(true)}
          activeOpacity={0.7}
        >
          <Feather name="filter" size={14} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.filtroTexto} numberOfLines={1}>
            {cursoFiltro === FILTRO_TODOS ? 'Todos los cursos' : getNombreCurso(cursoFiltro)}
          </Text>
          <Feather name="chevron-down" size={14} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/*Titulo de la tabla activa*/}
      <Text style={styles.tituloTabla}>
        {tipoActivo === 'entrada' ? 'Registros de Entrada' : 'Registros de Salida'}
      </Text>
    </View>
  );

  //Footer: spinner cuando esta cargando mas, mensaje cuando se acabo
  const renderFooter = () => {
    if (cargando[tipoActivo]) {
      return (
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator size="small" color="#1D4ED8" />
        </View>
      );
    }
    const yaCargados = registros[tipoActivo].length;
    if (yaCargados > 0 && yaCargados >= totales[tipoActivo]) {
      return <Text style={styles.finLista}>— Fin de la lista —</Text>;
    }
    return null;
  };

  //Estado vacio cuando no hay registros tras filtrar
  const renderEmpty = () => {
    if (cargando[tipoActivo] && registros[tipoActivo].length === 0) return null;
    return (
      <View style={styles.listaVacia}>
        <Feather name="inbox" size={32} color="#D1D5DB" />
        <Text style={styles.listaVaciaTexto}>
          No hay {tipoActivo === 'entrada' ? 'entradas' : 'salidas'} para esta fecha y filtro
        </Text>
      </View>
    );
  };

  //Lista de cursos vistos en los registros, para el modal de filtro.
  //Se va completando segun cargamos paginas (no requerimos una lista fija)
  const cursosParaFiltro = Array.from(cursosVistos)
    .sort()
    .map(codigo => ({ codigo, etiqueta: getNombreCurso(codigo) }));

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <FlatList
        data={registros[tipoActivo]}
        keyExtractor={(item, index) => (item.id != null ? `r-${item.id}` : `idx-${index}`)}
        renderItem={renderRegistro}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        //Scroll infinito: cuando estamos al 70% del final, pedimos siguiente pagina
        onEndReached={() => cargarRegistros(tipoActivo, false)}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.content}
      />

      {/*FAB de exportacion CSV*/}
      <TouchableOpacity style={styles.fab} onPress={handleExportar} activeOpacity={0.8}>
        <MaterialCommunityIcons name="file-export" size={20} color="white" />
        <Text style={styles.fabText}>Exportar CSV</Text>
      </TouchableOpacity>

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

              {cursosParaFiltro.length === 0 && (
                <Text style={styles.sinCursos}>
                  Aun no se han detectado cursos. Carga registros primero.
                </Text>
              )}

              {cursosParaFiltro.map(c => (
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

//============================================
//COMPONENTES AUXILIARES
//============================================
const StatCard = ({ title, value, color = 'blue' }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={[styles.statValue, color === 'red' && { color: '#EF4444' }]}>{value}</Text>
  </View>
);

const LegendItem = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendColor, { backgroundColor: color }]} />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100, //espacio para que el FAB no tape el final
  },

  //KPIs
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 16,
    marginHorizontal: 4,
    elevation: 2,
  },
  statTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },

  //Grafico
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 150,
    alignItems: 'flex-end',
    paddingBottom: 10,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barBackground: {
    width: 30,
    height: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFillSegment: {
    width: '100%',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginTop: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: '#64748B',
  },

  //Tabs Entradas/Salidas
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabBoton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBotonActivo: {
    backgroundColor: '#1D4ED8',
    elevation: 2,
  },
  tabTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  tabTextoActivo: {
    color: 'white',
    fontWeight: '700',
  },

  //Filtros (fecha + curso)
  filtrosFila: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filtroBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filtroTexto: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 12,
    marginRight: 4,
    flexShrink: 1,
  },

  //Titulo encima de la tabla
  tituloTabla: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    marginTop: 4,
  },

  //Fila de registro
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
  },
  filaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filaFoto: {
    width: '100%',
    height: '100%',
  },
  filaInfo: {
    flex: 1,
    marginRight: 8,
  },
  filaNombre: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  filaSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  filaDerecha: {
    alignItems: 'flex-end',
  },
  filaHora: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 140,
  },
  badgeTexto: {
    fontSize: 10,
    fontWeight: '800',
  },

  //Lista vacia y fin de lista
  listaVacia: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  listaVaciaTexto: {
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  finLista: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    paddingVertical: 16,
  },

  //FAB de exportar CSV
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 4,
  },
  fabText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },

  //Modal de filtro de cursos (mismos estilos que ListScreen/StudentsListScreen)
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
  sinCursos: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});