/* ============================================================
   PARSER — PLAN DE CUENTAS
============================================================ */

import {
    normalize,
  } from '../utils/helpers.js';
  
  import {
    findSheet,
    findColumn,
  } from '../utils/excel.js';
  
  import {
    normalizeAcctype,
  } from './planValidation.js';
  
  
  /* ============================================================
     PARSEAR PLAN DE CUENTAS
  ============================================================ */
  
  export function parsePlanWorkbook(workbook) {
    const sheetName = findSheet(workbook, 'Input');
  
    if (!sheetName) {
      throw new Error(
        'El archivo debe contener una hoja llamada "Input".'
      );
    }
  
    const worksheet = workbook.Sheets[sheetName];
  
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false,
    });
  
    if (!rows.length) {
      throw new Error(
        'La hoja "Input" está vacía.'
      );
    }
  
    /*
     * El archivo de entrada SIEMPRE tiene encabezados
     * en la fila 1.
     *
     * Los datos comienzan en la fila 2.
     */
  
    const first = rows[0];
  
    const columns = {
      cuentaLocal: findColumn(
        first,
        ['CUENTA LOCAL']
      ),
  
      cuenta: findColumn(
        first,
        ['CTA. GRUPO', 'CTA GRUPO']
      ),
  
      descripcion: findColumn(
        first,
        [
          'DESCRIPTION',
          'DESCRIPCION',
          'DESCRIPCIÓN',
        ]
      ),
  
      acctype: findColumn(
        first,
        ['ACCTYPE']
      ),
  
      typelim: findColumn(
        first,
        ['TYPELIM']
      ),
  
      conversion: findColumn(
        first,
        ['CONVERSION']
      ),
    };
  
    /*
     * Validar estructura del archivo.
     */
  
    if (!columns.cuentaLocal) {
      throw new Error(
        'No se encontró la columna "CUENTA LOCAL" en la hoja "Input".'
      );
    }
  
    if (!columns.cuenta) {
      throw new Error(
        'No se encontró la columna "CTA. GRUPO" en la hoja "Input".'
      );
    }
  
    if (!columns.descripcion) {
      throw new Error(
        'No se encontró la columna "DESCRIPTION" en la hoja "Input".'
      );
    }
  
    if (!columns.acctype) {
      throw new Error(
        'No se encontró la columna "ACCTYPE" en la hoja "Input".'
      );
    }
  
    if (!columns.typelim) {
      throw new Error(
        'No se encontró la columna "TYPELIM" en la hoja "Input".'
      );
    }
  
    if (!columns.conversion) {
      throw new Error(
        'No se encontró la columna "CONVERSION" en la hoja "Input".'
      );
    }
  
    /*
     * Los datos comienzan después del encabezado.
     *
     * sheet_to_json ya excluye automáticamente la fila 1.
     * Por eso originalRow = index + 2.
     */
  
    return rows.map((row, index) => {
      return {
        originalRow: index + 2,
  
        cuentaLocal: normalize(
          row[columns.cuentaLocal]
        ),
  
        cuenta: normalize(
          row[columns.cuenta]
        ),
  
        descripcion: normalize(
          row[columns.descripcion]
        ),
  
        acctype: normalizeAcctype(
          row[columns.acctype]
        ),
  
        typelim: normalize(
          row[columns.typelim]
        ),
  
        conversion: normalize(
          row[columns.conversion]
        ),
      };
    });
  }