import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { apiClient } from '../../services/apiClient';
import { FILTRO_TODOS, getNombreCurso } from '../../config/cursos';

const PAGE_SIZE = 50;

const ETIQUETAS_REG_TYPE = {
  entrada_puntual:              'Entrada Puntual',
  entrada_recreo:               'Entrada Recreo',
  entrada_tardia:               'Entrada Tardia',
  entrada_prof:                 'Entrada Profesor',
  salida_anticipada:            'Salida Anticipada',
  salida_recreo:                'Salida Recreo',
  salida_bus:                   'Salida Bus',
  salida_anticipada_autorizada: 'Salida Anticipada Autorizada',
  salida_regular:               'Salida Regular',
  salida_prof:                  'Salida Profesor',
  error:                        'Incidencia',
  no_autorizado:                'No Autorizado',
};

const COLORES_REG_TYPE = {
  entrada_puntual:              { bg: '#DCFCE7', fg: '#15803D' },
  entrada_recreo:               { bg: '#DCFCE7', fg: '#15803D' },
  entrada_tardia:               { bg: '#FEF9C3', fg: '#A16207' },
  entrada_prof:                 { bg: '#E0E7FF', fg: '#3730A3' },
  salida_regular:               { bg: '#DCFCE7', fg: '#15803D' },
  salida_bus:                   { bg: '#DBEAFE', fg: '#1D4ED8' },
  salida_recreo:                { bg: '#DBEAFE', fg: '#1D4ED8' },
  salida_prof:                  { bg: '#E0E7FF', fg: '#3730A3' },
  salida_anticipada_autorizada: { bg: '#FEF9C3', fg: '#A16207' },
  salida_anticipada:            { bg: '#FEF9C3', fg: '#A16207' },
  no_autorizado:                { bg: '#FEE2E2', fg: '#B91C1C' },
  error:                        { bg: '#FEE2E2', fg: '#B91C1C' },
};

