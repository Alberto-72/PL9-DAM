import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Platform, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';

//============================================
//CONSTANTES DE HORARIOS DEL CENTRO
//
//Si cambian los horarios del centro, se modifican aqui en un solo sitio.
//Todos los valores en minutos desde medianoche para facilitar comparaciones.
//============================================
const HORARIO = {
  inicioJornada:      8 * 60 + 5,    //08:05 - antes -> entrada puntual
  inicioRecreo:      10 * 60 + 45,   //10:45
  finRecreo:         11 * 60 + 15,   //11:15
  inicioBus:         13 * 60 + 50,   //13:50
  finJornada:        14 * 60,        //14:00 (salida regular)
  finVentanaRegular: 14 * 60 + 15,   //14:15
};

//============================================
//TIPOS reg_type SEGUN MODELO ODOO
//============================================
const REG_TYPE = {
  ENTRADA_PUNTUAL:               'entrada_puntual',
  ENTRADA_RECREO:                'entrada_recreo',
  ENTRADA_TARDIA:                'entrada_tardia',
  ENTRADA_PROF:                  'entrada_prof',
  SALIDA_ANTICIPADA:             'salida_anticipada',
  SALIDA_RECREO:                 'salida_recreo',
  SALIDA_BUS:                    'salida_bus',
  SALIDA_ANTICIPADA_AUTORIZADA:  'salida_anticipada_autorizada',
  SALIDA_REGULAR:                'salida_regular',
  SALIDA_PROF:                   'salida_prof',
  ERROR:                         'error',
  NO_AUTORIZADO:                 'no_autorizado',
};

const ETIQUETAS = {
  [REG_TYPE.ENTRADA_PUNTUAL]:               'Entrada Puntual',
  [REG_TYPE.ENTRADA_RECREO]:                'Entrada Recreo',
  [REG_TYPE.ENTRADA_TARDIA]:                'Entrada Tardia',
  [REG_TYPE.ENTRADA_PROF]:                  'Entrada Profesor',
  [REG_TYPE.SALIDA_ANTICIPADA]:             'Salida Anticipada',
  [REG_TYPE.SALIDA_RECREO]:                 'Salida Recreo',
  [REG_TYPE.SALIDA_BUS]:                    'Salida Transporte',
  [REG_TYPE.SALIDA_ANTICIPADA_AUTORIZADA]:  'Salida Anticipada Autorizada',
  [REG_TYPE.SALIDA_REGULAR]:                'Salida Regular',
  [REG_TYPE.SALIDA_PROF]:                   'Salida Profesor',
  [REG_TYPE.ERROR]:                         'Incidencia',
  [REG_TYPE.NO_AUTORIZADO]:                 'No Autorizado',
};

//============================================
//HELPERS DE TIEMPO Y EDAD
//============================================

function minutosAhora() {
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes();
}

function fechaHoy() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
}

//Cumpleanios real, no resta de anios. Alguien nacido en diciembre 2008
//no es mayor de edad hoy (mayo 2026) hasta cumplir 18 en diciembre 2026.
function esMayorDeEdad(fechaNacimiento) {
  if (!fechaNacimiento) return false;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mesDiff = hoy.getMonth() - nacimiento.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad >= 18;
}

