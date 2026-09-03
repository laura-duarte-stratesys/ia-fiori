import {
    $,
    normalize,
  } from '../utils/helpers.js';
  
  let exportConfig = {
    getResult: null,
  };
  
  export function configureHierarchyExport(config = {}) {
    exportConfig = {
      ...exportConfig,
      ...config,
    };
  }
  
  /* ============================================================
     DATOS FIORI — JERARQUÍA
  ============================================================ */
  
  export function buildHierarchyFioriData() {
    const RESULT = exportConfig.getResult?.();
  
    if (!RESULT) {
      throw new Error('No existe información procesada.');
    }
  
    const hierarchyId = normalize($('f-id')?.value);
    const hierarchyDescription = normalize($('f-desc')?.value);
    const validFrom = normalize($('f-inicio')?.value);
    const validTo = normalize($('f-fin')?.value);
    const coa = normalize($('f-coa')?.value);
  
    const header = {
      'ID Jerarquía': hierarchyId,
      'Descripción jerarquía': hierarchyDescription,
      'Inicio de validez': validFrom,
      'Fin de validez': validTo,
      'COA de consolidación': coa,
    };
  
    const data = RESULT.records.map((record) => ({
      ID: record.id,
      Descripción: record.descripcion,
      Padre: record.parentId,
      Nivel: record.level,
      Tipo: record.tipo,
    }));
  
    return {
      header,
      data,
    };
  }
  
  /* ============================================================
     JSON VALIDACIÓN FIORI
  ============================================================ */
  
  export function buildJson1(idJerarquia, descJerarquia) {
    return JSON.stringify({
      CLIENT: '',
      VER_ID: '',
      VER_PID: '',
      VER_STATUS: 'S',
      VER_VLDFM: '00000000',
      VER_VLDTO: '00000000',
      VER_MSG: '',
      VER_NBR: '',
      VER_IDX: '000000000000001',
      HIER_HID: idJerarquia,
      HIER_CATG: 'CS15',
      UPDATED_AT: null,
      UPDATED_BY: '',
      CREATED_AT: null,
      CREATED_BY: '',
      LOCKED_BY: '',
      LOCKED_AT: null,
      ALLOW_LEGACY_TCODE_USAGE: '',
      VER_SRC: '',
      MAINTENANCE_LANG: 'S',
      REF_UPDATED_AT: 0,
      CREATED_ON: '',
      CATEGORYTEXT:
        'Posición de cuenta de explotación de consolidación',
      HIER_DESC: descJerarquia,
      HRY_CLASS: '',
      STATUSTEXT: '',
      SIMULATE_REPORT_ID: '',
      ACTIVE_REPORT_ID: '',
      IS_UNASSIGNED_SHOW: '',
      IS_RANGE_SUPPORTED: '',
      HIDE_VALIDITY: '',
      ATTRIBUTEVALUES: '',
      LOCK_HIER_ATTR_EDIT: '',
      HIERARCHY_TAG: '',
      HIERARCHY_TAG_TEXT: '',
      HAS_REFERENCE_NODE: '',
      ISPRIVATE: '',
    });
  }
  
  export function buildJson2(planCuentas) {
    return JSON.stringify([
      {
        CLIENT: '',
        OBJ_ID: '',
        FLD_NAME: 'CONSOLIDATIONCHARTOFACCOUNTS',
        VAL_SIGN: 'S',
        VAL_LOW: planCuentas,
        VAL_HIGH: '',
        VER_ID: '',
        VAL_LOW_TEXT: 'Plan de cuentas consolidación',
        VAL_HIGH_TEXT: '',
        LANG: '',
      },
    ]);
  }
  
  /* ============================================================
     EXPORTAR EXCEL
  ============================================================ */
  
  export async function downloadWorkbook(
    data,
    filename,
    sheetName = 'Fiori'
  ) {
    const workbook = new ExcelJS.Workbook();
  
    const worksheet = workbook.addWorksheet('Jerarquía');
  
    // ========================================================
    // FILA 1 - TÍTULO
    // ========================================================
  
    worksheet.getCell('A1').value =
      'Posición de cuenta de explotación de consolidación';
  
    worksheet.getCell('A1').font = {
      name: 'Aptos Narrow',
      size: 11,
      bold: true,
      color: { argb: '000000' },
    };
  
    // ========================================================
    // INFORMACIÓN DE LA JERARQUÍA
    // ========================================================
  
    const fields = [
      ['ID de jerarquía:', 'ID Jerarquía'],
      ['Inicio de validez:', 'Inicio de validez'],
      ['Fin de validez:', 'Fin de validez'],
      ['COA de consolidación:', 'COA de consolidación'],
    ];
  
    fields.forEach(([label, key], index) => {
      const row = index + 2;
  
      worksheet.getCell(`A${row}`).value = label;
      worksheet.getCell(`B${row}`).value = data.header[key];
  
      worksheet.getRow(row).eachCell((cell) => {
        cell.font = {
          name: 'Aptos Narrow',
          size: 11,
        };
      });
    });
  
    const technicalHeaders = [
      'Posición de cuenta de explotación de consolidación',
      'Nivel',
      'Tipo',
      'ID',
      'Descripción',
      'ID principal',
      'Cambio de signo',
    ];
  
    worksheet.getRow('7').values = technicalHeaders;
  
    worksheet.getRow(7).eachCell((cell) => {
      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
        bold: true,
      };
  
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
      };
    });
  
    // ========================================================
    // ESCRIBIR DATOS DESDE FILA 8
    // ========================================================
  
    const hierarchyId =
      data.header['ID Jerarquía'];
  
    const hierarchyDescription =
      data.header['Descripción jerarquía'];
  
    worksheet.getCell('A8').value =
      `|-${hierarchyId} (${hierarchyDescription})`;
  
    data.data.forEach((record, index) => {
      const row = index + 8;
  
      worksheet.getCell(`C${row}`).value = record.Tipo;
      worksheet.getCell(`D${row}`).value = record.ID;
      worksheet.getCell(`E${row}`).value = record.Descripción;
      worksheet.getCell(`F${row}`).value = record.Padre;
    });
  
    // ========================================================
    // AJUSTAR ANCHO DE COLUMNAS
    // ========================================================
  
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
  
      column.eachCell({ includeEmpty: true }, (cell) => {
        const length = cell.value
          ? String(cell.value).length
          : 0;
  
        if (length > maxLength) {
          maxLength = length;
        }
      });
  
      column.width = maxLength + 2;
    });
  
    // ========================================================
    // HOJA OCULTA DE VALIDACIÓN
    // ========================================================
  
    const worksheetValidation =
      workbook.addWorksheet('Validation');
  
    const validationData = [
      [
        'Nodo',
        'Posición de cuenta de explotación de consolidación',
        'Raíz',
      ],
  
      [
        buildJson1(
          data.header['ID Jerarquía'],
          data.header['Descripción jerarquía']
        ),
        buildJson2(
          data.header['COA de consolidación']
        ),
      ],
  
      ['8'],
      ['F'],
      [],
      ['', '', 'E', 'S', 'G', 'SIGN', 'B', 'SIGN', ''],
      ['', '', '', '', '', '', '', 'SIGN', 'X'],
    ];
  
    validationData.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        worksheetValidation.getCell(
          rowIndex + 1,
          colIndex + 1
        ).value = value;
      });
    });
  
    worksheetValidation.state = 'hidden';
  
    // ========================================================
    // GENERAR ARCHIVO
    // ========================================================
  
    const buffer =
      await workbook.xlsx.writeBuffer();
  
    const blob = new Blob([buffer], {
      type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  
    const url =
      URL.createObjectURL(blob);
  
    const link =
      document.createElement('a');
  
    link.href = url;
    link.download = filename;
  
    document.body.appendChild(link);
  
    link.click();
  
    document.body.removeChild(link);
  
    URL.revokeObjectURL(url);
  
    const status = document.getElementById(
      'plan-gen-status'
    );
  
    if (status) {
      status.textContent =
        `Archivo generado correctamente: ${filename}`;
    }
  }
  /* ============================================================
   GENERAR ARCHIVO DE JERARQUÍA
============================================================ */

export function generateHierarchyFile() {
  const RESULT = exportConfig.getResult?.();

  if (!RESULT) {
    alert('Primero debes procesar y validar el archivo.');
    return;
  }

  try {
    const data = buildHierarchyFioriData();

    const hierarchyId =
      normalize($('f-id')?.value) || 'JERARQUIA';

    const filename =
      `Fiori_Jerarquia_${hierarchyId}.xlsx`;

    downloadWorkbook(
      data,
      filename,
      'Hierarchy'
    );

    $('gen-status').textContent =
      `Archivo generado correctamente: ${filename}`;

  } catch (error) {
    console.error(error);

    alert(
      `No fue posible generar el archivo:\n${error.message}`
    );
  }
}