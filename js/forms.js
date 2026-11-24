/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - GESTOR DE FORMATOS
 * Institución Educativa San Francisco de Sales | Desarrollado por compukelc
 * Versión: 1.0.0
 * ============================================================================
 */

window.FormsManager = (() => {
  /* === SECCIÓN 1: ESTADO INTERNO DE EDICIÓN === */
  const estadoEdicion = {
    idActa: '',
    fechaRegistro: '',
    urlFirmaExistente: '',
    urlPdfExistente: ''
  };

  /* === SECCIÓN 2: CAMBIO DE DEPENDENCIA Y PAGINACIÓN DINÁMICA === */
  function cambiarDependencia(tipoDependencia) {
    const tipo = (tipoDependencia || 'SALON').toUpperCase();
    const formObjetivo = document.getElementById(`form-${tipo}`);
    if (!formObjetivo) return;

    // Actualizar botones visuales del selector
    document.querySelectorAll('.dep-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.dep === tipo);
    });

    // Ocultar todos los formularios y mostrar únicamente el seleccionado
    document.querySelectorAll('.formato-oficial').forEach((form) => {
      const esActivo = form.id === `form-${tipo}`;
      form.classList.toggle('hidden', !esActivo);
      form.classList.toggle('activo', esActivo);
    });

    const inputTipo = document.getElementById('input-tipo-dependencia');
    if (inputTipo) inputTipo.value = tipo;

    // Recalcular numeración de páginas con los QR actualmente cargados
    const totalQR = window.ScannerManager ? window.ScannerManager.obtenerListaBienes().length : 0;
    actualizarPaginacion(totalQR);
  }

  function obtenerTipoActivo() {
    const inputTipo = document.getElementById('input-tipo-dependencia');
    return (inputTipo && inputTipo.value) ? inputTipo.value.toUpperCase() : 'SALON';
  }

  function obtenerFormularioActivo() {
    const tipo = obtenerTipoActivo();
    return document.getElementById(`form-${tipo}`);
  }

  /**
   * Calcula y actualiza el indicador "PÁG. 1 DE X" según el formato y los QR anexos
   */
  function actualizarPaginacion(cantidadBienesQR = 0) {
    const tipo = obtenerTipoActivo();
    const metaDep = window.ConfigManager.APP_CONFIG.DEPENDENCIAS[tipo] || { paginasBase: 2 };
    const paginasAnexo = cantidadBienesQR > 0 ? Math.ceil(cantidadBienesQR / 3) : 0;
    const totalPaginas = metaDep.paginasBase + paginasAnexo;

    const formActivo = obtenerFormularioActivo();
    if (!formActivo) return;

    const spanPag = formActivo.querySelector('.pag-dinamica');
    if (spanPag) {
      spanPag.textContent = `1 DE ${totalPaginas}`;
    }
  }

  /* === SECCIÓN 3: LECTURA DE CAMPOS Y CONSOLIDACIÓN PARA EXCEL === */
  function leerCamposCrudos(formEl) {
    const campos = {};

    // 1. Inputs de texto, número y textareas con data-field
    formEl.querySelectorAll('[data-field]').forEach((el) => {
      const key = el.dataset.field;
      if (el.type === 'number') {
        campos[key] = el.value === '' ? '' : Number(el.value);
      } else {
        campos[key] = el.value.trim();
      }
    });

    // 2. Grupos de botones de radio con data-radio-group
    const gruposVistos = new Set();
    formEl.querySelectorAll('input[type="radio"][data-radio-group]').forEach((radio) => {
      const groupName = radio.dataset.radioGroup;
      if (gruposVistos.has(groupName)) return;
      gruposVistos.add(groupName);

      const seleccionado = formEl.querySelector(
        `input[type="radio"][data-radio-group="${groupName}"]:checked`
      );
      campos[groupName] = seleccionado ? seleccionado.value : '';
    });

    return campos;
  }

  function sumarInputsPorClase(formEl, selectorClase) {
    let total = 0;
    formEl.querySelectorAll(selectorClase).forEach((inp) => {
      const val = parseInt(inp.value, 10);
      if (!isNaN(val) && val > 0) total += val;
    });
    return total;
  }

  function resumirEstadosMultiples(listaEstados) {
    const validos = listaEstados.filter(Boolean);
    if (validos.length === 0) return 'N/A';
    if (validos.includes('MALO')) return 'MALO';
    if (validos.includes('REGULAR')) return 'REGULAR';
    return 'BUENO';
  }

  /**
   * Valida y construye el paquete de datos listo para enviar a handleGuardarActa()
   */
  function recopilarDatosFormulario() {
    const tipo = obtenerTipoActivo();
    const formEl = obtenerFormularioActivo();
    if (!formEl) {
      return { valido: false, error: 'No se encontró el formulario activo.' };
    }

    const campos = leerCamposCrudos(formEl);
    const ccDocente = (document.getElementById('input-cc-docente')?.value || '').trim();
    campos.CC_DOCENTE = ccDocente;

    // Validaciones mínimas obligatorias
    if (!campos.SALON_DEPENDENCIA) {
      return {
        valido: false,
        error: 'Por favor ingresa el nombre o número del salón / dependencia.'
      };
    }
    if (!campos.NOMBRE_TITULAR_DOCENTE) {
      return {
        valido: false,
        error: 'Por favor ingresa el nombre del titular o docente responsable.'
      };
    }

    // Consolidación específica por dependencia para las 39 columnas de ACTAS_DEPENDENCIAS
    let aireCant = Number(campos.AIRE_ACOND_CANT || 0);
    let aireEstado = campos.AIRE_ACOND_ESTADO || 'N/A';
    let tableroCant = Number(campos.TABLERO_CANT || (campos.TABLERO_ESTADO ? 1 : 0));
    let videoBeamInfo = 'N/A';
    let mesaPlasticaInfo = 'N/A';
    let sillaPlasticaInfo = 'N/A';
    let elementosPedagogicos = campos.ELEMENTOS_PEDAGOGICOS || '';

    if (tipo === 'SALON') {
      const detPed = campos.SALON_PEDAGOGICOS_DETALLE || '';
      const estPed = campos.SALON_PEDAGOGICOS_ESTADO || '';
      if (detPed || estPed) {
        elementosPedagogicos = [detPed, estPed].filter(Boolean).join(' - ');
      }
    } else if (tipo === 'AUDITORIO') {
      const estadosAires = [campos.AUD_AIRE_1, campos.AUD_AIRE_2, campos.AUD_AIRE_3];
      const airesEvaluados = estadosAires.filter(Boolean).length;
      aireCant = airesEvaluados > 0 ? airesEvaluados : 3;
      aireEstado = resumirEstadosMultiples(estadosAires);
      tableroCant = 1;
      videoBeamInfo = campos.AUD_VIDEO_BEAM ? `1 Video Beam - ${campos.AUD_VIDEO_BEAM}` : 'N/A';
    } else if (tipo === 'PRIMERA_INFANCIA') {
      videoBeamInfo = campos.PI_VIDEO_BEAM ? `1 Video Beam - ${campos.PI_VIDEO_BEAM}` : 'N/A';
      if (campos.PI_MESA_PLASTICA_CANT !== '' || campos.PI_MESA_PLASTICA_EST) {
        mesaPlasticaInfo = `Cant: ${campos.PI_MESA_PLASTICA_CANT || 0} (${campos.PI_MESA_PLASTICA_EST || 'N/R'})`;
      }
      if (campos.PI_SILLA_PLASTICA_CANT !== '' || campos.PI_SILLA_PLASTICA_EST) {
        sillaPlasticaInfo = `Cant: ${campos.PI_SILLA_PLASTICA_CANT || 0} (${campos.PI_SILLA_PLASTICA_EST || 'N/R'})`;
      }
    } else if (tipo === 'AULA_HIBRIDA') {
      const estadosAiresHib = [campos.HIB_AIRE_1, campos.HIB_AIRE_2];
      const airesHibEval = estadosAiresHib.filter(Boolean).length;
      aireCant = airesHibEval > 0 ? airesHibEval : 2;
      aireEstado = resumirEstadosMultiples(estadosAiresHib);
      videoBeamInfo = campos.HIB_VIDEO_BEAM_POLY
        ? `Video Beam Poly - ${campos.HIB_VIDEO_BEAM_POLY}`
        : 'N/A';
    }

    // Totales de pupitres y sillas (aplica en SALON y AULA_HIBRIDA; 0 en los demás)
    const pupitresBuenos = sumarInputsPorClase(formEl, '.pup-bueno');
    const pupitresReparar = sumarInputsPorClase(formEl, '.pup-rep');
    const pupitresDanados = sumarInputsPorClase(formEl, '.pup-dan');

    const sillasBuenas = sumarInputsPorClase(formEl, '.sil-buena');
    const sillasReparar = sumarInputsPorClase(formEl, '.sil-rep');
    const sillasDanadas = sumarInputsPorClase(formEl, '.sil-dan');

    const actaConsolidada = {
      ID_ACTA: estadoEdicion.idActa || '',
      FECHA_REGISTRO: estadoEdicion.fechaRegistro || '',
      FECHA_FORMATO: campos.FECHA_FORMATO || '17/01/17',
      TIPO_DEPENDENCIA: tipo,
      SALON_DEPENDENCIA: campos.SALON_DEPENDENCIA,
      NOMBRE_TITULAR_DOCENTE: campos.NOMBRE_TITULAR_DOCENTE,
      CC_DOCENTE: ccDocente,
      GRADO: campos.GRADO || '',
      NRO_ESTUDIANTES: campos.NRO_ESTUDIANTES === '' ? '' : Number(campos.NRO_ESTUDIANTES),
      INVENTARIO_ANIO: campos.INVENTARIO_ANIO || new Date().getFullYear(),
      AIRE_ACOND_CANT: aireCant,
      AIRE_ACOND_ESTADO: aireEstado,
      CONTROL_AIRE_ESTADO: campos.CONTROL_AIRE_ESTADO || 'N/A',
      TABLERO_CANT: tableroCant,
      TABLERO_ESTADO: campos.TABLERO_ESTADO || 'N/A',
      ESCRITORIO_DOC_ESTADO: campos.ESCRITORIO_DOC_ESTADO || 'N/A',
      SILLA_DOC_ESTADO: campos.SILLA_DOC_ESTADO || 'N/A',
      VIDEO_BEAM_INFO: videoBeamInfo,
      CAMARA_POLY_ESTADO: campos.CAMARA_POLY_ESTADO || 'N/A',
      ROUTER_ESTADO: campos.ROUTER_ESTADO || 'N/A',
      TV_SAMSUNG_ESTADO: campos.TV_SAMSUNG_ESTADO || 'N/A',
      MESA_PLASTICA_INFO: mesaPlasticaInfo,
      SILLA_PLASTICA_INFO: sillaPlasticaInfo,
      PUPITRES_BUENOS: pupitresBuenos,
      PUPITRES_REPARAR: pupitresReparar,
      PUPITRES_DANADOS: pupitresDanados,
      SILLAS_BUENAS: sillasBuenas,
      SILLAS_REPARAR: sillasReparar,
      SILLAS_DANADAS: sillasDanadas,
      ESTADO_PISO: campos.ESTADO_PISO || 'N/A',
      ESTADO_TECHO: campos.ESTADO_TECHO || 'N/A',
      ELEMENTOS_PEDAGOGICOS: elementosPedagogicos,
      NECESIDADES_AULA: campos.NECESIDADES_AULA || '',
      OBSERVACIONES: campos.OBSERVACIONES || '',
      URL_FIRMA_DOCENTE: estadoEdicion.urlFirmaExistente || '',
      URL_PDF_ACTA: estadoEdicion.urlPdfExistente || '',
      ESTADO_ACTA: 'FIRMADA'
    };

    const formularioCompleto = {
      cod: window.ConfigManager.APP_CONFIG.INSTITUCION.CODIGO_FORMATO,
      version: window.ConfigManager.APP_CONFIG.INSTITUCION.VERSION_FORMATO,
      formato: tipo,
      campos: campos
    };

    return {
      valido: true,
      acta: actaConsolidada,
      formularioCompleto: formularioCompleto
    };
  }

  /* === SECCIÓN 4: CARGA DE ACTA EXISTENTE PARA EDICIÓN DESDE EXCEL === */
  function cargarActaEnFormulario(respuestaBackend) {
    const acta = respuestaBackend.acta || {};
    const formCompleto = respuestaBackend.formularioCompleto || {};
    const camposGuardados = formCompleto.campos || {};

    const tipo = (acta.TIPO_DEPENDENCIA || formCompleto.formato || 'SALON').toUpperCase();
    limpiarFormulario(false);
    cambiarDependencia(tipo);

    // Activar estado y banner de edición
    estadoEdicion.idActa = acta.ID_ACTA || '';
    estadoEdicion.fechaRegistro = acta.FECHA_REGISTRO || '';
    estadoEdicion.urlFirmaExistente = acta.URL_FIRMA_DOCENTE || '';
    estadoEdicion.urlPdfExistente = acta.URL_PDF_ACTA || '';

    const inputId = document.getElementById('input-id-acta');
    if (inputId) inputId.value = estadoEdicion.idActa;

    const lblIdEdicion = document.getElementById('lbl-id-acta-edicion');
    if (lblIdEdicion) {
      lblIdEdicion.textContent = `${estadoEdicion.idActa} (${acta.SALON_DEPENDENCIA || ''})`;
    }

    const bannerEdicion = document.getElementById('banner-edicion');
    if (bannerEdicion) bannerEdicion.classList.remove('hidden');

    const formEl = obtenerFormularioActivo();
    if (!formEl) return;

    // Combinar valores de respaldo desde las columnas planas + JSON exacto de cada celda
    const fuenteDatos = Object.assign({}, acta, camposGuardados);

    // Restaurar inputs y textareas con data-field
    formEl.querySelectorAll('[data-field]').forEach((el) => {
      const key = el.dataset.field;
      if (fuenteDatos[key] !== undefined && fuenteDatos[key] !== null) {
        el.value = fuenteDatos[key];
      }
    });

    // Restaurar botones de radio con data-radio-group
    formEl.querySelectorAll('input[type="radio"][data-radio-group]').forEach((radio) => {
      const groupName = radio.dataset.radioGroup;
      const valGuardado = String(fuenteDatos[groupName] || '').toUpperCase();
      radio.checked = (valGuardado !== '' && radio.value.toUpperCase() === valGuardado);
    });

    // Restaurar cédula del docente
    const inputCC = document.getElementById('input-cc-docente');
    if (inputCC) {
      inputCC.value = fuenteDatos.CC_DOCENTE || '';
    }

    // Mostrar vista previa de firma guardada en Drive si existe
    const imgFirma = document.getElementById('img-firma-guardada');
    if (imgFirma && estadoEdicion.urlFirmaExistente) {
      const urlVisual = convertirUrlDriveVisual(estadoEdicion.urlFirmaExistente);
      imgFirma.src = urlVisual;
      imgFirma.classList.remove('hidden');
    }
  }

  function convertirUrlDriveVisual(url) {
    const match = String(url || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return url;
  }

  /* === SECCIÓN 5: REINICIO Y LIMPIEZA DEL FORMULARIO === */
  function limpiarFormulario(resetearBienesQR = true) {
    estadoEdicion.idActa = '';
    estadoEdicion.fechaRegistro = '';
    estadoEdicion.urlFirmaExistente = '';
    estadoEdicion.urlPdfExistente = '';

    const inputId = document.getElementById('input-id-acta');
    if (inputId) inputId.value = '';

    const bannerEdicion = document.getElementById('banner-edicion');
    if (bannerEdicion) bannerEdicion.classList.add('hidden');

    document.querySelectorAll('.formato-oficial').forEach((form) => {
      form.reset();
    });

    const inputCC = document.getElementById('input-cc-docente');
    if (inputCC) inputCC.value = '';

    const imgFirma = document.getElementById('img-firma-guardada');
    if (imgFirma) {
      imgFirma.src = '';
      imgFirma.classList.add('hidden');
    }

    if (resetearBienesQR && window.ScannerManager) {
      window.ScannerManager.limpiarBienes();
    }

    actualizarPaginacion(0);
  }

  function obtenerEstadoEdicion() {
    return Object.assign({}, estadoEdicion);
  }

  return {
    cambiarDependencia,
    obtenerTipoActivo,
    obtenerFormularioActivo,
    actualizarPaginacion,
    recopilarDatosFormulario,
    cargarActaEnFormulario,
    limpiarFormulario,
    obtenerEstadoEdicion
  };
})();
