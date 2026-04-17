<<<<<<< Updated upstream
// const NODE_SERVER_URL = 'http://10.102.7.192:3001';
const NODE_SERVER_URL = 'http://10.102.8.22:3001';

=======
const NODE_SERVER_URL = 'http://10.102.6.253:3001';
>>>>>>> Stashed changes

export const loginToOdoo = async (username, password) => {
  try {
    console.log("PRUEBA")
    const response = await fetch(`${NODE_SERVER_URL}/api/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ username, password }),
    });
    console.log("PRUEBA")
    const data = await response.json();
    console.log("PRUEBA")
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