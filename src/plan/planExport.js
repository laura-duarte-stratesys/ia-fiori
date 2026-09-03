/* ============================================================
   EXPORTACIÓN — PLAN DE CUENTAS
============================================================ */
import 
{
    MEASURE_MAP,
    CONVERSION_MAP,
  } from '../config/constants.js';
import {
    $,
    normalize,
    normalizeKey,
  } from '../utils/helpers.js';
  
  import {
    getMeasure,
    getConversion,
  } from './planValidation.js';
  
  
  let planExportConfig = {
    getPlanResult: null,
    validatePlanParameters: null,
  };
  
  
  export function configurePlanExport(config = {}) {
    planExportConfig = {
      ...planExportConfig,
      ...config,
    };
  }
  
  
  /* ============================================================
     DESCRIPCIÓN DEL IDIOMA
  ============================================================ */
  
  export function getLanguageDescription(codigo) {
    const idiomas = {
      AF: 'Afrikáans',
      AR: 'Árabe',
      BG: 'Búlgaro',
      CA: 'Catalán',
      CS: 'Checo',
      DA: 'Danés',
      DE: 'Alemán',
      EL: 'Griego',
      EN: 'Inglés',
      ES: 'Español',
      ET: 'Estonio',
      FI: 'Finlandés',
      FR: 'Francés',
      HE: 'Hebreo',
      HI: 'Hindi',
      HR: 'Croata',
      HU: 'Húngaro',
      ID: 'Indonesio',
      IS: 'Islandés',
      IT: 'Italiano',
      JA: 'Japonés',
      KK: 'Kazajo',
      KO: 'Coreano',
      LT: 'Lituano',
      LV: 'Letón',
      MS: 'Malayo',
      NL: 'Neerlandés',
      NO: 'Noruego',
      PL: 'Polaco',
      PT: 'Portugués',
      RO: 'Rumano',
      RU: 'Ruso',
      SH: 'Serbio(,latino)',
      SK: 'Eslovaco',
      SL: 'Esloveno',
      SR: 'Serbio',
      SV: 'Sueco',
      TH: 'Tailandés',
      TR: 'Turco',
      UK: 'Ucraniano',
      VI: 'Vietnamita',
      Z1: 'Reservacliente',
      ZF: 'Chinotrad.',
      ZH: 'Chino',
    };
  
    return idiomas[normalizeKey(codigo)] || '';
  }
  
  
  /* ============================================================
     GENERAR DATOS FIORI — PLAN DE CUENTAS
  ============================================================ */
  
  export function buildPlanFioriData() {
    const PLAN_RESULT = planExportConfig.getPlanResult?.();
  
    if (!PLAN_RESULT) {
      throw new Error('No existe información procesada.');
    }
  
    /* ----------------------------------------------------------
       PARÁMETROS
    ---------------------------------------------------------- */
  
    const plan = normalize($('p-plan')?.value);
    const planDesc = normalize($('p-plan-desc')?.value);
  
    const version = normalize($('p-version')?.value);
    const versionDesc = normalize($('p-version-desc')?.value);
  
    const periodo = normalize($('p-periodo')?.value);
    const idioma = normalize($('p-idioma')?.value).toUpperCase();
  
    /* ----------------------------------------------------------
       DESCRIPCIÓN DEL IDIOMA
    ---------------------------------------------------------- */
  
    const descripcionIdioma = getLanguageDescription(idioma);
  
    if (!descripcionIdioma) {
      throw new Error(`El código de idioma "${idioma}" no es válido.`);
    }
  
    /* ----------------------------------------------------------
       AGRUPAR POR CUENTA DE GRUPO
    ---------------------------------------------------------- */
  
    const cuentasGrupo = new Map();
  
    (PLAN_RESULT.records || []).forEach((record) => {
      const cuentaGrupo = normalize(record.cuenta);
  
      if (!cuentaGrupo) {
        return;
      }
  
      if (!cuentasGrupo.has(cuentaGrupo)) {
        cuentasGrupo.set(cuentaGrupo, record);
      }
    });
  
    /* ----------------------------------------------------------
       GENERAR REGISTROS FIORI
    ---------------------------------------------------------- */
  
    return Array.from(cuentasGrupo.values()).map((record) => {
        const measure = getMeasure(record.acctype, MEASURE_MAP);
        const conversion = getConversion(record.acctype, CONVERSION_MAP);
  
      return {
        '*Plan de cuentas de consolidación (2)': `${plan} -- ${planDesc}`,
  
        '*Versión de consolidación (3)': `${version} -- ${versionDesc}`,
  
        '*Ejercicio y período contable efectivos (AAAA/PPP)': periodo,
  
        '*Idioma (2)': `${idioma} -- ${descripcionIdioma}`,
  
        '*Posición (10)': record.cuenta,
  
        'Descripción de posición (15)': String(
          record.descripcion || ''
        ).substring(0, 15),
  
        'Descripción media posición balance contable (50)': String(
          record.descripcion || ''
        ).substring(0, 50),
  
        'Descripción explicativa de pos.balance contable (250)': String(
          record.descripcion || ''
        ).substring(0, 250),
  
        '*Tipo de posición FS (10)': record.acctype,
  
        'Tipo de imputación (4)': measure
          ? `${measure.codigo} -- ${measure.detalle}`
          : '',
  
        'Bloqueado para contabilización (1)': '',
  
        'Es posición de consolidación (1)': '',
  
        'Arrastre de saldos (1)': '',
  
        'Título de enlace (255)': '',
  
        'URL enlace (1333)': '',
  
        'Rol de posición FS (30)': '',
  
        'Selección de colección de datos (30)': '',
  
        'Selección de conversión de moneda (30)': conversion
          ? `${conversion.codigo} -- ${conversion.detalle}`
          : '',
  
        'Selección de eliminación (30)': record.eliminacion || '',
  
        'Selección de flujo de caja (30)': '',
  
        'Selección de alcance (30)': '',
  
        'Otra selección (30)': '',
  
        'Destino de eliminación (10)': '',
  
        'Destino de participaciones de minorías (10)': '',
  
        'Destino de planificación (10)': '',
  
        'Destino de compensación (10)': '',
      };
    });
  }
  
  
  /* ============================================================
     GENERAR ARCHIVO FIORI — PLAN DE CUENTAS
  ============================================================ */
  
  export async function generatePlanFile() {
    const validatePlanParameters =
      planExportConfig.validatePlanParameters;
  
    if (!validatePlanParameters?.()) {
      return;
    }
  
    const PLAN_RESULT = planExportConfig.getPlanResult?.();
  
    if (!PLAN_RESULT) {
      alert('Primero debes procesar y validar el archivo.');
      return;
    }
  
    const errors = PLAN_RESULT.incidents.filter(
      (i) => i.severity === 'Error'
    );
  
    // if (errors.length) {
    //   alert(
    //     'No se puede generar el archivo porque existen errores de validación.'
    //   );
    //
    //   return;
    // }
  
    try {
      /* --------------------------------------------------------
         PARÁMETROS
      -------------------------------------------------------- */
  
      const BLUE_FILL = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8EA9DB' },
      };
  
      const plan = normalize($('p-plan')?.value);
      const planDesc = normalize($('p-plan-desc')?.value);
  
      const version = normalize($('p-version')?.value);
      const versionDesc = normalize($('p-version-desc')?.value);
  
      const periodo = normalize($('p-periodo')?.value);
      const idioma = normalize($('p-idioma')?.value).toUpperCase();
  
      const descripcionIdioma = getLanguageDescription(idioma);
  
      if (!descripcionIdioma) {
        throw new Error(`El código de idioma "${idioma}" no es válido.`);
      }
  
      /* --------------------------------------------------------
         CREAR WORKBOOK
      -------------------------------------------------------- */
  
      const workbook = new ExcelJS.Workbook();
  
      /* ========================================================
         HOJA POSICIÓN
      ======================================================== */
  
      const worksheet = workbook.addWorksheet('Posición');
  
      worksheet.getCell('A1').value = 'Posición';
  
      worksheet.getCell('A1').font = {
        name: 'Aptos Narrow',
        size: 22,
        bold: true,
        color: { argb: '000000' },
      };
  
      worksheet.getCell('A2').value = 'Valores de filtro obligatorios';
  
      worksheet.getCell('A2').font = {
        name: 'Aptos Narrow',
        size: 22,
        bold: true,
        color: { argb: '000000' },
      };
  
      worksheet.getCell('A3').value =
        'FINCS_S_MD_XLSX_HD_FSI_TVD';
  
      worksheet.getCell('A3').font = {
        name: 'Aptos Narrow',
        size: 11,
        color: { argb: '000000' },
      };
  
      worksheet.getRow(3).hidden = true;
  
      worksheet.getRow('4').values = [
        '*Plan de cuentas de consolidación (2)',
        '*Versión de consolidación (3)',
        '*Ejercicio y período contable efectivos (AAAA/PPP)',
        '*Idioma (2)',
      ];
  
      worksheet.getRow(4).eachCell((cell) => {
        cell.font = {
          name: 'Aptos Narrow',
          size: 11,
          bold: true,
        };
  
        cell.fill = BLUE_FILL;
      });
  
      worksheet.getRow('5').values = [
        'CONSOLIDATIONCHARTOFACCOUNTS+CONSOLIDATIONCHARTOFACCTSTEXT',
        'CONSOLIDATIONVERSION+CONSOLIDATIONVERSIONTEXT',
        'FISCALYEARPERIOD',
        'LANGUAGE+LANGUAGENAME',
      ];
  
      worksheet.getRow(5).eachCell((cell) => {
        cell.font = {
          name: 'Aptos Narrow',
          size: 11,
          bold: true,
        };
  
        cell.fill = BLUE_FILL;
      });
  
      worksheet.getRow(5).hidden = true;
  
      worksheet.getRow(6).values = [
        `${plan} -- ${planDesc}`,
        `${version} -- ${versionDesc}`,
        periodo,
        `${idioma} -- ${descripcionIdioma}`,
      ];
  
      worksheet.getCell('A7').value = 'Datos maestros';
  
      worksheet.getCell('A7').font = {
        name: 'Aptos Narrow',
        size: 22,
        bold: true,
        color: { argb: '000000' },
      };
  
      worksheet.getCell('A8').value =
        'FINCS_S_MD_XLSX_FSI_TVD';
  
      worksheet.getCell('A8').font = {
        name: 'Aptos Narrow',
        size: 11,
        color: { argb: '000000' },
      };
  
      worksheet.getRow(8).hidden = true;
  
      /* ========================================================
         FILAS 9 Y 10 — CABECERAS
      ======================================================== */
  
      const headers = [
        '*Posición (10)',
        'Descripción de posición (15)',
        'Descripción media posición balance contable (50)',
        'Descripción explicativa de pos.balance contable (250)',
        '*Tipo de posición FS (10)',
        'Tipo de imputación (4)',
        'Bloqueado para contabilización (1)',
        'Es posición de consolidación (1)',
        'Arrastre de saldos (1)',
        'Título de enlace (255)',
        'URL enlace (1333)',
        'Rol de posición FS (30)',
        'Selección de colección de datos (30)',
        'Selección de conversión de moneda (30)',
        'Selección de eliminación (30)',
        'Selección de flujo de caja (30)',
        'Selección de alcance (30)',
        'Otra selección (30)',
        'Destino de eliminación (10)',
        'Destino de participaciones de minorías (10)',
        'Destino de planificación (10)',
        'Destino de compensación (10)',
      ];
  
      worksheet.getRow('9').values = headers;
  
      worksheet.getRow(9).eachCell((cell) => {
        cell.font = {
          name: 'Aptos Narrow',
          size: 11,
          bold: true,
        };
  
        cell.fill = BLUE_FILL;
      });
  
      const technicalHeaders = [
        'FINANCIALSTATEMENTITEM',
        'FINANCIALSTATEMENTITEMTEXT',
        'FINANCIALSTATEMENTITEMMDMTEXT',
        'FINANCIALSTATEMENTITEMLONGTEXT',
        'FINANCIALSTATEMENTITEMTYPE+FINANCIALSTATEMENTITEMTYPETEXT',
        'BREAKDOWNCATEGORY+BREAKDOWNCATEGORYTEXT',
        'FINANCIALSTATEMENTITEMISBLKD+FSITEMISBLKDTEXT',
        'ISCONSOLIDATIONITEM+ISCONSOLIDATIONITEMTEXT',
        'NETBALANCEISCARRIEDFORWARD+NETBALANCEISCARRIEDFORWARDTEXT',
        'FSITEMLINKLABEL',
        'FSITEMLINK',
        'FINANCIALSTATEMENTITEMROLE+FSITEMROLESHORTTEXT',
        'FSITEMDATACOLLECTION+FSITEMDATACOLLECTIONSHORTTEXT',
        'FSITEMCURRENCYTRANSLATION+FSITEMCRCYTRNSLTNATTRIBSHRTTXT',
        'FSITEMELIMINATION+FSITEMELIMATTRIBUTESHORTTEXT',
        'FSITEMCASHFLOW+FSITEMCASHFLOWSHORTTEXT',
        'FSITEMSCOPE+FSITEMSCOPESHORTTEXT',
        'FSITEMCUSTOMERSPECIFIC+FSITEMCUSTOMERSPECIFICSHRTTEXT',
        'ELIMINATIONTARGETFSITEM',
        'NCITARGETFSITEM',
        'PLANNINGTARGETFSITEM',
        'CNSLDTNOFFSETTINGTARGETFSITEM',
      ];
  
      worksheet.getRow('10').values = technicalHeaders;
  
      worksheet.getRow(10).eachCell((cell) => {
        cell.font = {
          name: 'Aptos Narrow',
          size: 11,
          bold: true,
        };
  
        cell.fill = BLUE_FILL;
      });
  
      worksheet.getRow(10).hidden = true;
  
      /* ========================================================
         DATOS — DESDE FILA 11
      ======================================================== */
  
      const data = buildPlanFioriData();
  
      const dataRows = data.map((record) => [
        record['*Posición (10)'],
        record['Descripción de posición (15)'],
        record['Descripción media posición balance contable (50)'],
        record['Descripción explicativa de pos.balance contable (250)'],
        record['*Tipo de posición FS (10)'],
        record['Tipo de imputación (4)'],
        record['Bloqueado para contabilización (1)'],
        record['Es posición de consolidación (1)'],
        record['Arrastre de saldos (1)'],
        record['Título de enlace (255)'],
        record['URL enlace (1333)'],
        record['Rol de posición FS (30)'],
        record['Selección de colección de datos (30)'],
        record['Selección de conversión de moneda (30)'],
        record['Selección de eliminación (30)'],
        record['Selección de flujo de caja (30)'],
        record['Selección de alcance (30)'],
        record['Otra selección (30)'],
        record['Destino de eliminación (10)'],
        record['Destino de participaciones de minorías (10)'],
        record['Destino de planificación (10)'],
        record['Destino de compensación (10)'],
      ]);
  
      dataRows.forEach((rowData, index) => {
        worksheet.getRow(11 + index).values = rowData;
      });
  
      /* ========================================================
         ANCHO DE COLUMNAS
      ======================================================== */
  
      headers.forEach((header, index) => {
        const maxLength = Math.max(
          String(header ?? '').length,
          ...dataRows.map((row) =>
            String(row[index + 1] ?? '').length
          )
        );
  
        worksheet.getColumn(index + 1).width = Math.min(
          maxLength + 2,
          60
        );
      });
  
      /* ========================================================
         VALUEHELPDATA
      ======================================================== */
  
      const worksheetData =
        workbook.addWorksheet('valuehelpdata');
  
      const valueHelpHeaders = [
        'CONSOLIDATIONCHARTOFACCOUNTS',
        'CONSOLIDATIONVERSION',
        'LANGUAGE',
        'FINANCIALSTATEMENTITEMTYPE',
        'BREAKDOWNCATEGORY',
        'FINANCIALSTATEMENTITEMISBLKD',
        'ISCONSOLIDATIONITEM',
        'NETBALANCEISCARRIEDFORWARD',
        'FSITEMELIMINATION',
        'FSITEMCURRENCYTRANSLATION',
        'FSITEMDATACOLLECTION',
        'FSITEMCASHFLOW',
        'FSITEMSCOPE',
        'FSITEMCUSTOMERSPECIFIC',
        'FINANCIALSTATEMENTITEMROLE',
      ];
  
      worksheetData.getCell('A1').value =
        'valuehelpdata';
  
      worksheetData.getCell('A1').font = {
        name: 'Aptos Narrow',
        size: 22,
        bold: true,
        color: { argb: '000000' },
        fill: BLUE_FILL,
      };
  
      worksheetData.getRow('2').values =
        valueHelpHeaders;
  
      worksheetData.getRow(2).eachCell((cell) => {
        cell.font = {
          name: 'Aptos Narrow',
          size: 11,
          bold: true,
        };
  
        cell.fill = BLUE_FILL;
      });
  
      worksheetData.getCell('A3').value =
        `${plan} -- ${planDesc}`;
  
      worksheetData.getCell('B3').value =
        `${version} -- ${versionDesc}`;
  
      worksheetData.getCell('C3').value =
        `${idioma} -- ${descripcionIdioma}`;
  
      worksheetData.state = 'hidden';
  
      /* ========================================================
         NOMBRE ARCHIVO
      ======================================================== */
  
      const periodoFile = periodo.replace('/', '_');
  
      const filename =
        `Fiori_PlanCuentas_${plan}_${version}_${periodoFile}.xlsx`;
  
      /* ========================================================
         GENERAR ARCHIVO
      ======================================================== */
  
      const buffer = await workbook.xlsx.writeBuffer();
  
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
  
      const url = URL.createObjectURL(blob);
  
      const link = document.createElement('a');
  
      link.href = url;
      link.download = filename;
  
      document.body.appendChild(link);
      link.click();
  
      document.body.removeChild(link);
  
      URL.revokeObjectURL(url);
  
      document.getElementById(
        'plan-gen-status'
      ).textContent =
        `Archivo generado correctamente: ${filename}`;
    } catch (error) {
      console.error(error);
  
      alert(
        `No fue posible generar el archivo:\n${error.message}`
      );
    }
  }