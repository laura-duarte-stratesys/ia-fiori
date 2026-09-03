/* ============================================================
   ESTADO — JERARQUÍA
============================================================ */

let RAW_DATA = [];
let CUENTAS_MAP = new Map();
let CURRENT_FILE = null;
let RESULT = null;


/* ============================================================
   RAW DATA
============================================================ */

export function getRawData() {
  return RAW_DATA;
}

export function setRawData(data) {
  RAW_DATA = data;
}


/* ============================================================
   CUENTAS MAP
============================================================ */

export function getCuentasMap() {
  return CUENTAS_MAP;
}

export function setCuentasMap(map) {
  CUENTAS_MAP = map;
}


/* ============================================================
   CURRENT FILE
============================================================ */

export function getCurrentFile() {
  return CURRENT_FILE;
}

export function setCurrentFile(file) {
  CURRENT_FILE = file;
}


/* ============================================================
   RESET
============================================================ */

export function resetHierarchyState() {
  RAW_DATA = [];
  CUENTAS_MAP = new Map();
  CURRENT_FILE = null;
  RESULT = null;
}

/* ============================================================
   RESULTADO
============================================================ */

export function getResult() {
    return RESULT;
  }
  
  export function setResult(result) {
    RESULT = result;
  }