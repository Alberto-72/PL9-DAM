const NODE_SERVER_URL = 'http://10.102.7.2:3001';

// Handles the login process

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

//  Fetches data from either the 'gestion_entrada.alumno' or 'gestion_entrada.profesor' model 
export const fetchOdooData = async (model) => {
  try {
    const endpoint = model === 'gestion_entrada.alumno' ? '/api/alumnos' : '/api/profesores';

    const response = await fetch(`${NODE_SERVER_URL}${endpoint}`);

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
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