function formatearHora(dateTime) {
  if (!dateTime) return '';
  const fechaUTC = new Date(String(dateTime).replace(' ', 'T') + 'Z');
  if (isNaN(fechaUTC.getTime())) return '';
  const hh = String(fechaUTC.getHours()).padStart(2, '0');
  const mm = String(fechaUTC.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function fechaHoy() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatearFechaParaApp(yyyymmdd) {
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
}

export default function DashboardScreen() {
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpis, setKpis] = useState({
    asistenciaHoy: 0,
    asistenciaMedia: '0%',
    incidenciasHoy: 0,
  });
  const [chartData, setChartData] = useState([]);

  const [tooltip, setTooltip] = useState(null);

  const [tipoActivo, setTipoActivo] = useState('entrada');
  const [fecha, setFecha] = useState(fechaHoy());
  const [cursoFiltro, setCursoFiltro] = useState(FILTRO_TODOS);
  const [mostrarFiltroCursos, setMostrarFiltroCursos] = useState(false);

  const [registros, setRegistros] = useState({ entrada: [], salida: [] });
  const [totales, setTotales]     = useState({ entrada: 0, salida: 0 });
  const [cargando, setCargando]   = useState({ entrada: false, salida: false });
  const [cursosVistos, setCursosVistos] = useState(new Set());

  const offsetsRef = useRef({ entrada: 0, salida: 0 });
  const cargandoRef = useRef({ entrada: false, salida: false });
  const fetchTokenRef = useRef(0);

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

  const cargarRegistros = useCallback(async (tipo, reset = false) => {
    if (cargandoRef.current[tipo]) return;

    const offsetActual = reset ? 0 : offsetsRef.current[tipo];
    const miToken = fetchTokenRef.current;

    cargandoRef.current[tipo] = true;
    setCargando(prev => ({ ...prev, [tipo]: true }));

    try {
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

      if (miToken !== fetchTokenRef.current) return;

      if (data && data.success) {
        const nuevos = data.registros || [];
        offsetsRef.current[tipo] = offsetActual + nuevos.length;

        setRegistros(prev => ({
          ...prev,
          [tipo]: reset ? nuevos : [...prev[tipo], ...nuevos],
        }));
        setTotales(prev => ({ ...prev, [tipo]: data.total || 0 }));

        if (nuevos.length > 0) {
          setCursosVistos(prev => {
            const nuevo = new Set(prev);
            nuevos.forEach(r => { if (r.curso) nuevo.add(r.curso); });
            if (nuevo.size === prev.size) return prev;
            return nuevo;
          });
        }
      }
    } catch (error) {
      console.error(`Error cargando registros (${tipo}):`, error.message);
    } finally {
      cargandoRef.current[tipo] = false;
      setCargando(prev => ({ ...prev, [tipo]: false }));
    }
  }, [fecha, cursoFiltro]);

  useEffect(() => {
    fetchTokenRef.current += 1;
    offsetsRef.current = { entrada: 0, salida: 0 };
    setRegistros({ entrada: [], salida: [] });
    setTotales({ entrada: 0, salida: 0 });
    cargarRegistros(tipoActivo, true);
  }, [fecha, cursoFiltro, cargarRegistros, tipoActivo]);

  useEffect(() => {
    if (registros[tipoActivo].length === 0 && !cargandoRef.current[tipoActivo]) {
      cargarRegistros(tipoActivo, true);
    }
  }, [tipoActivo, registros, cargarRegistros]);

  const cargarSiguientePagina = useCallback(() => {
    const enPantalla = registros[tipoActivo].length;
    const total = totales[tipoActivo];
    if (cargandoRef.current[tipoActivo]) return;
    if (enPantalla === 0) return;
    if (enPantalla >= total) return;
    cargarRegistros(tipoActivo, false);
  }, [tipoActivo, registros, totales, cargarRegistros]);

  const cargarRegistrosRef = useRef(cargarRegistros);
  const cargarKpisRef = useRef(cargarKpis);
  useEffect(() => {
    cargarRegistrosRef.current = cargarRegistros;
    cargarKpisRef.current = cargarKpis;
  }, [cargarRegistros, cargarKpis]);

  useEffect(() => {
    const id = setInterval(() => {
      cargarKpisRef.current();
      cargarRegistrosRef.current(tipoActivo, true);
    }, 10000);
    return () => clearInterval(id);
  }, [tipoActivo]);

  const refrescarManual = useCallback(() => {
    cargarKpisRef.current();
    cargarRegistrosRef.current(tipoActivo, true);
  }, [tipoActivo]);

  const handleExportar = () => {
    const url = API_ENDPOINTS.EXPORTAR_ACCESOS;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url).catch(err => console.error('Error al abrir URL:', err.message));
  };

  const cambiarFecha = () => {
    if (Platform.OS === 'web') {
      const nueva = window.prompt('Fecha (YYYY-MM-DD):', fecha);
      if (nueva && /^\d{4}-\d{2}-\d{2}$/.test(nueva)) setFecha(nueva);
    } else {
      const hoy = new Date();
      const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
      const anteayer = new Date(); anteayer.setDate(hoy.getDate() - 2);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

      Alert.alert(
        'Seleccionar fecha',
        'Elige una fecha rapida',
        [
          { text: 'Hoy', onPress: () => setFecha(fmt(hoy)) },
          { text: 'Ayer', onPress: () => setFecha(fmt(ayer)) },
          { text: 'Anteayer', onPress: () => setFecha(fmt(anteayer)) },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    }
  };

  const handleMouseEnter = (dayIndex, segIndex, rawValue, label) => {
      if (Platform.OS === 'web') {
          const count = rawValue / 5;
          
          if(count === 0) return;

          setTooltip({
              dayIndex,
              segIndex,
              text: `${count} ${label}`
          });
      }
  };

  const handleMouseLeave = () => {
      if (Platform.OS === 'web') {
          setTooltip(null);
      }
  };

  const renderRegistro = ({ item }) => {
    const color = COLORES_REG_TYPE[item.reg_type] || { bg: '#F1F5F9', fg: '#475569' };
    const etiqueta = ETIQUETAS_REG_TYPE[item.reg_type] || item.reg_type;
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

  const renderHeader = () => (
    <View>
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

      {!loadingKpis && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="bar-chart-2" size={18} color="#1D4ED8" style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>Salidas (Semana)</Text>
          </View>

          <View style={styles.chartContainer}>
            {chartData.map((item, dIndex) => (
              <View key={dIndex} style={styles.barWrapper}>
                <View style={styles.barBackground}>
                  {item.segments.map((seg, sIndex) => {
                      // Determinar etiqueta basada en el color
                      let segLabel = '';
                      if(seg.color === '#3B82F6') segLabel = 'Regulares';
                      if(seg.color === '#EF4444') segLabel = 'Anticipadas';
                      if(seg.color === '#10B981') segLabel = 'Bus/Recreo';

                      const isHovered = tooltip && tooltip.dayIndex === dIndex && tooltip.segIndex === sIndex;

                      return (
                        <View
                          key={sIndex}
                          onMouseEnter={() => handleMouseEnter(dIndex, sIndex, seg.value, segLabel)}
                          onMouseLeave={handleMouseLeave}
                          style={[
                            styles.barFillSegment,
                            { 
                                height: `${Math.min(seg.value, 100)}%`, 
                                backgroundColor: seg.color,
                                opacity: isHovered ? 0.8 : 1
                            }
                          ]}
                        >
                            {isHovered && (
                                <View style={styles.tooltipContainer}>
                                    <View style={styles.tooltipBox}>
                                        <Text style={styles.tooltipText}>{tooltip.text}</Text>
                                    </View>
                                    <View style={styles.tooltipArrow} />
                                </View>
                            )}
                        </View>
                      )
                  })}
                </View>
                <Text style={styles.barLabel}>{item.day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.legendContainer}>
            <LegendItem color="#3B82F6" label="Regulares" />
            <LegendItem color="#EF4444" label="Anticipadas" />
            <LegendItem color="#10B981" label="Bus/Recreo" />
          </View>
        </View>
      )}

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

      <View style={styles.headerTabla}>
        <Text style={styles.tituloTabla}>
          {tipoActivo === 'entrada' ? 'Registros de Entrada' : 'Registros de Salida'}
        </Text>
        <TouchableOpacity
          style={styles.btnRefresh}
          onPress={refrescarManual}
          activeOpacity={0.7}
          disabled={cargando[tipoActivo]}
        >
          <Feather
            name="refresh-cw"
            size={14}
            color={cargando[tipoActivo] ? '#94A3B8' : '#2563EB'}
          />
          <Text style={[styles.btnRefreshTexto, cargando[tipoActivo] && { color: '#94A3B8' }]}>
            Actualizar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
        onEndReached={cargarSiguientePagina}
        onEndReachedThreshold={0.1}
        contentContainerStyle={styles.content}
      />

      <TouchableOpacity style={styles.fab} onPress={handleExportar} activeOpacity={0.8}>
        <MaterialCommunityIcons name="file-export" size={20} color="white" />
        <Text style={styles.fabText}>Exportar CSV</Text>
      </TouchableOpacity>

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
  content: { padding: 16, paddingBottom: 100 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 16, marginHorizontal: 4, elevation: 2 },
  statTitle: { fontSize: 9, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 16, elevation: 2, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
  
  // Modificaciones para el tooltip
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', height: 150, alignItems: 'flex-end', paddingBottom: 10, zIndex: 10 },
  barWrapper: { alignItems: 'center', flex: 1 },
  barBackground: { width: 30, height: 120, backgroundColor: '#F1F5F9', borderRadius: 6, justifyContent: 'flex-end', marginBottom: 8 },
  barFillSegment: { width: '100%', position: 'relative', alignItems: 'center' },
  
  // Estilos del Tooltip
  tooltipContainer: {
      position: 'absolute',
      bottom: '100%', 
      alignItems: 'center',
      marginBottom: 4, 
      width: 100, 
      zIndex: 999, 
  },
  tooltipBox: {
      backgroundColor: '#1E293B',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
  },
  tooltipText: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
      textAlign: 'center',
  },
  tooltipArrow: {
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: 4,
      borderRightWidth: 4,
      borderTopWidth: 4,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: '#1E293B',
  },

  barLabel: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8' },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginTop: 4 },
  legendColor: { width: 12, height: 12, borderRadius: 3, marginRight: 4 },
  legendLabel: { fontSize: 11, color: '#64748B' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 12 },
  tabBoton: { flex: 1, flexDirection: 'row', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabBotonActivo: { backgroundColor: '#1D4ED8', elevation: 2 },
  tabTexto: { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTextoActivo: { color: 'white', fontWeight: '700' },
  filtrosFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  filtroBoton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  filtroTexto: { color: '#2563EB', fontWeight: '700', fontSize: 12, marginRight: 4, flexShrink: 1 },
  tituloTabla: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  headerTabla: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 },
  btnRefresh: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  btnRefreshTexto: { color: '#2563EB', fontWeight: '700', fontSize: 11, marginLeft: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 8, elevation: 1 },
  filaAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  filaFoto: { width: '100%', height: '100%' },
  filaInfo: { flex: 1, marginRight: 8 },
  filaNombre: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  filaSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  filaDerecha: { alignItems: 'flex-end' },
  filaHora: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: 140 },
  badgeTexto: { fontSize: 10, fontWeight: '800' },
  listaVacia: { alignItems: 'center', paddingVertical: 40 },
  listaVaciaTexto: { color: '#94A3B8', fontWeight: '600', marginTop: 10, textAlign: 'center' },
  finLista: { textAlign: 'center', color: '#94A3B8', fontSize: 12, paddingVertical: 16 },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#1D4ED8', flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30, alignItems: 'center', elevation: 4 },
  fabText: { color: 'white', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalFiltro: { width: '100%', maxWidth: 400, backgroundColor: 'white', borderRadius: 20, padding: 20 },
  modalFiltroTitulo: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 14 },
  opcionCurso: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6 },
  opcionCursoActiva: { backgroundColor: '#EFF6FF' },
  opcionCursoTexto: { color: '#374151', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 },
  opcionCursoTextoActivo: { color: '#2563EB', fontWeight: '700' },
  sinCursos: { color: '#94A3B8', fontSize: 12, textAlign: 'center', fontStyle: 'italic', paddingVertical: 12 },
});