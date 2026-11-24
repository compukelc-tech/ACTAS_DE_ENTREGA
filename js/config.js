/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - CONFIGURACIÓN Y API
 * Institución Educativa San Francisco de Sales | Desarrollado por compukelc
 * Versión: 1.0.0
 * ============================================================================
 */

/* === SECCIÓN 1: CONSTANTES GLOBALES E INSTITUCIONALES === */
const APP_CONFIG = {
  VERSION: '1.0.0',
  STORAGE_KEY_API_URL: 'ga_r26_backend_exec_url',

  // Opcional: puedes pegar aquí directamente tu URL /exec para que venga precargada
  // en cualquier celular sin tener que escribirla desde el botón "API":
  DEFAULT_API_URL: '',

  INSTITUCION: {
    NOMBRE: 'INSTITUCIÓN EDUCATIVA SAN FRANCISCO DE SALES',
    LEMA: '"amablemente exigentes"',
    CODIGO_DANE: '154001001628',
    NIT: '890-505-161-5',
    DIRECCION: 'Av. 4E #6-23 Barrio Popular',
    CORREO: 'colfranciscodesales@semcucuta.gov.co',
    CODIGO_FORMATO: 'GA-R26',
    VERSION_FORMATO: '1.0'
  },

  DEPENDENCIAS: {
    SALON: {
      codigo: 'SALON',
      titulo: 'ENTREGA DE SALÓN',
      paginasBase: 2
    },
    AUDITORIO: {
      codigo: 'AUDITORIO',
      titulo: 'ENTREGA DE AUDITORIO',
      paginasBase: 2
    },
    PRIMERA_INFANCIA: {
      codigo: 'PRIMERA_INFANCIA',
      titulo: 'INVENTARIO SALÓN PRIMERA INFANCIA',
      paginasBase: 1
    },
    AULA_HIBRIDA: {
      codigo: 'AULA_HIBRIDA',
      titulo: 'INVENTARIO AULA HÍBRIDA',
      paginasBase: 2
    }
  }
};

/* === SECCIÓN 2: GESTOR DE URL /EXEC Y COMUNICACIÓN CON APPS SCRIPT === */
window.ConfigManager = (() => {
  /**
   * Obtiene la URL /exec activa desde localStorage o desde DEFAULT_API_URL
   */
  function getApiUrl() {
    const guardada = (localStorage.getItem(APP_CONFIG.STORAGE_KEY_API_URL) || '').trim();
    if (guardada) return guardada;
    return (APP_CONFIG.DEFAULT_API_URL || '').trim();
  }

  /**
   * Valida y almacena la URL /exec en el navegador
   */
  function setApiUrl(nuevaUrl) {
    const limpia = String(nuevaUrl || '').trim();
    if (!limpia) {
      throw new Error('Debes ingresar una URL válida terminada en /exec.');
    }
    if (!limpia.startsWith('https://script.google.com/')) {
      throw new Error('La URL debe comenzar con https://script.google.com/');
    }
    localStorage.setItem(APP_CONFIG.STORAGE_KEY_API_URL, limpia);
    return limpia;
  }

  /**
   * Ejecuta una petición GET contra el backend de Google Apps Script
   */
  async function apiGet(action, params = {}, customBaseUrl = '') {
    const baseUrl = (customBaseUrl || getApiUrl()).trim();
    if (!baseUrl) {
      throw new Error('Configura primero la URL /exec del backend en el botón "API".');
    }

    const url = new URL(baseUrl);
    url.searchParams.set('action', action);

    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.set(key, String(params[key]));
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar el servidor.`);
    }

    const data = await response.json();
    if (!data || data.ok === false) {
      throw new Error((data && data.error) ? data.error : 'Respuesta inválida del servidor.');
    }

    return data;
  }

  /**
   * Ejecuta una petición POST enviando text/plain para evitar bloqueos CORS preflight
   * en Google Apps Script desde GitHub Pages
   */
  async function apiPost(payload) {
    const baseUrl = getApiUrl();
    if (!baseUrl) {
      throw new Error('Configura primero la URL /exec del backend en el botón "API".');
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al guardar en el servidor.`);
    }

    const data = await response.json();
    if (!data || data.ok === false) {
      throw new Error((data && data.error) ? data.error : 'No se pudo completar la operación.');
    }

    return data;
  }

  /**
   * Verifica conectividad activa con ?action=ping
   */
  async function pingBackend(customUrl = '') {
    return await apiGet('ping', {}, customUrl);
  }

  return {
    APP_CONFIG,
    getApiUrl,
    setApiUrl,
    apiGet,
    apiPost,
    pingBackend
  };
})();
