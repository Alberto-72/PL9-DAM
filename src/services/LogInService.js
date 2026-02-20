const NODE_SERVER_URL = 'http://10.102.7.185:3001';

export const loginToOdoo = async (username, password) => {
  try {
    const response = await fetch(`${NODE_SERVER_URL}/api/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

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