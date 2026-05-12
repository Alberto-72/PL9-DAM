//api client: módulo centralizado para hacer peticiones a la API REST del backend.
//Aquí se maneja el timeout, los errores de red, el parseo de JSON, etc.
//El resto del frontend solo llama a apiClient.get/post/put/delete con la URL y los datos,
//y este módulo se encarga de todo lo demás (incluyendo logging para depuración).

import { API_TIMEOUT } from '../config/api';

/**
 * Realiza una petición HTTP con timeout y manejo de errores.
 *
 * @param {string} url - URL completa del endpoint.
 * @param {object} options - Opciones de fetch (method, body, headers...)
 * @param {number} timeout - Timeout en ms (por defecto API_TIMEOUT)
 * @returns {Promise<object>} - Cuerpo de la respuesta parseado como JSON
 * @throws {Error} - Si la petición falla, se agota el tiempo o el servidor responde con error
 */
async function request(url, options = {}, timeout = API_TIMEOUT) {
  // AbortController permite cancelar la petición si tarda demasiado
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const method = options.method || 'GET';
  console.log(`[API] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    //intenta parsear la respuesta como JSON, aunque el backend debería responder siempre con JSON
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`Respuesta no válida del servidor (status ${response.status})`);
    }

    if (!response.ok) {
      //el backend responde, pero con error HTTP (4xx, 5xx)
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

    //el AbortController aborta la petición por timeout
    if (error.name === 'AbortError') {
      console.error(`[API] ${method} ${url} -> TIMEOUT (${timeout}ms)`);
      const timeoutError = new Error('El servidor no responde. Comprueba la conexión.');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    // Error de red (servidor caído, sin WiFi, IP incorrecta...)
    if (error.message === 'Network request failed' || error.message === 'Failed to fetch') {
      console.error(`[API] ${method} ${url} -> NETWORK ERROR`);
      const networkError = new Error('No se puede conectar con el servidor.');
      networkError.isNetworkError = true;
      throw networkError;
    }

    //cualquier otro error ya formateado
    console.error(`[API] ${method} ${url} -> ${error.message}`);
    throw error;
  }
}

export const apiClient = {
  /**
   * GET request.
   * @param {string} url
   * @param {object} options Opciones adicionales (headers, timeout custom...).
   */
  get(url, options = {}) {
    return request(url, { ...options, method: 'GET' });
  },

  /**
   * POST request con cuerpo JSON.
   * @param {string} url
   * @param {object} body Datos a enviar (se serializan a JSON).
   * @param {object} options
   */
  post(url, body, options = {}) {
    return request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * PUT request con cuerpo JSON.
   */
  put(url, body, options = {}) {
    return request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  /**
   * DELETE request.
   */
  delete(url, options = {}) {
    return request(url, { ...options, method: 'DELETE' });
  },
};