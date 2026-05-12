//api client: modulo centralizado para hacer peticiones a la API REST del backend.
//Aqui se maneja el timeout, los errores de red, el parseo de JSON, etc.
//El resto del frontend solo llama a apiClient.get/post/put/delete con la URL y los datos.

import { API_TIMEOUT } from '../config/api';

/**
 * Realiza una peticion HTTP con timeout y manejo de errores.
 *
 * @param {string} url - URL completa del endpoint.
 * @param {object} options - Opciones de fetch (method, body, headers...)
 * @param {number} timeout - Timeout en ms (por defecto API_TIMEOUT)
 * @returns {Promise<object>} - Cuerpo de la respuesta parseado como JSON
 * @throws {Error} - Si la peticion falla, se agota el tiempo o el servidor responde con error
 */
async function request(url, options = {}, timeout = API_TIMEOUT) {
  //AbortController permite cancelar la peticion si tarda demasiado
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const method = options.method || 'GET';
  console.log(`[API] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    //Intenta parsear la respuesta como JSON, aunque el backend deberia responder siempre con JSON
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`Respuesta no valida del servidor (status ${response.status})`);
    }

    if (!response.ok) {
      //El backend responde, pero con error HTTP (4xx, 5xx)
      const message = data?.message || `Error HTTP ${response.status}`;
      console.warn(`[API] ${method} ${url} -> ${response.status}: ${message}`);
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    //El AbortController aborta la peticion por timeout
    if (error.name === 'AbortError') {
      console.error(`[API] ${method} ${url} -> TIMEOUT (${timeout}ms)`);
      const timeoutError = new Error('El servidor no responde. Comprueba la conexion.');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    //Error de red (servidor caido, sin WiFi, IP incorrecta...)
    if (error.message === 'Network request failed' || error.message === 'Failed to fetch') {
      console.error(`[API] ${method} ${url} -> NETWORK ERROR`);
      const networkError = new Error('No se puede conectar con el servidor.');
      networkError.isNetworkError = true;
      throw networkError;
    }

    //Cualquier otro error ya formateado
    console.error(`[API] ${method} ${url} -> ${error.message}`);
    throw error;
  }
}

//Helper: detecta si el cuerpo es FormData (subida de archivos multipart).
//Si lo es, NO ponemos Content-Type (el navegador/RN lo genera con el boundary correcto)
//y NO serializamos a JSON (FormData se pasa tal cual a fetch).
function buildBodyOptions(body) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (isFormData) {
    return {
      body: body,
      headers: { 'Accept': 'application/json' },
    };
  }

  return {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
}

export const apiClient = {

  /**
   * GET request.
   */
  get(url, options = {}) {
    return request(url, {
      ...options,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });
  },

  /**
   * POST request. Acepta objeto JSON o FormData (para subida de archivos).
   */
  post(url, body, options = {}) {
    const bodyOpts = buildBodyOptions(body);
    return request(url, {
      ...options,
      method: 'POST',
      ...bodyOpts,
      headers: { ...bodyOpts.headers, ...(options.headers || {}) },
    });
  },

  /**
   * PUT request con cuerpo JSON.
   */
  put(url, body, options = {}) {
    const bodyOpts = buildBodyOptions(body);
    return request(url, {
      ...options,
      method: 'PUT',
      ...bodyOpts,
      headers: { ...bodyOpts.headers, ...(options.headers || {}) },
    });
  },

  /**
   * DELETE request.
   */
  delete(url, options = {}) {
    return request(url, {
      ...options,
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });
  },
};