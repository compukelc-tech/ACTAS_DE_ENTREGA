/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - GENERADOR DE PDF
 * Institución Educativa San Francisco de Sales | Desarrollado por compukelc
 * Versión: 1.0.1
 * ============================================================================
 */

window.PdfBuilder = (() => {
  /* === SECCIÓN 1: PREPARACIÓN Y SANEAMIENTO DEL DOM PARA EXPORTACIÓN PDF === */
  function prepararVistaParaPdf(wrapper, firmaDataUrl) {
    const restauraciones = [];

    // 1. Activar ancho fijo institucional Carta y estilos limpios de impresión
    wrapper.classList.add('pdf-export-mode');
    restauraciones.push(() => wrapper.classList.remove('pdf-export-mode'));

    // 2. Verificar si hay bienes QR vinculados (0..N)
    const totalQR = window.ScannerManager ? window.ScannerManager.obtenerListaBienes().length : 0;
    const seccionAnexo = wrapper.querySelector('.anexo-qr-section');
    if (seccionAnexo && totalQR === 0) {
      seccionAnexo.classList.add('sin-bienes-qr');
    }

    // 3. Reemplazar temporalmente <textarea> por bloques <div> para evitar cortes
    wrapper.querySelectorAll('textarea').forEach((ta) => {
      const formPadre = ta.closest('.formato-oficial');
      if (formPadre && formPadre.classList.contains('hidden')) return;

      const clonDiv = document.createElement('div');
      clonDiv.style.minHeight = '34px';
      clonDiv.style.fontSize = '11px';
      clonDiv.style.lineHeight = '1.3';
      clonDiv.style.whiteSpace = 'pre-wrap';
      clonDiv.style.wordBreak = 'break-word';
      clonDiv.style.padding = '2px 4px';
      clonDiv.textContent = ta.value || ' ';

      ta.style.display = 'none';
      ta.parentNode.insertBefore(clonDiv, ta.nextSibling);

      restauraciones.push(() => {
        clonDiv.remove();
        ta.style.display = '';
      });
    });

    // 4. Asegurar que la firma digital se renderice como imagen Base64 limpia
    const canvasFirma = document.getElementById('canvas-firma');
    const imgFirmaGuardada = document.getElementById('img-firma-guardada');

    if (firmaDataUrl && canvasFirma) {
      const imgTemp = document.createElement('img');
      imgTemp.src = firmaDataUrl;
      imgTemp.style.maxWidth = '340px';
      imgTemp.style.maxHeight = '105px';
      imgTemp.style.display = 'block';
      imgTemp.style.borderBottom = '1px solid #000000';

      const prevCanvasDisplay = canvasFirma.style.display;
      const prevImgHidden = imgFirmaGuardada ? imgFirmaGuardada.classList.contains('hidden') : true;

      canvasFirma.style.display = 'none';
      if (imgFirmaGuardada) imgFirmaGuardada.classList.add('hidden');
      canvasFirma.parentNode.insertBefore(imgTemp, canvasFirma.nextSibling);

      restauraciones.push(() => {
        imgTemp.remove();
        canvasFirma.style.display = prevCanvasDisplay;
        if (imgFirmaGuardada && !prevImgHidden) {
          imgFirmaGuardada.classList.remove('hidden');
        }
      });
    }

    // 5. Evitar que imágenes externas no convertidas a Base64 contaminen el canvas
    wrapper.querySelectorAll('img').forEach((img) => {
      if (img.classList.contains('hidden')) return;
      const src = img.getAttribute('src') || '';
      if (src && !src.startsWith('data:image')) {
        const aviso = document.createElement('div');
        aviso.className = 'qr-sin-foto';
        aviso.textContent = 'Evidencia vinculada en Drive';

        const prevDisplay = img.style.display;
        img.style.display = 'none';
        img.parentNode.insertBefore(aviso, img.nextSibling);

        restauraciones.push(() => {
          aviso.remove();
          img.style.display = prevDisplay;
        });
      }
    });

    return () => {
      for (let i = restauraciones.length - 1; i >= 0; i--) {
        restauraciones[i]();
      }
    };
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

    const restaurarDOM = prepararVistaParaPdf(wrapper, firmaDataUrl);

    try {
      const opciones = {
        margin: [8, 8, 11, 8],
        filename: nombreArchivo,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          windowWidth: 820
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

      const worker = html2pdf().set(opciones).from(wrapper).toPdf();
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
      restaurarDOM();
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

  /**
   * Genera el PDF y normaliza su salida Base64 a "data:application/pdf;base64,..."
   */
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

  /**
   * Genera y descarga el PDF directamente en el dispositivo del usuario
   */
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
