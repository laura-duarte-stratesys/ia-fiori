/* ============================================================
   ESTADO — PLAN DE CUENTAS
============================================================ */

let PLAN_RAW_DATA = [];
let PLAN_RESULT = null;
let PLAN_CURRENT_FILE = null;


/* ============================================================
   PLAN RAW DATA
============================================================ */

export function getPlanRawData() {
  return PLAN_RAW_DATA;
}

export function setPlanRawData(data) {
  PLAN_RAW_DATA = data;
}


/* ============================================================
   PLAN RESULT
============================================================ */

export function getPlanResult() {
  return PLAN_RESULT;
}

export function setPlanResult(result) {
  PLAN_RESULT = result;
}


/* ============================================================
   PLAN CURRENT FILE
============================================================ */

export function getPlanCurrentFile() {
  return PLAN_CURRENT_FILE;
}

export function setPlanCurrentFile(file) {
  PLAN_CURRENT_FILE = file;
}


/* ============================================================
   RESET
============================================================ */

export function resetPlanState() {
  PLAN_RAW_DATA = [];
  PLAN_RESULT = null;
  PLAN_CURRENT_FILE = null;
}