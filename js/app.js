/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - CONTROLADOR PRINCIPAL
 * Institución Educativa San Francisco de Sales | Desarrollado por compukelc
 * Versión: 1.0.0
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  /* === SECCIÓN 1: REFERENCIAS DOM Y ESTADO DE FIRMA DIGITAL === */
  const canvasFirma = document.getElementById('canvas-firma');
  const ctxFirma = canvasFirma ? canvasFirma.getContext('2d') : null;
  let dibujandoFirma = false;
  let firmaModificada = false;
  let ultX = 0;
  let ultY = 0;

  // Mostrar versión activa en la barra superior
  const badgeVersion = document.getElementById('badge-version');
  if (badgeVersion && window.ConfigManager) {
    badgeVersion.textContent = `v${window.ConfigManager.APP_CONFIG.VERSION}`;
  }

  /* === SECCIÓN 2: INICIALIZACIÓN DE LIENZO TÁCTIL PARA FIRMA DOCENTE === */
  function inicializarPadFirma() {
    if (!canvasFirma || !ctxFirma) return;

    ctxFirma.strokeStyle = '#0f172a';
    ctxFirma.lineWidth = 2.2;
    ctxFirma.lineCap = 'round';
    ctxFirma.lineJoin = 'round';

    const obtenerCoordenadas = (evento) => {
      const rect = canvasFirma.getBoundingClientRect();
      const scaleX = canvasFirma.width / rect.width;
      const scaleY = canvasFirma.height / rect.height;

      const punto = evento.touches && evento.touches.length > 0
        ? evento.touches[0]
        : evento;

      return {
        x: (punto.clientX - rect.left) * scaleX,
        y: (punto.clientY - rect.top) * scaleY
      };
    };

    const iniciarTrazo = (e) => {
      if (e.cancelable) e.preventDefault();
      dibujandoFirma = true;
      const pos = obtenerCoordenadas(e);
      ultX = pos.x;
      ultY = pos.y;

      // Si había una firma previa cargada en edición, ocultarla al iniciar nuevo trazo
      const imgGuardada = document.getElementById('img-firma-guardada');
      if (imgGuardada && !imgGuardada.classList.contains('hidden')) {
        imgGuardada.classList.add('hidden');
      }
    };

    const moverTrazo = (e) => {
      if (!dibujandoFirma) return;
      if (e.cancelable) e.preventDefault();

      const pos = obtenerCoordenadas(e);
      ctxFirma.beginPath();
      ctxFirma.moveTo(ultX, ultY);
      ctxFirma.lineTo(pos.x, pos.y);
      ctxFirma.stroke();

      ultX = pos.x;
      ultY = pos.y;
      firmaModificada = true;
    };

    const finalizarTrazo = () => {
      dibujandoFirma = false;
    };

    // Eventos de ratón
    canvasFirma.addEventListener('mousedown', iniciarTrazo);
    canvasFirma.addEventListener('mousemove', moverTrazo);
    window.addEventListener('mouseup', finalizarTrazo);

    // Eventos táctiles móviles
    canvasFirma.addEventListener('touchstart', iniciarTrazo, { passive: false });
    canvasFirma.addEventListener('touchmove', moverTrazo, { passive: false });
    canvasFirma.addEventListener('touchend', finalizarTrazo);
  }

  function limpiarPadFirma() {
    if (canvasFirma && ctxFirma) {
      ctxFirma.clearRect(0, 0, canvasFirma.width, canvasFirma.height);
    }
    firmaModificada = false;

    const imgGuardada = document.getElementById('img-firma-guardada');
    if (imgGuardada) {
      imgGuardada.src = '';
      imgGuardada.classList.add('hidden');
    }
  }

  function obtenerFirmaBase64Nueva() {
    if (!canvasFirma || !firmaModificada) return '';
    return canvasFirma.toDataURL('image/png');
  }

  function obtenerFirmaParaPdf() {
    if (firmaModificada && canvasFirma) {
      return canvasFirma.toDataURL('image/png');
    }
    const imgGuardada = document.getElementById('img-firma-guardada');
    if (imgGuardada && !imgGuardada.classList.contains('hidden') && imgGuardada.src) {
      return imgGuardada.src;
    }
    return '';
  }

  /* === SECCIÓN 3: NAVEGACIÓN ENTRE VISTAS Y MODAL DE CONFIGURACIÓN API === */
  function cambiarVista(idVistaObjetivo) {
    const vistaForm = document.getElementById('vista-formulario');
    const vistaHist = document.getElementById('vista-historial');

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.vista === idVistaObjetivo);
    });

    if (idVistaObjetivo === 'vista-historial') {
      if (vistaForm) vistaForm.classList.add('hidden');
      if (vistaHist) vistaHist.classList.remove('hidden');
      cargarListaHistorial();
    } else {
      if (vistaHist) vistaHist.classList.add('hidden');
      if (vistaForm) vistaForm.classList.remove('hidden');
    }
  }

  function abrirModalApi() {
    const modal = document.getElementById('modal-api');
    const inputUrl = document.getElementById('input-api-url');
    const estadoBox = document.getElementById('estado-conexion-api');

    if (inputUrl) {
      inputUrl.value = window.ConfigManager.getApiUrl();
    }
    if (estadoBox) {
      estadoBox.className = 'status-box hidden';
      estadoBox.textContent = '';
    }
    if (modal) modal.classList.remove('hidden');
  }

  function cerrarModalApi() {
    const modal = document.getElementById('modal-api');
    if (modal) modal.classList.add('hidden');
  }

  async function probarConexionApi() {
    const inputUrl = document.getElementById('input-api-url');
    const estadoBox = document.getElementById('estado-conexion-api');
    const urlPrueba = (inputUrl ? inputUrl.value : '').trim();

    if (!estadoBox) return;

    if (!urlPrueba) {
      estadoBox.className = 'status-box error';
      estadoBox.textContent = 'Ingresa primero la URL /exec de Google Apps Script.';
      return;
    }

    estadoBox.className = 'status-box';
    estadoBox.textContent = 'Probando conexión con el servidor...';

    try {
      const res = await window.ConfigManager.pingBackend(urlPrueba);
      estadoBox.className = 'status-box ok';
      estadoBox.textContent = `Conexión exitosa: ${res.mensaje} (${res.timestamp})`;
    } catch (err) {
      estadoBox.className = 'status-box error';
      estadoBox.textContent = `Error de conexión: ${err.message}`;
    }
  }

  function guardarUrlApi() {
    const inputUrl = document.getElementById('input-api-url');
    const estadoBox = document.getElementById('estado-conexion-api');

    try {
      window.ConfigManager.setApiUrl(inputUrl ? inputUrl.value : '');
      cerrarModalApi();
    } catch (err) {
      if (estadoBox) {
        estadoBox.className = 'status-box error';
        estadoBox.textContent = err.message;
      } else {
        alert(err.message);
      }
    }
  }

  /* === SECCIÓN 4: GUARDAR ACTA + PDF EN GOOGLE DRIVE Y EXCEL === */
  async function guardarActaCompleta() {
    if (!window.ConfigManager.getApiUrl()) {
      alert('Configura primero la URL /exec del backend en el botón "API".');
      abrirModalApi();
      return;
    }

    // Detener cámara QR si quedó encendida
    if (window.ScannerManager) {
      await window.ScannerManager.detenerCamara();
    }

    const resultadoForm = window.FormsManager.recopilarDatosFormulario();
    if (!resultadoForm.valido) {
      alert(resultadoForm.error);
      return;
    }

    const bienesQR = window.ScannerManager.obtenerListaBienes();
    const firmaBase64Nueva = obtenerFirmaBase64Nueva();
    const firmaParaPdf = obtenerFirmaParaPdf();

    try {
      mostrarLoader('Generando documento PDF oficial GA-R26...');
      const pdfBase64 = await window.PdfBuilder.generarPdfBase64(
        resultadoForm.acta,
        firmaParaPdf
      );

      mostrarLoader('Guardando registro en Google Sheets y archivos en Drive...');
      const payload = {
        action: 'guardarActa',
        acta: resultadoForm.acta,
        formularioCompleto: resultadoForm.formularioCompleto,
        bienesQR: bienesQR,
        firmaBase64: firmaBase64Nueva,
        pdfBase64: pdfBase64
      };

      const respuesta = await window.ConfigManager.apiPost(payload);

      ocultarLoader();
      alert(
        `${respuesta.mensaje}\n` +
        `ID Registro: ${respuesta.idActa}\n` +
        `Bienes QR vinculados: ${respuesta.totalBienesQR}`
      );

      // Recargar el acta recién guardada en modo edición para mantener su ID y enlaces actualizados
      await abrirActaParaEdicion(respuesta.idActa, false);
    } catch (err) {
      ocultarLoader();
      alert('Error al guardar el acta: ' + err.message);
    }
  }

  async function descargarSoloPdf() {
    if (window.ScannerManager) {
      await window.ScannerManager.detenerCamara();
    }

    const resultadoForm = window.FormsManager.recopilarDatosFormulario();
    if (!resultadoForm.valido) {
      alert(resultadoForm.error);
      return;
    }

    try {
      mostrarLoader('Construyendo archivo PDF para descarga...');
      const firmaParaPdf = obtenerFirmaParaPdf();
      await window.PdfBuilder.descargarPdfLocal(resultadoForm.acta, firmaParaPdf);
    } catch (err) {
      alert('No se pudo generar el PDF: ' + err.message);
    } finally {
      ocultarLoader();
    }
  }

  /* === SECCIÓN 5: CONSULTA, EDICIÓN Y ELIMINACIÓN DESDE EXCEL (CRUD) === */
  async function cargarListaHistorial() {
    const tbody = document.getElementById('tbody-historial');
    if (!tbody) return;

    if (!window.ConfigManager.getApiUrl()) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="center">
            Configura la URL /exec en el botón <strong>API</strong> para consultar las actas guardadas.
          </td>
        </tr>
      `;
      return;
    }

    const tipo = document.getElementById('filtro-tipo-historial')?.value || '';
    const busqueda = document.getElementById('input-busqueda-historial')?.value || '';

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="center">Consultando registros en BD_ACTAS_GA_R26...</td>
      </tr>
    `;

    try {
      const resp = await window.ConfigManager.apiGet('listarActas', { tipo, busqueda });
      const actas = resp.actas || [];

      if (actas.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="center">No se encontraron actas con los filtros seleccionados.</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = actas
        .map((a) => {
          const estadoClass = String(a.ESTADO_ACTA || '').toUpperCase() === 'FIRMADA' ? 'firmada' : '';
          const btnPdf = a.URL_PDF_ACTA
            ? `<a href="${escaparAttr(a.URL_PDF_ACTA)}" target="_blank" rel="noopener" class="btn-tiny" style="text-decoration:none;">&#128196; PDF</a>`
            : '';

          return `
            <tr>
              <td><strong>${escaparTxt(a.ID_ACTA)}</strong></td>
              <td>${escaparTxt(a.FECHA_REGISTRO)}</td>
              <td>${escaparTxt(a.TIPO_DEPENDENCIA)}</td>
              <td>${escaparTxt(a.SALON_DEPENDENCIA)}</td>
              <td>${escaparTxt(a.NOMBRE_TITULAR_DOCENTE)}</td>
              <td class="center"><strong>${escaparTxt(a.CANT_BIENES_QR)}</strong></td>
              <td class="center">
                <span class="badge-estado ${estadoClass}">${escaparTxt(a.ESTADO_ACTA || 'REGISTRADA')}</span>
              </td>
              <td>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                  <button type="button" class="btn-tiny" data-hist-action="editar" data-id="${escaparAttr(a.ID_ACTA)}">
                    &#9998; Editar
                  </button>
                  ${btnPdf}
                  <button type="button" class="btn-tiny-danger" data-hist-action="eliminar" data-id="${escaparAttr(a.ID_ACTA)}">
                    &#128465;
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      tbody.querySelectorAll('button[data-hist-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idActa = btn.dataset.id;
          const acc = btn.dataset.histAction;
          if (acc === 'editar') {
            abrirActaParaEdicion(idActa, true);
          } else if (acc === 'eliminar') {
            confirmarEliminarActa(idActa);
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="center" style="color:#c53030;">
            Error al cargar historial: ${escaparTxt(err.message)}
          </td>
        </tr>
      `;
    }
  }

  async function abrirActaParaEdicion(idActa, mostrarAviso = true) {
    try {
      mostrarLoader(`Cargando datos completos de ${idActa}...`);
      const resp = await window.ConfigManager.apiGet('obtenerActa', { idActa });

      limpiarPadFirma();
      window.FormsManager.cargarActaEnFormulario(resp);
      window.ScannerManager.cargarBienesGuardados(resp.bienesQR || []);

      cambiarVista('vista-formulario');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (mostrarAviso) {
        ocultarLoader();
      }
    } catch (err) {
      alert(`No se pudo abrir el acta ${idActa}: ${err.message}`);
    } finally {
      ocultarLoader();
    }
  }

  async function confirmarEliminarActa(idActa) {
    const seguro = confirm(
      `¿Estás seguro de eliminar el registro ${idActa} y sus bienes QR vinculados de la hoja de cálculo?`
    );
    if (!seguro) return;

    try {
      mostrarLoader(`Eliminando registro ${idActa}...`);
      await window.ConfigManager.apiPost({
        action: 'eliminarActa',
        idActa: idActa
      });
      ocultarLoader();
      await cargarListaHistorial();
    } catch (err) {
      ocultarLoader();
      alert('No se pudo eliminar el registro: ' + err.message);
    }
  }

  /* === SECCIÓN 6: ENLACE DE EVENTOS DE INTERFAZ === */
  function enlazarEventos() {
    // Pestañas superiores
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
    });

    // Modal de configuración API
    document.getElementById('btn-config-api')?.addEventListener('click', abrirModalApi);
    document.getElementById('btn-cerrar-modal-api')?.addEventListener('click', cerrarModalApi);
    document.getElementById('btn-probar-api')?.addEventListener('click', probarConexionApi);
    document.getElementById('btn-guardar-api')?.addEventListener('click', guardarUrlApi);

    // Selector de los 4 formatos oficiales GA-R26
    document.querySelectorAll('.dep-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.FormsManager.cambiarDependencia(btn.dataset.dep);
      });
    });

    // Botón cancelar edición / volver a acta nueva
    document.getElementById('btn-cancelar-edicion')?.addEventListener('click', () => {
      limpiarPadFirma();
      window.FormsManager.limpiarFormulario(true);
    });

    // Limpiar trazo de firma
    document.getElementById('btn-limpiar-firma')?.addEventListener('click', limpiarPadFirma);

    // Controles de cámara e ingreso manual QR
    document.getElementById('btn-abrir-camara-qr')?.addEventListener('click', () => {
      window.ScannerManager.iniciarCamara();
    });

    document.getElementById('btn-cerrar-camara-qr')?.addEventListener('click', () => {
      window.ScannerManager.detenerCamara();
    });

    document.getElementById('btn-buscar-qr-manual')?.addEventListener('click', () => {
      const inp = document.getElementById('input-codigo-qr-manual');
      if (inp) window.ScannerManager.agregarBienPorQR(inp.value);
    });

    document.getElementById('input-codigo-qr-manual')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.ScannerManager.agregarBienPorQR(e.target.value);
      }
    });

    // Botones de acción principal
    document.getElementById('btn-guardar-acta')?.addEventListener('click', guardarActaCompleta);
    document.getElementById('btn-descargar-pdf')?.addEventListener('click', descargarSoloPdf);

    document.getElementById('btn-nuevo-formulario')?.addEventListener('click', () => {
      if (confirm('¿Deseas limpiar todos los campos, la firma y los bienes QR escaneados?')) {
        limpiarPadFirma();
        window.FormsManager.limpiarFormulario(true);
      }
    });

    // Filtros del historial
    document.getElementById('btn-refrescar-historial')?.addEventListener('click', cargarListaHistorial);
    document.getElementById('filtro-tipo-historial')?.addEventListener('change', cargarListaHistorial);

    let timerBusqueda = null;
    document.getElementById('input-busqueda-historial')?.addEventListener('input', () => {
      clearTimeout(timerBusqueda);
      timerBusqueda = setTimeout(cargarListaHistorial, 350);
    });
  }

  /* === SECCIÓN 7: UTILIDADES DE INTERFAZ Y ARRANQUE === */
  function mostrarLoader(msg) {
    const loader = document.getElementById('loader-global');
    const txt = document.getElementById('loader-mensaje');
    if (txt) txt.textContent = msg || 'Procesando...';
    if (loader) loader.classList.remove('hidden');
  }

  function ocultarLoader() {
    const loader = document.getElementById('loader-global');
    if (loader) loader.classList.add('hidden');
  }

  function escaparTxt(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escaparAttr(str) {
    return escaparTxt(str).replace(/"/g, '&quot;');
  }

  // Inicialización general
  inicializarPadFirma();
  enlazarEventos();
  window.FormsManager.cambiarDependencia('SALON');

  // Si aún no hay URL /exec configurada, abrir automáticamente el modal la primera vez
  if (!window.ConfigManager.getApiUrl()) {
    abrirModalApi();
  }
});
