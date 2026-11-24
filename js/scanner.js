/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - ESCÁNER QR Y FOTOS
 * Institución Educativa San Francisco de Sales | Desarrollado por compukelc
 * Versión: 1.0.0
 * ============================================================================
 */

window.ScannerManager = (() => {
  /* === SECCIÓN 1: ESTADO INTERNO Y PARÁMETROS DE COMPRESIÓN === */
  let bienesVinculados = [];
  let html5QrCode = null;
  let camaraActiva = false;
  let bloqueoLectura = false;
  let indiceFotoEnCurso = -1;

  const COMPRESION_CONFIG = {
    MAX_WIDTH: 960,
    MAX_HEIGHT: 960,
    QUALITY: 0.72
  };

  // Input oculto reutilizable para capturar o seleccionar fotografía de un bien
  const inputFileFoto = document.createElement('input');
  inputFileFoto.type = 'file';
  inputFileFoto.accept = 'image/*';
  inputFileFoto.setAttribute('capture', 'environment');
  inputFileFoto.className = 'hidden';
  document.body.appendChild(inputFileFoto);

  inputFileFoto.addEventListener('change', async (e) => {
    const archivo = e.target.files && e.target.files[0];
    inputFileFoto.value = '';
    if (!archivo || indiceFotoEnCurso < 0 || !bienesVinculados[indiceFotoEnCurso]) {
      return;
    }

    try {
      mostrarLoader('Comprimiendo evidencia fotográfica...');
      const base64Comprimida = await comprimirImagenCanvas(archivo);
      bienesVinculados[indiceFotoEnCurso].fotoNuevaBase64 = base64Comprimida;
      bienesVinculados[indiceFotoEnCurso].fotoBase64 = base64Comprimida;
      renderizarListaBienes();
    } catch (err) {
      alert('No se pudo procesar la fotografía: ' + err.message);
    } finally {
      indiceFotoEnCurso = -1;
      ocultarLoader();
    }
  });

  /* === SECCIÓN 2: CONTROL DE CÁMARA QR (CÁMARA TRASERA PRINCIPAL) === */
  async function iniciarCamara() {
    if (camaraActiva) return;

    if (typeof Html5Qrcode === 'undefined') {
      alert('La librería de lectura QR aún está cargando. Intenta de nuevo en un segundo.');
      return;
    }

    const readerBox = document.getElementById('qr-reader-box');
    const btnAbrir = document.getElementById('btn-abrir-camara-qr');
    const btnCerrar = document.getElementById('btn-cerrar-camara-qr');

    if (readerBox) readerBox.classList.remove('hidden');
    if (btnAbrir) btnAbrir.classList.add('hidden');
    if (btnCerrar) btnCerrar.classList.remove('hidden');

    try {
      html5QrCode = new Html5Qrcode('qr-reader');
      const cameraConfig = await seleccionarCamaraTraseraPrincipal();

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.0
        },
        onScanSuccess,
        () => {}
      );

      camaraActiva = true;
    } catch (err) {
      camaraActiva = false;
      if (readerBox) readerBox.classList.add('hidden');
      if (btnAbrir) btnAbrir.classList.remove('hidden');
      if (btnCerrar) btnCerrar.classList.add('hidden');
      alert('No se pudo acceder a la cámara: ' + (err.message || err));
    }
  }

  /**
   * Selecciona la cámara trasera principal evitando lentes gran angular o frontales
   */
  async function seleccionarCamaraTraseraPrincipal() {
    try {
      const camaras = await Html5Qrcode.getCameras();
      if (Array.isArray(camaras) && camaras.length > 0) {
        const traseras = camaras.filter((c) => {
          const lbl = (c.label || '').toLowerCase();
          return (
            (lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment') || lbl.includes('trasera')) &&
            !lbl.includes('front') &&
            !lbl.includes('wide') &&
            !lbl.includes('ultra') &&
            !lbl.includes('macro')
          );
        });

        if (traseras.length > 0) {
          return traseras[0].id;
        }
      }
    } catch (e) {
      // Fallback estándar por facingMode
    }
    return { facingMode: 'environment' };
  }

  async function detenerCamara() {
    const readerBox = document.getElementById('qr-reader-box');
    const btnAbrir = document.getElementById('btn-abrir-camara-qr');
    const btnCerrar = document.getElementById('btn-cerrar-camara-qr');

    try {
      if (html5QrCode && camaraActiva) {
        await html5QrCode.stop();
        html5QrCode.clear();
      }
    } catch (e) {
      // Ignorar errores al liberar cámara ya detenida
    } finally {
      camaraActiva = false;
      html5QrCode = null;
      if (readerBox) readerBox.classList.add('hidden');
      if (btnAbrir) btnAbrir.classList.remove('hidden');
      if (btnCerrar) btnCerrar.classList.add('hidden');
    }
  }

  async function onScanSuccess(decodedText) {
    if (bloqueoLectura) return;
    bloqueoLectura = true;

    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    try {
      await agregarBienPorQR(decodedText);
    } finally {
      setTimeout(() => {
        bloqueoLectura = false;
      }, 2200);
    }
  }

  /* === SECCIÓN 3: CONSULTA AL BACKEND Y GESTIÓN DE BIENES (0..N) === */
  function extraerCodigoLimpio(entrada) {
    const raw = String(entrada || '').trim();
    if (!raw) return '';
    const match = raw.match(/[?&]codigo=([^&#]+)/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
    return raw;
  }

  async function agregarBienPorQR(entradaQR) {
    const codigo = extraerCodigoLimpio(entradaQR);
    if (!codigo) {
      alert('Ingresa o escanea un código QR válido.');
      return;
    }

    const yaExiste = bienesVinculados.some(
      (b) => String(b.codigo).toUpperCase() === codigo.toUpperCase()
    );

    if (yaExiste) {
      const continuar = confirm(
        `El código ${codigo} ya está agregado en esta acta. ¿Deseas volver a consultarlo y añadirlo nuevamente?`
      );
      if (!continuar) return;
    }

    try {
      mostrarLoader(`Consultando bien ${codigo} en base de datos...`);
      const resp = await window.ConfigManager.apiGet('consultarQR', { codigo });
      const bien = resp.bien || {};

      bienesVinculados.push({
        codigo: bien.codigo || codigo,
        urlConsulta: bien.urlConsulta || '',
        nombre: bien.nombre || 'Activo Inventariado',
        marcaModeloSerial: bien.marcaModeloSerial || 'N/R',
        estado: (bien.estado || 'BUENO').toUpperCase(),
        ubicacion: bien.ubicacion || '',
        observacion: bien.observacion || '',
        fechaEscaneo: bien.fechaEscaneo || obtenerFechaHoraLocal(),
        fotoUrl: bien.fotoUrl || '',
        fotoBase64: bien.fotoBase64 || '',
        fotoNuevaBase64: ''
      });

      const inputManual = document.getElementById('input-codigo-qr-manual');
      if (inputManual) inputManual.value = '';

      renderizarListaBienes();
    } catch (err) {
      alert(`Error al consultar QR (${codigo}): ${err.message}`);
    } finally {
      ocultarLoader();
    }
  }

  function eliminarBien(index) {
    if (index < 0 || index >= bienesVinculados.length) return;
    bienesVinculados.splice(index, 1);
    renderizarListaBienes();
  }

  function moverBien(index, direccion) {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= bienesVinculados.length) return;
    const temp = bienesVinculados[index];
    bienesVinculados[index] = bienesVinculados[nuevoIndex];
    bienesVinculados[nuevoIndex] = temp;
    renderizarListaBienes();
  }

  function actualizarObservacionBien(index, texto) {
    if (bienesVinculados[index]) {
      bienesVinculados[index].observacion = texto;
    }
  }

  function solicitarFotoBien(index) {
    indiceFotoEnCurso = index;
    inputFileFoto.click();
  }

  /**
   * Carga los bienes QR guardados cuando se abre un acta desde Excel para edición
   */
  function cargarBienesGuardados(listaBienes) {
    bienesVinculados = Array.isArray(listaBienes)
      ? listaBienes.map((b) => ({
          codigo: b.codigo || '',
          urlConsulta: b.urlConsulta || '',
          nombre: b.nombre || '',
          marcaModeloSerial: b.marcaModeloSerial || 'N/R',
          estado: (b.estado || 'BUENO').toUpperCase(),
          ubicacion: b.ubicacion || '',
          observacion: b.observacion || '',
          fechaEscaneo: b.fechaEscaneo || '',
          fotoUrl: b.fotoUrl || '',
          fotoBase64: b.fotoBase64 || '',
          fotoNuevaBase64: ''
        }))
      : [];

    renderizarListaBienes();
  }

  function limpiarBienes() {
    bienesVinculados = [];
    renderizarListaBienes();
  }

  function obtenerListaBienes() {
    return bienesVinculados.map((b) => Object.assign({}, b));
  }

  /* === SECCIÓN 4: RENDERIZADO COMPACTO TIPO FORMULARIO + FOTO === */
  function renderizarListaBienes() {
    const contenedor = document.getElementById('lista-bienes-qr');
    const contadorEl = document.getElementById('contador-bienes-qr');
    const seccionAnexo = document.querySelector('.anexo-qr-section');

    if (contadorEl) {
      contadorEl.textContent = String(bienesVinculados.length);
    }

    if (seccionAnexo) {
      seccionAnexo.classList.toggle('sin-bienes-qr', bienesVinculados.length === 0);
    }

    if (window.FormsManager) {
      window.FormsManager.actualizarPaginacion(bienesVinculados.length);
    }

    if (!contenedor) return;

    if (bienesVinculados.length === 0) {
      contenedor.innerHTML = `
        <div id="estado-vacio-qr" class="empty-qr-state no-print">
          No hay bienes con QR vinculados en esta acta. Si la dependencia no tiene equipos etiquetados, puede guardar y generar el PDF directamente.
        </div>
      `;
      return;
    }

    contenedor.innerHTML = bienesVinculados
      .map((bien, idx) => {
        const srcImagen = bien.fotoNuevaBase64 || bien.fotoBase64 || '';
        const bloqueImagen = srcImagen
          ? `<img src="${srcImagen}" alt="Evidencia ${escaparHTML(bien.codigo)}" />`
          : `<div class="qr-sin-foto">Sin fotografía registrada en BD</div>`;

        return `
          <article class="qr-bien-card" data-qr-index="${idx}">
            <div class="qr-bien-header">
              <span>BIEN VERIFICADO #${idx + 1} &mdash; PLACA / QR: ${escaparHTML(bien.codigo)}</span>
              <div class="qr-bien-actions no-print">
                <button type="button" class="btn-tiny" data-action="subir" data-idx="${idx}" title="Subir orden">&#9650;</button>
                <button type="button" class="btn-tiny" data-action="bajar" data-idx="${idx}" title="Bajar orden">&#9660;</button>
                <button type="button" class="btn-tiny" data-action="foto" data-idx="${idx}" title="Tomar o cambiar foto">&#128247; Foto</button>
                <button type="button" class="btn-tiny-danger" data-action="eliminar" data-idx="${idx}" title="Quitar bien">&times; Quitar</button>
              </div>
            </div>

            <div class="qr-bien-body">
              <div class="qr-bien-info">
                <table class="tbl-qr-ficha">
                  <tr>
                    <td class="qr-lbl">CÓDIGO QR:</td>
                    <td class="qr-val"><strong>${escaparHTML(bien.codigo)}</strong></td>
                    <td class="qr-lbl">VERIFICADO:</td>
                    <td class="qr-val">${escaparHTML(bien.fechaEscaneo)}</td>
                  </tr>
                  <tr>
                    <td class="qr-lbl">DESCRIPCIÓN:</td>
                    <td class="qr-val" colspan="3">${escaparHTML(bien.nombre)}</td>
                  </tr>
                  <tr>
                    <td class="qr-lbl">MARCA / SERIAL:</td>
                    <td class="qr-val">${escaparHTML(bien.marcaModeloSerial)}</td>
                    <td class="qr-lbl">ESTADO BD:</td>
                    <td class="qr-val"><strong>${escaparHTML(bien.estado)}</strong></td>
                  </tr>
                  <tr>
                    <td class="qr-lbl">UBICACIÓN BD:</td>
                    <td class="qr-val" colspan="3">${escaparHTML(bien.ubicacion || 'Sin ubicación registrada')}</td>
                  </tr>
                  <tr>
                    <td class="qr-lbl">OBSERVACIÓN:</td>
                    <td class="qr-val" colspan="3">
                      <input
                        type="text"
                        class="qr-obs-input"
                        data-idx="${idx}"
                        value="${escaparAtributo(bien.observacion)}"
                        placeholder="Observación puntual de este bien..."
                      />
                    </td>
                  </tr>
                </table>
              </div>

              <div class="qr-bien-foto">
                ${bloqueImagen}
                <button type="button" class="btn-tiny btn-foto-bien no-print" data-action="foto" data-idx="${idx}">
                  &#128247; ${srcImagen ? 'Cambiar foto' : 'Añadir foto'}
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    // Enlazar eventos delegados de tarjetas QR
    contenedor.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const acc = btn.dataset.action;
        if (acc === 'eliminar') eliminarBien(idx);
        else if (acc === 'subir') moverBien(idx, -1);
        else if (acc === 'bajar') moverBien(idx, 1);
        else if (acc === 'foto') solicitarFotoBien(idx);
      });
    });

    contenedor.querySelectorAll('.qr-obs-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.idx, 10);
        actualizarObservacionBien(idx, inp.value);
      });
    });
  }

  /* === SECCIÓN 5: COMPRESIÓN DE IMAGEN EN CLIENTE VÍA HTML5 <CANVAS> === */
  function comprimirImagenCanvas(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagen inválido.'));
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > COMPRESION_CONFIG.MAX_WIDTH || height > COMPRESION_CONFIG.MAX_HEIGHT) {
            const ratio = Math.min(
              COMPRESION_CONFIG.MAX_WIDTH / width,
              COMPRESION_CONFIG.MAX_HEIGHT / height
            );
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', COMPRESION_CONFIG.QUALITY);
          resolve(dataUrl);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* === SECCIÓN 6: UTILIDADES AUXILIARES === */
  function obtenerFechaHoraLocal() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function escaparHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escaparAtributo(str) {
    return escaparHTML(str).replace(/"/g, '&quot;');
  }

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

  return {
    iniciarCamara,
    detenerCamara,
    agregarBienPorQR,
    eliminarBien,
    cargarBienesGuardados,
    limpiarBienes,
    obtenerListaBienes,
    renderizarListaBienes,
    comprimirImagenCanvas
  };
})();
