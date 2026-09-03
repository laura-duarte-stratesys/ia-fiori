import {
    normalize,
    normalizeKey,
  } from './helpers.js';
  
  /* ============================================================
     LECTURA DE EXCEL
  ============================================================ */
  
  export async function readExcel(file) {
    if (!file) {
      throw new Error('No se recibió ningún archivo.');
    }
  
    const buffer = await file.arrayBuffer();
  
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
    });
  
    return workbook;
  }
  
  /* ============================================================
     BÚSQUEDA DE HOJAS
  ============================================================ */
  
  export function findSheet(workbook, sheetName) {
    const target = normalizeKey(sheetName);
  
    return workbook.SheetNames.find(
      (name) => normalizeKey(name) === target
    );
  }
  
  /* ============================================================
     CONVERSIÓN DE HOJA A FILAS
  ============================================================ */
  
  export function sheetToRows(workbook, sheetName, options = {}) {
    const realSheetName = findSheet(workbook, sheetName);
  
    if (!realSheetName) {
      throw new Error(`No se encontró la hoja "${sheetName}".`);
    }
  
    const worksheet = workbook.Sheets[realSheetName];
  
    return XLSX.utils.sheet_to_json(worksheet, {
      defval: options.defval ?? '',
      raw: false,
      header: options.header,
    });
  }
  
  /* ============================================================
     DETECCIÓN FLEXIBLE DE COLUMNAS
  ============================================================ */
  
  export function findColumn(row, candidates) {
    const keys = Object.keys(row);
  
    const normalizedKeys = keys.map((key) => ({
      original: key,
      normalized: normalizeKey(key),
    }));
  
    for (const candidate of candidates) {
      const c = normalizeKey(candidate);
  
      const found = normalizedKeys.find(
        (item) =>
          item.normalized === c ||
          item.normalized.includes(c)
      );
  
      if (found) {
        return found.original;
      }
    }
  
    return null;
  }
  
  /* ============================================================
     LIMPIEZA DE ID
  ============================================================ */
  
  export function limpiarId(id) {
    return String(id ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '');
  }