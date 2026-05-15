// Importacion de modulos
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {  View,  Text,  FlatList,  StyleSheet,  ActivityIndicator,  TouchableOpacity,
  Platform,  Linking,  Image,  Modal,  ScrollView,  Alert,  TextInput,} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { apiClient } from '../../services/apiClient';
import { FILTRO_TODOS, getNombreCurso } from '../../config/cursos';

// Definicion de constantes globales y diccionarios de la ui
const PAGE_SIZE = 50;

const ETIQUETAS_REG_TYPE = {
  entrada_puntual:              'Entrada Puntual',
  entrada_recreo:               'Entrada Recreo',
  entrada_tardia:               'Entrada Tardia',
  entrada_prof:                 'Entrada Profesor',
  salida_anticipada:            'Salida Anticipada',
  salida_recreo:                'Salida Recreo',
  salida_bus:                   'Salida Transporte',
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

function formatearHora(dateTime) { // Extraccion de hora y minuto
  if (!dateTime) return '';
  const fechaUTC = new Date(String(dateTime).replace(' ', 'T') + 'Z');
  if (isNaN(fechaUTC.getTime())) return '';
  const hh = String(fechaUTC.getHours()).padStart(2, '0');
  const mm = String(fechaUTC.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function fechaHoy() { // extraccion del dia de hoy con formato yyyy-mm-dd
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatearFechaParaApp(yyyymmdd) { // da vuelta a formato de fecha para el front
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
}

export default function DashboardScreen() {
  // Estados de los graficos y metricas
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpis, setKpis] = useState({
    asistenciaHoy: 0,
    asistenciaMedia: '0%',
    incidenciasHoy: 0,
  });
  const [chartData, setChartData] = useState([]);
  //Datos de la segunda semana cuando esta activa la comparacion. null si no hay.
  const [chartData2, setChartData2] = useState(null);
  //Fecha (string YYYY-MM-DD) de la semana del grafico. Por defecto hoy.
  //Cualquier fecha de la semana sirve: el backend calcula el lunes.
  const [semanaChart, setSemanaChart] = useState(fechaHoy());
  //Fecha de la semana a comparar. Si es null no se compara.
  const [semanaChart2, setSemanaChart2] = useState(null);
  //Etiquetas legibles "L 8 may - V 12 may" para mostrar al usuario
  const [semanaLabel, setSemanaLabel] = useState('Esta semana');
  const [semanaLabel2, setSemanaLabel2] = useState('');
  //Modales de seleccion de semana (uno para semana principal, otro para semana2)
  const [mostrarSelectorSemana, setMostrarSelectorSemana] = useState(false);
  const [seleccionandoSemana2, setSeleccionandoSemana2] = useState(false);

  const [tooltip, setTooltip] = useState(null);
  // Estados de la tabla de registros y filtros
  const [tipoActivo, setTipoActivo] = useState('entrada');
  const [fecha, setFecha] = useState(fechaHoy());
  const [cursoFiltro, setCursoFiltro] = useState(FILTRO_TODOS);
  const [mostrarFiltroCursos, setMostrarFiltroCursos] = useState(false);
  const [usrTypeFiltro, setUsrTypeFiltro] = useState('alumno');
  const [buscar, setBuscar] = useState('');
  const [buscarDebounced, setBuscarDebounced] = useState('');
  const [mostrarSelectorFecha, setMostrarSelectorFecha] = useState(false);

  const [registros, setRegistros] = useState({ entrada: [], salida: [] });
  const [totales, setTotales]     = useState({ entrada: 0, salida: 0 });
  const [cargando, setCargando]   = useState({ entrada: false, salida: false });
  const [cursosVistos, setCursosVistos] = useState(new Set());

  const offsetsRef = useRef({ entrada: 0, salida: 0 });
  const cargandoRef = useRef({ entrada: false, salida: false });
  const fetchTokenRef = useRef(0);

  // Saca el lunes y vierens de cualequier dia dado y lo formatea en "dd mmm - dd mmm"
  const calcularLabelSemana = (fechaReferencia) => {
    if (!fechaReferencia) return '';
    const ref = new Date(fechaReferencia + 'T00:00:00Z');
    const dia = ref.getUTCDay();
    const offsetLunes = dia === 0 ? 6 : dia - 1;
    const lunes = new Date(ref);
    lunes.setUTCDate(ref.getUTCDate() - offsetLunes);
    const viernes = new Date(lunes);
    viernes.setUTCDate(lunes.getUTCDate() + 4);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const f = (d) => `${d.getUTCDate()} ${meses[d.getUTCMonth()]}`;
    return `${f(lunes)} - ${f(viernes)}`;
  };

  const cargarKpis = useCallback(async () => { // coge todos los kpis y datos del gradico
    try {
      const params = new URLSearchParams();
      // inyectamos las fechas solicitadas
      if (semanaChart) params.append('semana', semanaChart);
      if (semanaChart2) params.append('semana2', semanaChart2);
      const url = `${API_ENDPOINTS.DASHBOARD}?${params.toString()}`;
      const data = await apiClient.get(url);
      if (data.success) {
        setKpis(data.kpis);
        const sem = data.semana || { chartData: data.chartData || [] };
        setChartData(sem.chartData || []);
        setSemanaLabel(calcularLabelSemana(sem.lunes || semanaChart));
        if (data.semana2) { // Si hay una segunda semana la añade
          setChartData2(data.semana2.chartData || []);
          setSemanaLabel2(calcularLabelSemana(data.semana2.lunes || semanaChart2));
        } else {
          setChartData2(null);
          setSemanaLabel2('');
        }
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error.message);
    } finally {
      setLoadingKpis(false);
    }
  }, [semanaChart, semanaChart2]);

  useEffect(() => {// Carga kpis iniciales
    cargarKpis();
  }, [cargarKpis]);

  useEffect(() => { // Escucha variable buscar cada vez que se teclea y espera 300ms antes de guardarlo
    const timer = setTimeout(() => {
      setBuscarDebounced(buscar.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [buscar]);

  // Carga registros y recibe que pestaña cargar
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
      if (usrTypeFiltro === 'alumno' || usrTypeFiltro === 'profesor') {
        params.append('usr_type', usrTypeFiltro);
      }
      if (buscarDebounced) {
        params.append('buscar', buscarDebounced);
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
  }, [fecha, cursoFiltro, usrTypeFiltro, buscarDebounced]);

  useEffect(() => {
    fetchTokenRef.current += 1;
    offsetsRef.current = { entrada: 0, salida: 0 };
    setRegistros({ entrada: [], salida: [] });
    setTotales({ entrada: 0, salida: 0 });
    cargarRegistros('entrada', true);
    cargarRegistros('salida', true);
  }, [fecha, cursoFiltro, usrTypeFiltro, buscarDebounced]);


  useEffect(() => { // lazy load si el usario cambia la pestaña y esta vacia la pide
    if (registros[tipoActivo].length === 0 && !cargandoRef.current[tipoActivo]) {
      cargarRegistros(tipoActivo, true);
    }
  }, [tipoActivo]);

  const cargarSiguientePagina = useCallback(() => { // funcion para sacar mas registros si los hay sino para
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

  useEffect(() => { // Cada 10 segundos se recarga 
    const id = setInterval(() => {
      cargarKpisRef.current();
      cargarRegistrosRef.current('entrada', true);
      cargarRegistrosRef.current('salida', true);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const refrescarManual = useCallback(() => { // refrescar los datos de manera manual
    cargarKpisRef.current();
    cargarRegistrosRef.current('entrada', true);
    cargarRegistrosRef.current('salida', true);
  }, []);

  const handleExportar = () => {  // Utilidad de exportación de CSV
    const url = API_ENDPOINTS.EXPORTAR_ACCESOS;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url).catch(err => console.error('Error al abrir URL:', err.message));
  };

  //Abre el modal de seleccion de fecha (web + movil unificado)
  const cambiarFecha = () => setMostrarSelectorFecha(true);

    //Tooltips
  const handleMouseEnter = (segId, rawValue, segLabel, tipo) => { // ver cuando entra el raton
      if (Platform.OS === 'web') { // se ve en que plataforma esta 
          const count = rawValue / 5;
          if (count === 0) return;
          //Texto del tooltip: "5 Puntuales (entradas)" o "3 Anticipadas (salidas)"
          setTooltip({
              segId,
              text: `${count} ${segLabel}`,
          });
      }
  };

  const handleMouseLeave = () => { // ver cuando sale
      if (Platform.OS === 'web') {
          setTooltip(null);
      }
  };
  // Dibuja desde cero el gráfico de barras apilado mediante CSS Flexbox.
  const renderBarras = (chartArr, prefijo) => (
    <View style={styles.chartContainer}>
      {chartArr.map((item, dIndex) => {
        //Buscar si hay un tooltip activo en CUALQUIER segmento de esta columna
        const segIdEntrada0 = `${prefijo}-${dIndex}-entrada-0`;
        const hoveredEnEstaColumna = tooltip && tooltip.segId && tooltip.segId.startsWith(`${prefijo}-${dIndex}-`);
        return (
          <View key={dIndex} style={styles.barWrapper}>
            <View style={styles.parBarras}>
              {['entrada', 'salida'].map((tipo) => (
                <View key={tipo} style={styles.miniBarBackground}>
                  {(item[tipo]?.segments || []).map((seg, sIndex) => {
                    const segId = `${prefijo}-${dIndex}-${tipo}-${sIndex}`;
                    const isHovered = tooltip && tooltip.segId === segId;
                    return (
                      <View
                        key={sIndex}
                        onMouseEnter={() => handleMouseEnter(segId, seg.value, seg.label, tipo)}
                        onMouseLeave={handleMouseLeave}
                        style={[
                          styles.barFillSegment,
                          {
                            height: `${Math.min(seg.value, 100)}%`,
                            backgroundColor: seg.color,
                            opacity: isHovered ? 0.8 : 1,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
      {/* Si es web y estamos hovereando la columna, pinta la cajita negra encima de la barra */}
            {hoveredEnEstaColumna && (
              <View style={styles.tooltipContainerFix}>
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipText}>{tooltip.text}</Text>
                </View>
                <View style={styles.tooltipArrow} />
              </View>
            )}
            {/* Etiqueta del día debajo de las columnas (ej. "L", "M") */}
            <Text style={styles.barLabel}>{item.day}</Text>
          </View>
        );
      })}
    </View>
  );
  // Componente que dibuja una fila del historial por persona.
  const renderRegistro = ({ item }) => {
    const color = COLORES_REG_TYPE[item.reg_type] || { bg: '#F1F5F9', fg: '#475569' };
    const etiqueta = ETIQUETAS_REG_TYPE[item.reg_type] || item.reg_type;
    const subtitulo = item.usr_type === 'alumno'
      ? (item.cursoLargo || 'Sin curso')
      : 'Profesor';

    return (
      <View style={styles.fila}>
        <View style={styles.filaTop}>
          <View style={styles.filaAvatar}>
            {item.photo ? (
              <Image source={{ uri: `data:image/png;base64,${item.photo}` }} style={styles.filaFoto} />
            ) : (
              <Ionicons name="person" size={20} color="#94A3B8" />
            )}
          </View>

          <View style={styles.filaInfo}>
            <Text style={styles.filaNombre} numberOfLines={1}>{item.nombre}</Text>
            <Text style={styles.filaSub} numberOfLines={2}>{subtitulo}</Text>
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

        <View style={styles.filaOperadorBar}>
          <Feather name="user-check" size={11} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.filaOperadorLabelInline}>Escaneado por: </Text>
          <Text style={styles.filaOperadorNombre} numberOfLines={1}>
            {item.operadorNombre || 'Sin operador'}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => ( // Renderiza toda la parte superior
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
            <Text style={styles.cardTitle}>Asistencia semanal</Text>
          </View>
          <View style={styles.chartHeader}>
            <TouchableOpacity
              style={styles.chartHeaderBoton}
              onPress={() => { setSeleccionandoSemana2(false); setMostrarSelectorSemana(true); }}
              activeOpacity={0.7}
            >
              <Feather name="calendar" size={14} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={styles.chartHeaderTexto}>{semanaLabel}</Text>
            </TouchableOpacity>

            {chartData2 == null ? (
              <TouchableOpacity
                style={[styles.chartHeaderBoton, { marginLeft: 8, backgroundColor: '#F8FAFC' }]}
                onPress={() => { setSeleccionandoSemana2(true); setMostrarSelectorSemana(true); }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={[styles.chartHeaderTexto, { color: '#475569' }]}>Comparar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.chartHeaderBoton, { marginLeft: 8, backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                onPress={() => { setSemanaChart2(null); setChartData2(null); setSemanaLabel2(''); }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={[styles.chartHeaderTexto, { color: '#DC2626' }]}>Quitar comparacion</Text>
              </TouchableOpacity>
            )}

            {semanaChart !== fechaHoy() && (
              <TouchableOpacity
                style={[styles.chartHeaderBoton, { marginLeft: 8 }]}
                onPress={() => setSemanaChart(fechaHoy())}
                activeOpacity={0.7}
              >
                <Feather name="rotate-ccw" size={14} color="#2563EB" />
              </TouchableOpacity>
            )}
          </View>

          {/*
            Cuando hay comparacion, mostramos UN titulo encima de CADA grafico
            con la etiqueta de la semana correspondiente. Asi siempre se sabe
            que grafico es que semana. Cuando NO hay comparacion, omitimos el
            titulo porque ya esta el boton de seleccion arriba.
          */}
          {chartData2 != null && (
            <View style={styles.chartSemanaHeader}>
              <Feather name="calendar" size={12} color="#1D4ED8" style={{ marginRight: 4 }} />
              <Text style={styles.chartSemanaHeaderTexto}>Semana actual: {semanaLabel}</Text>
            </View>
          )}
          {renderBarras(chartData, 'main', tooltip, handleMouseEnter, handleMouseLeave)}

          {chartData2 != null && (
            <View style={{ marginTop: 14 }}>
              <View style={[styles.chartSemanaHeader, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Feather name="calendar" size={12} color="#A16207" style={{ marginRight: 4 }} />
                <Text style={[styles.chartSemanaHeaderTexto, { color: '#A16207' }]}>
                  Comparando con: {semanaLabel2}
                </Text>
              </View>
              {renderBarras(chartData2, 'comp', tooltip, handleMouseEnter, handleMouseLeave)}
            </View>
          )}

          {/*
            Leyenda doble. Como entrada y salida usan los MISMOS colores con etiquetas
            distintas, dividimos la leyenda en dos filas. Asi se entiende mejor que
            azul significa cosas distintas segun la barra.
            Profesores tienen color propio en cada lado: violeta entradas, amarillo salidas.
          */}
          <View style={styles.legendContainer}>
            <Text style={styles.legendGroupTitle}>Entradas:</Text>
            <LegendItem color="#3B82F6" label="Puntuales" />
            <LegendItem color="#EF4444" label="Tardias" />
            <LegendItem color="#10B981" label="Recreo" />
            <LegendItem color="#A855F7" label="Profesores" />
          </View>
          <View style={styles.legendContainer}>
            <Text style={styles.legendGroupTitle}>Salidas:</Text>
            <LegendItem color="#3B82F6" label="Regulares" />
            <LegendItem color="#EF4444" label="Anticipadas" />
            <LegendItem color="#10B981" label="Transporte/Recreo" />
            <LegendItem color="#EAB308" label="Profesores" />
          </View>
        </View>
      )}

      <View style={styles.tabsContainer}>
        {[
          { id: 'alumno',   label: 'Alumnos',    icon: 'user' },
          { id: 'profesor', label: 'Profesores', icon: 'briefcase' },
          { id: 'todos',    label: 'Todos',      icon: 'users' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.tabBoton, usrTypeFiltro === opt.id && styles.tabBotonActivo]}
            onPress={() => setUsrTypeFiltro(opt.id)}
            activeOpacity={0.7}
          >
            <Feather name={opt.icon} size={14} color={usrTypeFiltro === opt.id ? '#fff' : '#475569'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabTexto, usrTypeFiltro === opt.id && styles.tabTextoActivo]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          style={styles.filtroBoton}
          onPress={() => setMostrarFiltroCursos(true)}
          activeOpacity={0.7}
        >
          <Feather name="filter" size={14} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.filtroTexto} numberOfLines={1}>
            {cursoFiltro === FILTRO_TODOS ? 'Cursos: Todos' : getNombreCurso(cursoFiltro)}
          </Text>
          <Feather name="chevron-down" size={14} color="#2563EB" />
        </TouchableOpacity>

        <View style={styles.buscadorWrap}>
          <Feather name="search" size={14} color="#2563EB" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.buscadorInput}
            placeholder="Buscar por nombre..."
            placeholderTextColor="#94A3B8"
            value={buscar}
            onChangeText={setBuscar}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {buscar.length > 0 && (
            <TouchableOpacity onPress={() => setBuscar('')} style={{ padding: 4 }}>
              <Feather name="x" size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
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
        ListHeaderComponent={renderHeader()}
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

      <Modal
        animationType="fade"
        transparent
        visible={mostrarSelectorFecha}
        onRequestClose={() => setMostrarSelectorFecha(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMostrarSelectorFecha(false)}
        >
          <View style={styles.modalFiltro} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalFiltroTitulo}>Seleccionar fecha</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {(() => {
                const opciones = [];
                const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const hoy = new Date();
                const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
                const anteayer = new Date(); anteayer.setDate(hoy.getDate() - 2);
                const haceUnaSemana = new Date(); haceUnaSemana.setDate(hoy.getDate() - 7);
                const haceUnMes = new Date(); haceUnMes.setMonth(hoy.getMonth() - 1);
                opciones.push({ label: 'Hoy',          valor: fmt(hoy) });
                opciones.push({ label: 'Ayer',         valor: fmt(ayer) });
                opciones.push({ label: 'Anteayer',     valor: fmt(anteayer) });
                opciones.push({ label: 'Hace 1 semana',valor: fmt(haceUnaSemana) });
                opciones.push({ label: 'Hace 1 mes',   valor: fmt(haceUnMes) });
                return opciones.map(op => (
                  <TouchableOpacity
                    key={op.valor}
                    style={[styles.opcionCurso, fecha === op.valor && styles.opcionCursoActiva]}
                    onPress={() => { setFecha(op.valor); setMostrarSelectorFecha(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.opcionCursoTexto, fecha === op.valor && styles.opcionCursoTextoActivo]}>
                        {op.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{formatearFechaParaApp(op.valor)}</Text>
                    </View>
                    {fecha === op.valor && <Feather name="check" size={18} color="#2563EB" />}
                  </TouchableOpacity>
                ));
              })()}
              {/*En web tambien permitimos escribir una fecha exacta*/}
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.opcionCurso}
                  onPress={() => {
                    const nueva = window.prompt('Fecha (YYYY-MM-DD):', fecha);
                    if (nueva && /^\d{4}-\d{2}-\d{2}$/.test(nueva)) {
                      setFecha(nueva);
                      setMostrarSelectorFecha(false);
                    }
                  }}
                >
                  <Text style={[styles.opcionCursoTexto, { color: '#475569' }]}>Otra fecha…</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={mostrarSelectorSemana}
        onRequestClose={() => setMostrarSelectorSemana(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMostrarSelectorSemana(false)}
        >
          <View style={styles.modalFiltro} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalFiltroTitulo}>
              {seleccionandoSemana2 ? 'Comparar con semana...' : 'Seleccionar semana'}
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {(() => {
                const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const opciones = [];
                for (let i = 0; i < 8; i++) {
                  const ref = new Date();
                  ref.setDate(ref.getDate() - i * 7);
                  const label = i === 0 ? 'Esta semana' : (i === 1 ? 'Semana pasada' : `Hace ${i} semanas`);
                  opciones.push({ label, valor: fmt(ref) });
                }
                const valorActivo = seleccionandoSemana2 ? semanaChart2 : semanaChart;
                return opciones.map(op => (
                  <TouchableOpacity
                    key={op.valor}
                    style={[styles.opcionCurso, valorActivo === op.valor && styles.opcionCursoActiva]}
                    onPress={() => {
                      if (seleccionandoSemana2) {
                        setSemanaChart2(op.valor);
                      } else {
                        setSemanaChart(op.valor);
                      }
                      setMostrarSelectorSemana(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.opcionCursoTexto, valorActivo === op.valor && styles.opcionCursoTextoActivo]}>
                        {op.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {calcularLabelSemana(op.valor)}
                      </Text>
                    </View>
                    {valorActivo === op.valor && <Feather name="check" size={18} color="#2563EB" />}
                  </TouchableOpacity>
                ));
              })()}
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

// Estilos 
const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },
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
    height: 170,
    alignItems: 'flex-end',
    paddingBottom: 10,
    paddingTop: 30,
    zIndex: 10,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  parBarras: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 8,
  },
  miniBarBackground: {
    width: 14,
    height: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFillSegment: {
    width: '100%',
  },
  tooltipContainerFix: {
    position: 'absolute',
    top: -8,
    left: '50%',
    transform: [{ translateX: -50 }],
    alignItems: 'center',
    width: 100,
    zIndex: 999,
  },

  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
  },
  chartHeaderBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chartHeaderTexto: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 11,
  },
  chartCompararLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  chartSemanaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignSelf: 'center',
  },
  chartSemanaHeaderTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },

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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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

  barLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  legendGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginRight: 8,
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
  filtrosFila: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
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
  tituloTabla: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerTabla: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  btnRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  btnRefreshTexto: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 11,
    marginLeft: 6,
  },
  fila: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
  },
  filaTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
    minWidth: 90,
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
    lineHeight: 14,
  },
  filaOperadorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filaOperadorLabelInline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filaOperadorNombre: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    flexShrink: 1,
  },
  buscadorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexGrow: 1,
    minWidth: 160,
  },
  buscadorInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    paddingVertical: 4,
    //En web, quitamos el outline al focusear
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
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