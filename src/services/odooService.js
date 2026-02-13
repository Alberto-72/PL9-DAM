const ODOO_URL = '/jsonrpc';
const DB = "ControlAcceso";
const ADMIN_UID = 2; 
const ADMIN_PASS = "AlberPabKil123";

export const loginToOdoo = async (username, password) => {
  const body = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        DB, 
        ADMIN_UID, 
        ADMIN_PASS, 
        "gestion_entrada.profesor", 
        "search_read", 
        [[["username", "=", username], ["password", "=", password]]], 
        { fields: ["name", "surname", "email", "username", "is_management"] }
      ],
    },
    id: 1,
  };

  try {
    const response = await fetch(ODOO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    
    // Si hay coincidencia, devolvemos el primer registro (Arturo)
    if (result.result && result.result.length > 0) {
      return result.result[0]; 
    }
    return null;
  } catch (error) {
    console.error("Error en el servicio de login:", error);
    return null;
  }
};

/**
 * Recupera datos de cualquier modelo usando la sesión administrativa.
 */
export const fetchOdooData = async (model, fields = []) => {
  const body = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [DB, ADMIN_UID, ADMIN_PASS, model, "search_read", [[]], { fields }],
    },
    id: 2,
  };

  try {
    const response = await fetch(ODOO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    return result.result || [];
  } catch (error) {
    console.error("Error al recuperar datos de Odoo:", error);
    return [];
  }
};