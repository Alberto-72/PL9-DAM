//Configuracion central de la API
//Unico punto de configuracion de red del frontend.
//Si cambias de red o de servidor, cambia SOLO este archivo.

//Configuracion del servidor Node
const SERVER_HOST = '10.102.6.248';
const SERVER_PORT = 3001;

export const API_BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

//Timeout por defecto para las peticiones (en ms).
//Si el servidor no responde en este tiempo, se aborta la peticion.
export const API_TIMEOUT = 10000;

//Endpoints de la API. Si renombras una ruta en el backend, se cambia aqui en un solo sitio.
export const API_ENDPOINTS = {

  //Autenticacion y perfil
  LOGIN:           `${API_BASE_URL}/api/login`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/change-password`,
  USER_PROFILE:    (username) => `${API_BASE_URL}/api/user/${encodeURIComponent(username)}`,

  //Scanner NFC
  VERIFICAR_NFC:   `${API_BASE_URL}/api/verificar-tarjeta`,
  REGISTER:        `${API_BASE_URL}/api/register`,

  //Listados
  ALUMNOS:         `${API_BASE_URL}/api/alumnos`,
  PROFESORES:      `${API_BASE_URL}/api/profesores`,

  //CRUD alumnos
  ALUMNO_BY_ID:    (id) => `${API_BASE_URL}/api/alumnos/${id}`,

  //CRUD profesores
  PROFESOR_BY_ID:  (id) => `${API_BASE_URL}/api/profesores/${id}`,

  //Historico de registros por uid NFC
  REGISTROS_USER:  (uid) => `${API_BASE_URL}/api/registros/${encodeURIComponent(uid)}`,

  //Importacion CSV (tipo = 'alumnos' o 'profesores')
  IMPORTAR_CSV:    (tipo) => `${API_BASE_URL}/api/importar-csv/${tipo}`,

  //Exportacion CSV de accesos
  EXPORTAR_ACCESOS: `${API_BASE_URL}/api/exportar-accesos`,

  //Dashboard
  DASHBOARD:       `${API_BASE_URL}/api/dashboard`,
};