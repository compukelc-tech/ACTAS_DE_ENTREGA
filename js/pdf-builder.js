/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - GENERADOR DE PDF
 * Institución Educativa San Francisco de Sales | Desarrollado por compukelc
 * Versión: 1.0.4 (Ancho unificado 730px sin recortes laterales en móvil/PC)
 * ============================================================================
 */

window.PdfBuilder = (() => {
  /* === SECCIÓN 1: CREACIÓN DE CLON LIMPIO EN ESCENARIO FIJO (0,0) === */
  function crearEscenarioClonadoPdf(wrapper, firmaDataUrl) {
    const ANCHO_PDF_PX = 730;

    // 1. Crear escenario anclado en (0,0) detrás del #loader-global (z-index: 500)
    const stage = document.createElement('div');
    stage.id = 'pdf-render-stage';
    stage.style.position = 'absolute';
    stage.style.left = '0px';
    stage.style.top = '0px';
    stage.style.width = `${ANCHO_PDF_PX}px`;
    stage.style.backgroundColor = '#ffffff';
    stage.style.zIndex = '400';
    stage.style.margin = '0';
    stage.style.padding = '0';
    stage.style.overflow = 'visible';

    // 2. Clonar el contenedor del documento y forzar ancho exacto de 730px
    const clon = wrapper.cloneNode(true);
    clon.id = 'documento-acta-clon-pdf';
    clon.classList.add('pdf-export-mode');
    clon.style.setProperty('width', `${ANCHO_PDF_PX}px`, 'important');
    clon.style.setProperty('max-width', `${ANCHO_PDF_PX}px`, 'important');
    clon.style.setProperty('min-width', `${ANCHO_PDF_PX}px`, 'important');
    clon.style.setProperty('margin', '0', 'important');
    clon.style.setProperty('padding', '10px 12px', 'important');
    clon.style.setProperty('box-sizing', 'border-box', 'important');

    // 3. Eliminar formularios ocultos de otras dependencias y controles .no-print
    clon.querySelectorAll('.formato-oficial.hidden').forEach((f) => f.remove());
    clon.querySelectorAll('.no-print').forEach((el) => el.remove());

    // 4. Si hay 0 bienes QR vinculados, ocultar la sección de anexo
    const totalQR = window.ScannerManager ? window.ScannerManager.obtenerListaBienes().length : 0;
    const seccionAnexo = clon.querySelector('.anexo-qr-section');
    if (seccionAnexo && totalQR === 0) {
      seccionAnexo.remove();
    }

    // 5. Sincronizar valores vivos desde el formulario activo original hacia el clon
    const formOrigActivo = wrapper.querySelector('.formato-oficial.activo');
    const formClonActivo = clon.querySelector('.formato-oficial.activo');

    if (formOrigActivo && formClonActivo) {
      const camposOrig = formOrigActivo.querySelectorAll('input, textarea');
      const camposClon = formClonActivo.querySelectorAll('input, textarea');
      camposOrig.forEach((origEl, i) => {
        const clonEl = camposClon[i];
        if (!clonEl) return;
        if (origEl.type === 'radio' || origEl.type === 'checkbox') {
          clonEl.checked = origEl.checked;
        } else {
          clonEl.value = origEl.value;
        }
      });
    }

    // Sincronizar cédula y observaciones de tarjetas QR
    const ccOrig = wrapper.querySelector('#input-cc-docente');
    const ccClon = clon.querySelector('#input-cc-docente');
    if (ccOrig && ccClon) ccClon.value = ccOrig.value;

    const qrObsOrig = wrapper.querySelectorAll('.qr-obs-input');
    const qrObsClon = clon.querySelectorAll('.qr-obs-input');
    qrObsOrig.forEach((origEl, i) => {
      if (qrObsClon[i]) qrObsClon[i].value = origEl.value;
    });

    // 6. Convertir todos los <input> en texto plano o casillas marcadas (sin placeholders)
    clon.querySelectorAll('input').forEach((inp) => {
      if (inp.type === 'hidden') {
        inp.remove();
        return;
      }

      if (inp.type === 'radio') {
        const marca = document.createElement('span');
        marca.style.display = 'inline-block';
        marca.style.width = '14px';
        marca.style.height = '14px';
        marca.style.lineHeight = '13px';
        marca.style.textAlign = 'center';
        marca.style.fontWeight = '700';
        marca.style.fontSize = '11px';
        marca.style.border = '1px solid #000000';
        marca.textContent = inp.checked ? 'X' : '';
        inp.parentNode.replaceChild(marca, inp);
        return;
      }

      const spanVal = document.createElement('span');
      const valorLimpio = (inp.value || '').trim();
      spanVal.textContent = valorLimpio;
      spanVal.style.fontFamily = 'Arial, Helvetica, sans-serif';
      spanVal.style.color = '#000000';

      if (inp.classList.contains('inline-input') || inp.classList.contains('inline-year')) {
        spanVal.style.display = 'inline-block';
        spanVal.style.minWidth = '42px';
        spanVal.style.borderBottom = '1px solid #000000';
        spanVal.style.fontWeight = '700';
        spanVal.style.fontSize = '11px';
        spanVal.style.padding = '0 3px';
      } else if (inp.classList.contains('inline-num')) {
        spanVal.style.display = 'inline-block';
        spanVal.style.minWidth = '28px';
        spanVal.style.border = '1px solid #000000';
        spanVal.style.textAlign = 'center';
        spanVal.style.fontWeight = '700';
        spanVal.style.fontSize = '11px';
        spanVal.style.padding = '1px 4px';
        spanVal.style.marginLeft = '4px';
      } else if (inp.classList.contains('cell-num') || inp.classList.contains('cell-txt')) {
        spanVal.style.display = 'block';
        spanVal.style.width = '100%';
        spanVal.style.textAlign = 'center';
        spanVal.style.fontWeight = '700';
        spanVal.style.fontSize = '10.5px';
        spanVal.style.minHeight = '14px';
      } else {
        spanVal.style.display = 'block';
        spanVal.style.width = '100%';
        spanVal.style.minHeight = '16px';
        spanVal.style.borderBottom = '1px solid #000000';
        spanVal.style.fontSize = '11px';
        spanVal.style.padding = '2px 2px 1px';
      }

      inp.parentNode.replaceChild(spanVal, inp);
    });

    // 7. Convertir todos los <textarea> en bloques <div> expandibles
    clon.querySelectorAll('textarea').forEach((ta) => {
      const bloqueTxt = document.createElement('div');
      bloqueTxt.style.minHeight = '30px';
      bloqueTxt.style.fontSize = '10.5px';
      bloqueTxt.style.lineHeight = '1.35';
      bloqueTxt.style.whiteSpace = 'pre-wrap';
      bloqueTxt.style.wordBreak = 'break-word';
      bloqueTxt.style.padding = '2px 4px';
      bloqueTxt.style.color = '#000000';
      bloqueTxt.textContent = (ta.value || '').trim() || ' ';
      ta.parentNode.replaceChild(bloqueTxt, ta);
    });

    // 8. Reemplazar el lienzo de firma por la imagen Base64 de la firma
    const canvasClon = clon.querySelector('#canvas-firma');
    const imgGuardadaClon = clon.querySelector('#img-firma-guardada');
    if (canvasClon) {
      if (firmaDataUrl) {
        const imgFirma = document.createElement('img');
        imgFirma.src = firmaDataUrl;
        imgFirma.style.maxWidth = '310px';
        imgFirma.style.maxHeight = '90px';
        imgFirma.style.display = 'block';
        imgFirma.style.borderBottom = '1px solid #000000';
        canvasClon.parentNode.replaceChild(imgFirma, canvasClon);
      } else {
        const lineaVacia = document.createElement('div');
        lineaVacia.style.height = '60px';
        lineaVacia.style.borderBottom = '1px solid #000000';
        canvasClon.parentNode.replaceChild(lineaVacia, canvasClon);
      }
    }
    if (imgGuardadaClon) {
      imgGuardadaClon.remove();
    }

    // 9. Proteger contra imágenes externas que no estén en Data URI Base64
    clon.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src && !src.startsWith('data:image')) {
        const aviso = document.createElement('div');
        aviso.className = 'qr-sin-foto';
        aviso.textContent = 'Evidencia vinculada en Drive';
        img.parentNode.replaceChild(aviso, img);
      }
    });

    stage.appendChild(clon);
    document.body.appendChild(stage);

    // 10. Sincronizar el número total de páginas en el encabezado con la altura real medida
    const alturaPx = clon.scrollHeight || 900;
    const paginasEstimadas = Math.max(1, Math.ceil(alturaPx / 915));
    const spanPag = clon.querySelector('.pag-dinamica');
    if (spanPag) {
      spanPag.textContent = `1 DE ${paginasEstimadas}`;
    }

    return { stage, clon, anchoPdfPx: ANCHO_PDF_PX };
  }

  /* === SECCIÓN 2: CONSTRUCCIÓN DEL PDF Y NUMERACIÓN DE PÁGINAS === */
  async function construirDocumentoPdf(nombreArchivo, firmaDataUrl = '') {
    if (typeof html2pdf === 'undefined') {
      throw new Error('La librería html2pdf.js aún no ha terminado de cargar.');
    }

    const wrapper = document.getElementById('documento-acta-wrapper');
    if (!wrapper) {
      throw new Error('No se encontró el contenedor del acta para exportar.');
    }

    const { stage, clon, anchoPdfPx } = crearEscenarioClonadoPdf(wrapper, firmaDataUrl);

    try {
      const opciones = {
        margin: [8, 8, 11, 8],
        filename: nombreArchivo,
        image: { type: 'jpeg', quality: 0.94 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          width: anchoPdfPx,
          windowWidth: anchoPdfPx + 30
        },
        jsPDF: {
          unit: 'mm',
          format: 'letter',
          orientation: 'portrait'
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: [
            '.qr-bien-card',
            '.firma-section',
            '.tbl-institucional',
            '.tbl-datos-generales',
            '.clausula-box'
          ]
        }
      };

      const worker = html2pdf().set(opciones).from(clon).toPdf();
      const pdf = await worker.get('pdf');

      // Estampar pie de paginación real (Pág. X de Y)
      const totalPaginas = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(70, 70, 70);

      for (let i = 1; i <= totalPaginas; i++) {
        pdf.setPage(i);
        pdf.text(
          `CÓD. GA-R26 | Pág. ${i} de ${totalPaginas}`,
          pageWidth - 10,
          pageHeight - 5,
          { align: 'right' }
        );
      }

      return pdf;
    } finally {
      if (stage && stage.parentNode) {
        stage.parentNode.removeChild(stage);
      }
    }
  }

  /* === SECCIÓN 3: MÉTODOS PÚBLICOS (BASE64 PARA DRIVE Y DESCARGA LOCAL) === */
  function construirNombreArchivo(datosActa) {
    const tipo = (datosActa && datosActa.TIPO_DEPENDENCIA) ? datosActa.TIPO_DEPENDENCIA : 'ACTA';
    const salon = (datosActa && datosActa.SALON_DEPENDENCIA) ? datosActa.SALON_DEPENDENCIA : 'DEPENDENCIA';
    const limpio = `${tipo}_${salon}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `GA-R26_${limpio || 'ENTREGA'}.pdf`;
  }

  async function generarPdfBase64(datosActa, firmaDataUrl = '') {
    const nombreArchivo = construirNombreArchivo(datosActa);
    const pdf = await construirDocumentoPdf(nombreArchivo, firmaDataUrl);
    const rawDataUri = pdf.output('datauristring');
    const idxBase64 = rawDataUri.indexOf('base64,');
    if (idxBase64 === -1) {
      throw new Error('No se pudo codificar el PDF en Base64.');
    }
    return 'data:application/pdf;base64,' + rawDataUri.substring(idxBase64 + 7);
  }

  async function descargarPdfLocal(datosActa, firmaDataUrl = '') {
    const nombreArchivo = construirNombreArchivo(datosActa);
    const pdf = await construirDocumentoPdf(nombreArchivo, firmaDataUrl);
    pdf.save(nombreArchivo);
    return nombreArchivo;
  }

  return {
    generarPdfBase64,
    descargarPdfLocal,
    construirNombreArchivo
  };
})();