//============================================
//COMPONENTE PRINCIPAL
//============================================
export default function ScannerScreen({ route, navigation }) {
  //Username del profesor logueado en el movil. Lo necesitamos para que el backend
  //registre quien opera el escaneo en el campo profesor_id (operador, no escaneado).
  const { username: operadorUsername } = useAuth();

  const [alumno, setAlumno] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [uidWeb, setUidWeb] = useState('');

  //Modo manual: si esta activo, la proxima pasada se fuerza al tipo elegido.
  //Se resetea automaticamente despues de cada pasada para no afectar las siguientes.
  // - null            : modo automatico (default)
  // - 'forzar_entrada': proxima pasada sera tratada como entrada
  // - 'forzar_salida' : proxima pasada sera tratada como salida
  const [modoManual, setModoManual] = useState(null);
  const [modalManualVisible, setModalManualVisible] = useState(false);

  const [modoBinding, setModoBinding] = useState(null);
  const [bindingMensaje, setBindingMensaje] = useState(null);

  useEffect(() => {
    if (route.params?.usuarioAVincular) {
      setModoBinding(route.params.usuarioAVincular);
      setAlumno(null);
      setBindingMensaje(null);
      navigation.setParams({ usuarioAVincular: undefined });
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.usuarioAVincular]);

  //Inicializa NFC al montar
  useEffect(() => {
    async function initNfc() {
      try {
        if (Platform.OS !== 'web' && NfcManager) {
          const supported = await NfcManager.isSupported();
          if (supported) await NfcManager.start();
        }
      } catch (ex) {
        console.warn("Error iniciando NFC:", ex);
      }
    }
    initNfc();

    return () => {
      if (Platform.OS !== 'web' && NfcManager) {
        NfcManager.cancelTechnologyRequest().catch(() => 0);
      }
    };
  }, []);

  //Validacion desde busqueda manual (StudentsListScreen)
  useEffect(() => {
    if (route.params?.studentToValidate) {
      const alumnoManual = route.params.studentToValidate;
      procesarValidacion({
        ...alumnoManual,
        uid: alumnoManual.uid || 'SIN_NFC',
        usr_type: 'alumno'
      });
      navigation.setParams({ studentToValidate: undefined });
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.studentToValidate]);

  //============================================
  //LLAMADAS AL BACKEND
  //============================================

  //Manda el registro al backend.
  //
  //origen_lector: el backend usa este campo para decidir quien firma como profesor_id:
  //  - 'usb'   -> el operador es 'lectornfc' (lector anonimo, no sabemos quien lo usa)
  //  - 'movil' -> el operador es el usuario logueado en la app (operador_username)
  //
  //operador_username: solo se usa cuando origen_lector === 'movil'. Es el username del
  //profesor logueado en este movil. El backend busca su id en Odoo y lo pone como
  //profesor_id del registro (cuando se ha escaneado un alumno).
  const addRegister = async (uid, usr_type, reg_type) => {
    try {
      const now = new Date();
      const dateTime = now.toISOString().replace('T', ' ').substring(0, 19);
      await apiClient.post(API_ENDPOINTS.REGISTER, {
        uid, usr_type,
        mensajeEstado: reg_type,
        dateTime,
        origen_lector: Platform.OS === 'web' ? 'usb' : 'movil',
        operador_username: operadorUsername || null,
      });
    } catch (error) {
      console.error("Error saving register:", error.message);
    }
  };

  //Consulta el historial de hoy. Devuelve { lista, total, registrosRecreo }.
  //
  //Lo usamos para:
  //  - Profesores: alternar entrada_prof / salida_prof por paridad
  //  - Alumnos en recreo: alternar salida_recreo / entrada_recreo
  //  - Alumnos en franjas intermedias: decidir entrada (si no hay registros previos)
  //    o salida (si ya hay)
  const consultarHistorialHoy = async (uid) => {
    try {
      const url = `${API_BASE_URL}/api/registros/${encodeURIComponent(uid)}?fecha=${fechaHoy()}`;
      const data = await apiClient.get(url);
      if (!data || !data.success) return { lista: [], total: 0, registrosRecreo: 0 };

      const lista = data.registros || [];
      const registrosRecreo = lista.filter(r =>
        r.reg_type === REG_TYPE.SALIDA_RECREO || r.reg_type === REG_TYPE.ENTRADA_RECREO
      ).length;

      return { lista, total: lista.length, registrosRecreo };
    } catch (error) {
      console.error("Error consultando historial:", error.message);
      return { lista: [], total: 0, registrosRecreo: 0 };
    }
  };

  //============================================
  //RESOLUCION DEL reg_type
  //
  //Devuelve un objeto:
  //  { tipo: 'auto', regType, estado }    -> decision automatica
  //  { tipo: 'preguntar' }                 -> menor sin autorizacion, lanzar dialogo
  //
  //"estado" es codigo de UI: 'exito', 'precaucion', 'error'
  //============================================
  const resolverRegType = async (datosUsuario) => {
    const minutos = minutosAhora();
    const enRecreo = minutos >= HORARIO.inicioRecreo && minutos <= HORARIO.finRecreo;
    const enSalidaTardia = minutos >= HORARIO.inicioBus && minutos < HORARIO.finVentanaRegular;

    //--- PROFESORES: siempre alternan entrada/salida por historial ---
    if (datosUsuario.usr_type === 'profesor') {
      const { total } = await consultarHistorialHoy(datosUsuario.uid);
      const regType = total % 2 === 0 ? REG_TYPE.ENTRADA_PROF : REG_TYPE.SALIDA_PROF;
      return { tipo: 'auto', regType, estado: 'exito' };
    }

    //--- ALUMNOS ---

    //CASO 1: Antes de 8:05 -> entrada puntual (inequivoco)
    if (minutos < HORARIO.inicioJornada) {
      return { tipo: 'auto', regType: REG_TYPE.ENTRADA_PUNTUAL, estado: 'exito' };
    }

    //CASO 2: Franja de recreo (10:45 - 11:15) -> alternar entrada/salida
    if (enRecreo) {
      const { registrosRecreo } = await consultarHistorialHoy(datosUsuario.uid);
      const regType = registrosRecreo % 2 === 0
        ? REG_TYPE.SALIDA_RECREO   //primera -> sale al recreo
        : REG_TYPE.ENTRADA_RECREO; //segunda -> vuelve
      return { tipo: 'auto', regType, estado: 'exito' };
    }

    //CASO 3: Franja salida tardia (13:50 - 14:15)
    if (enSalidaTardia) {
      //13:50-14:00 con bus -> salida_bus. Resto -> salida_regular
      const enFranjaBus = minutos >= HORARIO.inicioBus && minutos < HORARIO.finJornada;
      const regType = (enFranjaBus && datosUsuario.tieneTransporte)
        ? REG_TYPE.SALIDA_BUS
        : REG_TYPE.SALIDA_REGULAR;
      return { tipo: 'auto', regType, estado: 'exito' };
    }

    //CASO 4: Despues de 14:15 -> salida regular (igual que dentro de la ventana).
    //Decision del centro: cualquier salida desde las 14:00 en adelante se considera
    //salida regular, sin distincion de "ventana de gracia". Aunque salgan a las 18:00,
    //sigue siendo una salida normal del centro.
    if (minutos >= HORARIO.finVentanaRegular) {
      return { tipo: 'auto', regType: REG_TYPE.SALIDA_REGULAR, estado: 'exito' };
    }

    //CASO 5: Franjas intermedias (8:05-10:45 y 11:15-13:50)
    //
    //Logica de alternancia por paridad (igual que profesores y recreo):
    //  - Pasadas pares (0, 2, 4...) -> es ENTRADA (entrada_tardia)
    //  - Pasadas impares (1, 3, 5...) -> es SALIDA
    //
    //Esto cubre el caso de un alumno que entra-sale-vuelve a entrar-vuelve a salir
    //el mismo dia (cita medica con vuelta al centro).
    //Pega: si se olvida una pasada, las siguientes quedan invertidas. Para esos
    //casos esta el "modo manual" oculto en el engranaje.
    //
    //En el caso de salida, aplicamos el flujo mayor/menor:
    //  - Mayor de edad: salida_anticipada (sin "autorizada", se va libremente)
    //  - Menor de edad: preguntar al adulto presente
    const { total } = await consultarHistorialHoy(datosUsuario.uid);
    const esPar = total % 2 === 0;

    if (esPar) {
      //Pasada par -> es una entrada
      return { tipo: 'auto', regType: REG_TYPE.ENTRADA_TARDIA, estado: 'precaucion' };
    }

    //Pasada impar -> es una salida.
    //REGLA: mayores de edad pueden salir libremente -> salida_anticipada (sin "autorizada")
    //       menores necesitan autorizacion del adulto presente -> preguntar
    //La etiqueta "salida_anticipada_autorizada" se reserva para menores con OK.
    const esAdulto = esMayorDeEdad(datosUsuario.fechaNacimiento);
    if (esAdulto) {
      return { tipo: 'auto', regType: REG_TYPE.SALIDA_ANTICIPADA, estado: 'precaucion' };
    }

    //Menor saliendo: hay que preguntar al adulto presente
    return { tipo: 'preguntar' };
  };

  //============================================
  //APLICAR MODO MANUAL
  //
  //Si el profesor activo el modo manual oculto antes de pasar la tarjeta,
  //esta funcion sobreescribe el reg_type calculado por la logica automatica.
  //Solo afecta a alumnos (los profesores siempre van por historial).
  //
  //Devuelve null si no hay modo manual activo, o un objeto { tipo, regType, estado }
  //para sustituir la decision normal.
  //============================================
  const aplicarModoManual = (datosUsuario) => {
    if (!modoManual) return null;
    if (datosUsuario.usr_type !== 'alumno') return null; //modo manual no aplica a profesores

    const minutos = minutosAhora();

    if (modoManual === 'forzar_entrada') {
      //Decidimos que tipo de entrada usar segun la hora
      if (minutos < HORARIO.inicioJornada) {
        return { tipo: 'auto', regType: REG_TYPE.ENTRADA_PUNTUAL, estado: 'exito' };
      }
      if (minutos >= HORARIO.inicioRecreo && minutos <= HORARIO.finRecreo) {
        return { tipo: 'auto', regType: REG_TYPE.ENTRADA_RECREO, estado: 'exito' };
      }
      return { tipo: 'auto', regType: REG_TYPE.ENTRADA_TARDIA, estado: 'precaucion' };
    }

    if (modoManual === 'forzar_salida') {
      //Decidimos que tipo de salida usar segun la hora
      if (minutos >= HORARIO.inicioRecreo && minutos <= HORARIO.finRecreo) {
        return { tipo: 'auto', regType: REG_TYPE.SALIDA_RECREO, estado: 'exito' };
      }
      const enFranjaBus = minutos >= HORARIO.inicioBus && minutos < HORARIO.finJornada;
      if (enFranjaBus && datosUsuario.tieneTransporte) {
        return { tipo: 'auto', regType: REG_TYPE.SALIDA_BUS, estado: 'exito' };
      }
      if (minutos >= HORARIO.inicioBus && minutos < HORARIO.finVentanaRegular) {
        return { tipo: 'auto', regType: REG_TYPE.SALIDA_REGULAR, estado: 'exito' };
      }
      //Resto de horarios: salida anticipada con flujo mayor/menor
      //Misma regla: mayor -> salida_anticipada (no autorizada), menor -> preguntar
      const esAdulto = esMayorDeEdad(datosUsuario.fechaNacimiento);
      if (esAdulto) {
        return { tipo: 'auto', regType: REG_TYPE.SALIDA_ANTICIPADA, estado: 'precaucion' };
      }
      return { tipo: 'preguntar' };
    }

    return null;
  };

  //============================================
  //PROCESAR VALIDACION
  //============================================
  const procesarValidacion = async (datosUsuario) => {
    //Primero comprobamos si hay modo manual activo
    const decisionManual = aplicarModoManual(datosUsuario);
    const decision = decisionManual || await resolverRegType(datosUsuario);

    //Decision automatica directa
    if (decision.tipo === 'auto') {
      finalizarValidacion(datosUsuario, decision.regType, decision.estado);
      return;
    }

    //Hay que preguntar al adulto presente
    const mensaje = `Control de Menores\n\nEl alumno ${datosUsuario.nombre} es menor de edad.\n\n¿Va acompañado de un adulto autorizado?`;

    if (Platform.OS === 'web') {
      const confirmado = window.confirm(mensaje);
      if (confirmado) {
        finalizarValidacion(datosUsuario, REG_TYPE.SALIDA_ANTICIPADA_AUTORIZADA, 'precaucion');
      } else {
        finalizarValidacion(datosUsuario, REG_TYPE.NO_AUTORIZADO, 'error');
      }
      return;
    }

    Alert.alert(
      "Control de Menores",
      mensaje,
      [
        {
          text: "NO - Denegar",
          style: "destructive",
          onPress: () => finalizarValidacion(datosUsuario, REG_TYPE.NO_AUTORIZADO, 'error')
        },
        {
          text: "SI - Autorizar",
          onPress: () => finalizarValidacion(datosUsuario, REG_TYPE.SALIDA_ANTICIPADA_AUTORIZADA, 'precaucion')
        }
      ]
    );
  };

  //Persiste y actualiza la UI
  const finalizarValidacion = (datosUsuario, regType, estado) => {
    const autorizado = (estado !== 'error');
    const newState = {
      ...datosUsuario,
      autorizado,
      estado,
      mensajeEstado: regType,
      displayText: ETIQUETAS[regType] || regType,
    };
    setAlumno(newState);
    addRegister(newState.uid || 'SIN_NFC', newState.usr_type || 'alumno', regType);
    //Reseteamos el modo manual: solo afecta a UNA pasada
    setModoManual(null);
  };

  //============================================
  //LECTORES
  //============================================

  const vincularNfc = async (uidLeido) => {
    if (!modoBinding) return;
    try {
      const respuesta = await apiClient.post(`${API_BASE_URL}/api/vincular-nfc`, {
        id: modoBinding.id,
        tipo: modoBinding.tipo,
        uid: uidLeido,
      });

      if (respuesta && respuesta.success) {
        setBindingMensaje({
          tipo: 'exito',
          texto: `NFC vinculado correctamente a ${modoBinding.nombre}`,
        });
        setTimeout(() => {
          setModoBinding(null);
          setBindingMensaje(null);
          navigation.goBack();
        }, 1200);
      } else {
        setBindingMensaje({
          tipo: 'error',
          texto: respuesta?.message || 'No se pudo vincular el NFC',
        });
      }
    } catch (error) {
      const msg = error?.response?.data?.message
        || error?.message
        || 'Error al vincular NFC';
      const code = error?.response?.data?.code;
      setBindingMensaje({
        tipo: 'error',
        texto: code === 'UID_EN_USO' ? msg : `Error: ${msg}`,
      });
    }
  };

  const procesarLectorWeb = async () => {
    if (!uidWeb) return;
    try {
      setEscaneando(true);

      let hexOriginal = BigInt(uidWeb).toString(16).padStart(8, '0');
      let byte1 = hexOriginal.substring(6, 8);
      let byte2 = hexOriginal.substring(4, 6);
      let byte3 = hexOriginal.substring(2, 4);
      let byte4 = hexOriginal.substring(0, 2);
      let hexInvertido = (byte1 + byte2 + byte3 + byte4).toUpperCase();

      if (modoBinding) {
        await vincularNfc(hexInvertido);
        return;
      }

      const data = await apiClient.post(API_ENDPOINTS.VERIFICAR_NFC, { tarjetaId: hexInvertido });

      if (data.success) {
        procesarValidacion({
          nombre: data.nombre,
          curso: data.cursoCompleto || data.curso || 'Sin curso',
          foto: data.foto || null,
          fechaNacimiento: data.fechaNacimiento,
          tieneTransporte: data.tieneTransporte,
          uid: hexInvertido,
          usr_type: data.usr_type || 'alumno'
        });
      } else {
        finalizarValidacion(
          { nombre: 'Desconocido', curso: 'UID: ' + hexInvertido, uid: hexInvertido, usr_type: 'alumno' },
          REG_TYPE.ERROR,
          'error'
        );
      }
    } catch (error) {
      console.error(error.message);
      Alert.alert("Error", error.message || "No se puede conectar con el servidor.");
    } finally {
      setEscaneando(false);
      setUidWeb('');
    }
  };

  const leerNFC = async () => {
    if (Platform.OS === 'web') return;
    try {
      setEscaneando(true);
      await NfcManager.requestTechnology(NfcTech.Ndef).catch(() =>
        NfcManager.requestTechnology(NfcTech.NfcA)
      );
      const tag = await NfcManager.getTag();

      if (modoBinding) {
        await vincularNfc(tag.id);
        return;
      }

      const data = await apiClient.post(API_ENDPOINTS.VERIFICAR_NFC, { tarjetaId: tag.id });

      if (data.success) {
        procesarValidacion({
          nombre: data.nombre,
          curso: data.cursoCompleto || data.curso || 'Sin curso asignado',
          foto: data.foto || null,
          fechaNacimiento: data.fechaNacimiento,
          tieneTransporte: data.tieneTransporte,
          uid: tag.id,
          usr_type: data.usr_type || 'alumno'
        });
      } else {
        finalizarValidacion(
          { nombre: 'Desconocido', curso: 'UID: ' + tag.id, uid: tag.id, usr_type: 'alumno' },
          REG_TYPE.ERROR,
          'error'
        );
      }
    } catch (error) {
      Alert.alert("Error", error.message || "No se puede conectar con el servidor.");
    } finally {
      if (NfcManager) NfcManager.cancelTechnologyRequest().catch(() => 0);
      setEscaneando(false);
    }
  };

  //============================================
  //MODO MANUAL: helpers de UI
  //============================================
  const activarModoManual = (tipo) => {
    setModoManual(tipo);
    setModalManualVisible(false);
  };

  const cancelarModoManual = () => {
    setModoManual(null);
    setModalManualVisible(false);
  };

  //============================================
  //RENDER: pantalla de escaneo (sin alumno cargado)
  //============================================
  if (modoBinding) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.btnEngranaje}
          onPress={() => { setModoBinding(null); setBindingMensaje(null); navigation.goBack(); }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.cajaBlanca}>
          <View style={[styles.circuloIcono, styles.circuloIconoBinding]}>
            <Ionicons name="link" size={64} color="#1D4ED8" />
          </View>

          <View style={styles.bindingBadge}>
            <Ionicons name="information-circle" size={14} color="#1D4ED8" style={{ marginRight: 4 }} />
            <Text style={styles.bindingBadgeTexto}>Modo vinculacion</Text>
          </View>

          <Text style={styles.tituloVacio}>Vincular tarjeta a:</Text>
          <Text style={styles.bindingNombre}>{modoBinding.nombre}</Text>
          {modoBinding.curso && (
            <Text style={styles.subtituloVacio}>{modoBinding.curso}</Text>
          )}

          {bindingMensaje && (
            <View style={[
              styles.bindingMensaje,
              bindingMensaje.tipo === 'exito' ? styles.bindingMensajeExito : styles.bindingMensajeError,
            ]}>
              <Ionicons
                name={bindingMensaje.tipo === 'exito' ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={bindingMensaje.tipo === 'exito' ? '#15803D' : '#DC2626'}
                style={{ marginRight: 8 }}
              />
              <Text style={[
                styles.bindingMensajeTexto,
                { color: bindingMensaje.tipo === 'exito' ? '#15803D' : '#DC2626' },
              ]}>
                {bindingMensaje.texto}
              </Text>
            </View>
          )}

          {!bindingMensaje && (
            <Text style={[styles.subtituloVacio, { marginTop: 16 }]}>
              Acerca la tarjeta al lector...
            </Text>
          )}

          {!escaneando && Platform.OS !== 'web' && !bindingMensaje && (
            <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
              <Ionicons name="radio" size={30} color="white" style={{ marginRight: 10, transform: [{ rotate: '90deg' }] }} />
              <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
            </TouchableOpacity>
          )}

          {!escaneando && Platform.OS === 'web' && !bindingMensaje && (
            <TextInput
              style={[styles.botonGrande, { backgroundColor: '#F3F4F6', color: '#1F2937', textAlign: 'center' }]}
              placeholder="Pasa la tarjeta por el lector USB..."
              placeholderTextColor="#9CA3AF"
              value={uidWeb}
              onChangeText={setUidWeb}
              onSubmitEditing={procesarLectorWeb}
              autoFocus
            />
          )}

          {escaneando && (
            <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 16 }} />
          )}
        </View>
      </View>
    );
  }

  if (!alumno) {
    return (
      <View style={styles.container}>
        {/*Boton de engranaje arriba a la derecha para abrir el modo manual.
           Si hay un modo manual activo, el engranaje cambia de color para
           dar feedback visual al profesor.*/}
        <TouchableOpacity
          style={styles.btnEngranaje}
          onPress={() => setModalManualVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="settings-outline"
            size={22}
            color={modoManual ? '#1D4ED8' : '#9CA3AF'}
          />
          {modoManual && <View style={styles.indicadorActivo} />}
        </TouchableOpacity>

        <View style={styles.cajaBlanca}>
          <View style={[styles.circuloIcono, escaneando && styles.circuloIconoActivo]}>
            <Ionicons
              name={escaneando ? "hourglass-outline" : "radio-outline"}
              size={80}
              color={escaneando ? "#15803D" : "#2563EB"}
              style={!escaneando && { transform: [{ rotate: '90deg' }] }}
            />
          </View>
          <Text style={styles.tituloVacio}>{escaneando ? "Conectando..." : "Control de Acceso"}</Text>
          <Text style={styles.subtituloVacio}>{escaneando ? "Validando..." : "Pulsa y acerca la tarjeta."}</Text>

          {/*Si hay modo manual activo, mostramos un aviso al profesor*/}
          {modoManual && (
            <View style={styles.avisoModoManual}>
              <Ionicons name="information-circle" size={16} color="#1D4ED8" style={{ marginRight: 6 }} />
              <Text style={styles.avisoModoManualTexto}>
                Próxima pasada: forzar {modoManual === 'forzar_entrada' ? 'entrada' : 'salida'}
              </Text>
            </View>
          )}

          {!escaneando && Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.botonGrande} onPress={leerNFC}>
              <Ionicons name="radio" size={30} color="white" style={{ marginRight: 10, transform: [{ rotate: '90deg' }] }} />
              <Text style={styles.textoBotonGrande}>Escanear Tarjeta</Text>
            </TouchableOpacity>
          )}

          {!escaneando && Platform.OS === 'web' && (
            <TextInput
              style={[styles.botonGrande, { backgroundColor: '#F3F4F6', color: '#1F2937', textAlign: 'center' }]}
              placeholder="Pasa la tarjeta por el lector USB..."
              placeholderTextColor="#9CA3AF"
              value={uidWeb}
              onChangeText={setUidWeb}
              onSubmitEditing={procesarLectorWeb}
              autoFocus={true}
            />
          )}

          {escaneando && (
            <TouchableOpacity style={[styles.botonGrande, { backgroundColor: '#EF4444' }]} onPress={() => {
              if (Platform.OS !== 'web' && NfcManager) NfcManager.cancelTechnologyRequest().catch(() => 0);
              setEscaneando(false);
            }}>
              <Text style={styles.textoBotonGrande}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/*Modal del modo manual: pulsando el engranaje aparece y el profesor
           puede forzar la proxima pasada como entrada o salida.*/}
        <Modal
          animationType="fade"
          transparent
          visible={modalManualVisible}
          onRequestClose={() => setModalManualVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalManualVisible(false)}
          >
            <View style={styles.modalCaja} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitulo}>Modo manual</Text>
              <Text style={styles.modalSubtitulo}>
                Fuerza el tipo de la próxima pasada de tarjeta.
                Solo se aplica una vez.
              </Text>

              <TouchableOpacity
                style={[styles.opcionManual, modoManual === 'forzar_entrada' && styles.opcionManualActiva]}
                onPress={() => activarModoManual('forzar_entrada')}
              >
                <Ionicons name="log-in" size={20} color="#15803D" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcionManualTitulo}>Forzar como entrada</Text>
                  <Text style={styles.opcionManualDescripcion}>El próximo escaneo se registrará como entrada</Text>
                </View>
                {modoManual === 'forzar_entrada' && <Ionicons name="checkmark" size={20} color="#15803D" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.opcionManual, modoManual === 'forzar_salida' && styles.opcionManualActiva]}
                onPress={() => activarModoManual('forzar_salida')}
              >
                <Ionicons name="log-out" size={20} color="#1D4ED8" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcionManualTitulo}>Forzar como salida</Text>
                  <Text style={styles.opcionManualDescripcion}>El próximo escaneo se registrará como salida</Text>
                </View>
                {modoManual === 'forzar_salida' && <Ionicons name="checkmark" size={20} color="#15803D" />}
              </TouchableOpacity>

              {modoManual && (
                <TouchableOpacity
                  style={styles.opcionManualCancelar}
                  onPress={cancelarModoManual}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.opcionManualCancelarTexto}>Cancelar modo manual</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.modalCerrar}
                onPress={() => setModalManualVisible(false)}
              >
                <Text style={styles.modalCerrarTexto}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  //============================================
  //RENDER: pantalla de resultado
  //============================================
  let badgeStyle = styles.badgeExito;
  let textStyle = styles.textoExito;
  let iconName = "checkmark-circle";
  let iconColor = "#15803D";

  if (alumno.mensajeEstado === REG_TYPE.NO_AUTORIZADO || alumno.mensajeEstado === REG_TYPE.ERROR) {
    badgeStyle = styles.badgeError;
    textStyle = styles.textoError;
    iconName = "close-circle";
    iconColor = "#DC2626";
  } else if (
    alumno.mensajeEstado === REG_TYPE.SALIDA_ANTICIPADA_AUTORIZADA ||
    alumno.mensajeEstado === REG_TYPE.SALIDA_ANTICIPADA ||
    alumno.mensajeEstado === REG_TYPE.ENTRADA_TARDIA
  ) {
    badgeStyle = styles.badgePrecaucion;
    textStyle = styles.textoPrecaucion;
    iconName = "alert-circle";
    iconColor = "#A16207";
  }

  return (
    <View style={styles.container}>
      <View style={styles.tarjeta}>
        <View style={[
          styles.avatar,
          { borderColor: alumno.estado === 'error' ? "#DC2626" : alumno.estado === 'precaucion' ? "#FACC15" : "#4ADE80" }
        ]}>
          {alumno.foto ? (
            <Image source={{ uri: `data:image/png;base64,${alumno.foto}` }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={60} color={alumno.autorizado ? "#9CA3AF" : "#DC2626"} />
          )}
        </View>
        <Text style={styles.nombreAlumno}>{alumno.nombre}</Text>
        <Text style={styles.cursoAlumno}>{alumno.curso}</Text>
        <View style={badgeStyle}>
          <Ionicons name={iconName} size={24} color={iconColor} style={{ marginRight: 8 }} />
          <Text style={textStyle}>{alumno.displayText || alumno.mensajeEstado}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.botonSiguiente} onPress={() => setAlumno(null)}>
        <Ionicons name="arrow-forward" size={24} color="white" style={{ marginRight: 10 }} />
        <Text style={styles.textoBotonSiguiente}>Leer Siguiente</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 20,
    justifyContent: 'center',
  },
  //Boton de engranaje arriba a la derecha
  btnEngranaje: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    zIndex: 10,
  },
  indicadorActivo: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: 'white',
  },
  cajaBlanca: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
  },
  circuloIcono: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  circuloIconoActivo: {
    backgroundColor: '#DCFCE7',
  },
  circuloIconoBinding: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  bindingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  bindingBadgeTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  bindingNombre: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1D4ED8',
    marginBottom: 4,
    textAlign: 'center',
  },
  bindingMensaje: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
    marginBottom: 4,
    borderWidth: 1,
    maxWidth: 320,
  },
  bindingMensajeExito: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  bindingMensajeError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  bindingMensajeTexto: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  tituloVacio: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
  },
  subtituloVacio: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  avisoModoManual: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  avisoModoManualTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  botonGrande: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 250,
  },
  textoBotonGrande: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  //Modal del modo manual
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCaja: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitulo: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  opcionManual: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  opcionManualActiva: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  opcionManualTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  opcionManualDescripcion: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  opcionManualCancelar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  opcionManualCancelarTexto: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  modalCerrar: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCerrarTexto: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },

  //Tarjeta de resultado
  tarjeta: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  nombreAlumno: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  cursoAlumno: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  badgeExito: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  textoExito: {
    color: '#15803D',
    fontWeight: 'bold',
    fontSize: 14,
  },
  badgePrecaucion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  textoPrecaucion: {
    color: '#A16207',
    fontWeight: 'bold',
    fontSize: 14,
  },
  badgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  textoError: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 14,
  },
  botonSiguiente: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSiguiente: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});