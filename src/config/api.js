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
  LOGIN:           `${API_BASE_URL}/api/login`,
  VERIFICAR_NFC:   `${API_BASE_URL}/api/verificar-tarjeta`,
  ALUMNOS:         `${API_BASE_URL}/api/alumnos`,
  PROFESORES:      `${API_BASE_URL}/api/profesores`,
  REGISTER:        `${API_BASE_URL}/api/register`,
  DASHBOARD:       `${API_BASE_URL}/api/dashboard`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/change-password`,
  USER_PROFILE:    (username) => `${API_BASE_URL}/api/user/${encodeURIComponent(username)}`,
};