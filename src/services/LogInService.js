//Servicio de login y carga de datos de Odoo desde el backend Node.
//Todas las llamadas pasan por apiClient para tener timeout y manejo de errores unificado.
//Las URLs estan centralizadas en config/api.js para no tener IPs hardcodeadas.

import { API_ENDPOINTS } from '../config/api';
import { apiClient } from './apiClient';

//Login contra el backend. Devuelve el objeto usuario si tiene exito, o null si falla.
export const loginToOdoo = async (username, password) => {
  try {
    const data = await apiClient.post(API_ENDPOINTS.LOGIN, { username, password });

    if (data.success) {
      return data.usuario;
    } else {
      console.warn("Fallo de login:", data.message);
      return null;
    }
  } catch (error) {
    console.error("Error conectando con el servidor Node:", error.message);
    return null;
  }
};

//Carga el listado de alumnos o profesores segun el modelo de Odoo solicitado.
//
//Uso:
//  const alumnos = await fetchOdooData('gestion_entrada.alumno');
//  const profes  = await fetchOdooData('gestion_entrada.profesor');
//
//Devuelve un array (vacio si hay error o no hay datos). Los campos vienen crudos de Odoo.
export const fetchOdooData = async (model) => {
  try {
    //Elegimos endpoint segun el modelo, ambos centralizados en config/api.js
    const endpoint = model === 'gestion_entrada.alumno'
      ? API_ENDPOINTS.ALUMNOS
      : API_ENDPOINTS.PROFESORES;

    const data = await apiClient.get(endpoint);

    if (!data.success) {
      console.warn(`fetchOdooData(${model}) -> success=false`);
      return [];
    }

    //La respuesta varia segun el modelo: { alumnos: [...] } o { profesores: [...] }
    if (model === 'gestion_entrada.alumno') {
      return data.alumnos || [];
    }
    return data.profesores || [];
  } catch (error) {
    console.error(`Error en fetchOdooData(${model}):`, error.message);
    return [];
  }
};