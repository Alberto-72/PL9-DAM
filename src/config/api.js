// unico punto de configuración de red del frontend.
//si cambias de red o de servidor, cambia SOLO este archivo.

//ESTO HAY QUE CAMBIARLO SI CAMBIAMOS DE RED O DE SERVIDOR. SOLO ESTE ARCHIVO, NUNCA LOS DEMÁS.
const SERVER_HOST = '10.102.6.248';
const SERVER_PORT = 3001;

export const API_BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

//por si no responde el servidor, no se quede colgado el frontend esperando una respuesta que nunca llega.
export const API_TIMEOUT = 10000; // 10 segundos

//definimos aquí todas las rutas de la API, para que si cambian, solo tengamos que cambiar este archivo.
export const API_ENDPOINTS = {
  LOGIN:           `${API_BASE_URL}/api/login`,
  VERIFICAR_NFC:   `${API_BASE_URL}/api/verificar-tarjeta`,
  ALUMNOS:         `${API_BASE_URL}/api/alumnos`,
  REGISTER:        `${API_BASE_URL}/api/register`,
  DASHBOARD:       `${API_BASE_URL}/api/dashboard`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/change-password`,
  USER_PROFILE:    (username) => `${API_BASE_URL}/api/user/${encodeURIComponent(username)}`,
};