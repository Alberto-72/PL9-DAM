//Servicio de login y carga de datos de Odoo desde el backend Node.
import { API_ENDPOINTS } from '../config/api';
import { apiClient } from './apiClient';

// función asíncrona encargada de manejar el proceso de inicio de sesión.
export const loginToOdoo = async (username, password) => {
  try {
    // Realiza una petición POST al endpoint de login enviando las credenciales en el cuerpo (JSON).
    const data = await apiClient.post(API_ENDPOINTS.LOGIN, { username, password });

    if (data && data.success) {
      // si login correcto
      return { ok: true, usuario: data.usuario };
    }
    // si login falla
    return { ok: false, motivo: 'credenciales', mensaje: data?.message || 'Usuario o contraseña no válidos' };
  } catch (error) {
    if (error.isNetworkError || error.isTimeout) { // si error de red
      return { ok: false, motivo: 'red', mensaje: error.message };
    }
    return { ok: false, motivo: 'error', mensaje: error.message || 'Error desconocido' };
  }
};
// función asíncrona encargada de descargar el listado de alumnos o profesores.
export const fetchOdooData = async (model) => {
  try {
    const endpoint = model === 'gestion_entrada.alumno'
      ? API_ENDPOINTS.ALUMNOS
      : API_ENDPOINTS.PROFESORES;

      // hace la peticion al endpoint
    const data = await apiClient.get(endpoint);
    // Manejo de errores
    if (!data.success) {
      console.warn(`fetchOdooData(${model}) -> success=false`);
      return [];
    }

    if (model === 'gestion_entrada.alumno') {
      return data.alumnos || [];
    }
    return data.profesores || [];
  } catch (error) {
    console.error(`Error en fetchOdooData(${model}):`, error.message);
    return [];
  }
};