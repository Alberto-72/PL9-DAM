import { API_ENDPOINTS } from '../config/api';
import { apiClient } from './apiClient';

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