import {
    normalize,
    normalizeKey,
  } from '../utils/helpers.js';
  
  import {
    findSheet,
    findColumn,
    limpiarId,
  } from '../utils/excel.js';
  
  /* ============================================================
     PARSER DE JERARQUÍA
  ============================================================ */
  
  export function parseHierarchyWorkbook(workbook) {
    const sheetName = findSheet(workbook, 'Input');
  
    if (!sheetName) {
      throw new Error('El archivo debe contener una hoja llamada "Input".');
    }
  
    const worksheet = workbook.Sheets[sheetName];
  
    /*
     * Primero intentamos leer como tabla con encabezados.
     */
  
    const rowsWithHeaders = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false,
    });
  
    let rows = [];
  
    /*
     * Si existen encabezados reconocibles,
     * utilizamos esos encabezados.
     */
  
    if (rowsWithHeaders.length > 0) {
      const first = rowsWithHeaders[0];
  
      const idColumn = findColumn(first, [
        'ID',
        'ID JERARQUIA',
        'ID NODO',
        'CODIGO',
        'CÓDIGO',
      ]);
  
      const descColumn = findColumn(first, [
        'DESCRIPCION',
        'DESCRIPCIÓN',
        'DESCRIPTION',
        'TEXTO',
        'NOMBRE',
      ]);
  
      if (idColumn && descColumn) {
        rows = rowsWithHeaders.map((row, index) => ({
          originalRow: index + 2,
          id: limpiarId(row[idColumn]),
          descripcion: normalize(row[descColumn]),
        }));
      }
    }
  
    /*
     * Compatibilidad con la estructura de VBA:
     *
     * B = ID
     * C = Descripción
     *
     * Sin encabezado.
     */
  
    if (rows.length === 0) {
      const raw = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false,
      });
  
      rows = raw.map((row, index) => {
        return {
          originalRow: index + 1,
          id: row[0] !== undefined ? limpiarId(row[0]) : '',
          descripcion: row[1] !== undefined ? String(row[1]).trim() : '',
        };
      });
    }
  
    // Ignorar filas completamente vacías
    rows = rows.filter(
      (row) => row.id !== '' || row.descripcion !== ''
    );
  
    if (rows.length === 0) {
      throw new Error('La hoja "Input" no contiene registros.');
    }
  
    return rows;
  }
  
  /* ============================================================
     PARSER DE CUENTAS
  ============================================================ */
  
  export function parseCuentasWorkbook(workbook) {
    const sheetName = findSheet(workbook, 'Cuentas');
  
    if (!sheetName) {
      return new Map();
    }
  
    const worksheet = workbook.Sheets[sheetName];
  
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false,
    });
  
    if (!rows.length) {
      return new Map();
    }
  
    const first = rows[0];
  
    const idColumn = findColumn(first, [
      'ID',
      'CUENTA',
      'CUENTA CONTABLE',
      'CODIGO',
      'CÓDIGO',
    ]);
  
    const descColumn = findColumn(first, [
      'DESCRIPCION',
      'DESCRIPCIÓN',
      'DESCRIPTION',
      'TEXTO',
    ]);
  
    if (!idColumn || !descColumn) {
      return new Map();
    }
  
    const map = new Map();
  
    rows.forEach((row) => {
      const id = normalizeKey(row[idColumn]);
      const description = normalize(row[descColumn]);
  
      if (id) {
        map.set(id, description);
      }
    });
  
    return map;
  }