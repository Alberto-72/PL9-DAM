const NODE_SERVER_URL = 'http://10.102.7.200:3001';

/**
 * Gestiona el inicio de sesión
 */
export const loginToOdoo = async (username, password) => {
  try {
    const response = await fetch(`${NODE_SERVER_URL}/api/login`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    return data.success ? data.usuario : null; 
  } catch (error) {
    console.error("Error conectando con el servidor Node:", error.message);
    return null;
  }
};

/**
 * Obtiene datos de alumnos o profesores según el modelo solicitado
 */
export const fetchOdooData = async (model) => {
  try {
    // Determina el endpoint basándose en el modelo de Odoo
    const endpoint = model === 'gestion_entrada.alumno' ? '/api/alumnos' : '/api/profesores';

    const response = await fetch(`${NODE_SERVER_URL}${endpoint}`);

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Retorna la lista correcta comparando el modelo
      if (model === 'gestion_entrada.alumno') {
        return data.alumnos || [];
      } else {
        return data.profesores || [];
      }
    }
    
    return [];
  } catch (error) {
    console.error("Error en fetchOdooData:", error.message);
    return [];
  }
};