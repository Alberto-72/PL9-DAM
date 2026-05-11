//Servicio de login y carga de datos de Odoo desde el backend Node.
//Todas las llamadas pasan por apiClient para tener timeout y manejo de errores unificado.

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

// --- NUEVA FUNCIÓN PARA OBTENER ALUMNOS Y PROFESORES ---
export const fetchOdooData = async (modelo, campos) => {
    // Usamos tu IP actual (.248)
    const baseUrl = 'http://10.102.6.248:3001/api'; 
    
    // Asignamos la ruta correcta dependiendo del modelo de Odoo
    const endpoint = modelo === 'gestion_entrada.alumno' ? '/alumnos' : '/profesores';

    try {
        const response = await fetch(`${baseUrl}${endpoint}`);
        const data = await response.json();
        
        if (data.success) {
            return modelo === 'gestion_entrada.alumno' ? data.alumnos : data.profesores;
        } else {
            console.error('Error interno del servidor Node al cargar listado:', data);
            return [];
        }
    } catch (error) {
        console.error('Error de red en fetchOdooData:', error.message);
        return [];
    }
};