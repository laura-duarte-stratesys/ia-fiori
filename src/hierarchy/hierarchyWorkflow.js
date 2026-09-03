import {
    $,
    normalize,
    setStatus,
    hide,
    scrollToElement,
  } from '../utils/helpers.js';
  
  import {
    readExcel,
  } from '../utils/excel.js';
  
  import {
    parseHierarchyWorkbook,
    parseCuentasWorkbook,
  } from './hierarchyParser.js';
  
  import {
    processHierarchy,
  } from './hierarchyProcessor.js';
  
  import {
    updateHierarchyValidationUI,
  } from './hierarchyValidation.js';
  
  let workflowConfig = {
    getCurrentFile: null,
    setRawData: null,
    setCuentasMap: null,
    setResult: null,
  };
  
  export function configureHierarchyWorkflow(config = {}) {
    workflowConfig = {
      ...workflowConfig,
      ...config,
    };
  }
  
  /* ============================================================
     VALIDAR PARÁMETROS JERARQUÍA
  ============================================================ */
  
  export function validateHierarchyParameters() {
    const hierarchyId = normalize($('f-id')?.value);
  
    const description = normalize($('f-desc')?.value);
  
    const validFrom = normalize($('f-inicio')?.value);
  
    const validTo = normalize($('f-fin')?.value);
  
    const coa = normalize($('f-coa')?.value);
  
    if (!hierarchyId) {
      alert('Ingresa el ID de la jerarquía.');
      $('f-id')?.focus();
      return false;
    }
  
    if (!description) {
      alert('Ingresa la descripción de la jerarquía.');
      $('f-desc')?.focus();
      return false;
    }
  
    if (!validFrom) {
      alert('Ingresa el inicio de validez.');
      $('f-inicio')?.focus();
      return false;
    }
  
    if (!validTo) {
      alert('Ingresa el fin de validez.');
      $('f-fin')?.focus();
      return false;
    }
  
    if (!coa) {
      alert('Ingresa el COA de consolidación.');
      $('f-coa')?.focus();
      return false;
    }
  
    return true;
  }
  
  /* ============================================================
     EVENTO PROCESAR JERARQUÍA
  ============================================================ */
  
  export async function processHierarchyFile() {
    if (!validateHierarchyParameters()) {
      return;
    }
  
    const CURRENT_FILE =
      workflowConfig.getCurrentFile?.();
  
    if (!CURRENT_FILE) {
      alert('Selecciona primero un archivo Excel.');
      return;
    }
  
    const button = $('btn-process');
  
    button.disabled = true;
  
    setStatus(
      $('file-status'),
      'Procesando archivo...'
    );
  
    try {
      const workbook =
        await readExcel(CURRENT_FILE);
  
      const rows =
        parseHierarchyWorkbook(workbook);
  
      const cuentas =
        parseCuentasWorkbook(workbook);
  
      workflowConfig.setRawData?.(rows);
  
      workflowConfig.setCuentasMap?.(cuentas);
  
      const hierarchyId =
        normalize($('f-id')?.value);
  
      const hierarchyDesc =
        normalize($('f-desc')?.value);
  
      const result =
        processHierarchy(
          rows,
          cuentas,
          hierarchyId,
          hierarchyDesc
        );
  
      workflowConfig.setResult?.(result);
  
      updateHierarchyValidationUI(result);
  
      setStatus(
        $('file-status'),
        `${rows.length} registros procesados correctamente.`,
        'success'
      );
  
      scrollToElement($('step3'));
    } catch (error) {
      console.error(error);
  
      workflowConfig.setResult?.(null);
  
      hide($('step3'));
      hide($('step4'));
  
      setStatus(
        $('file-status'),
        error.message,
        'error'
      );
  
      alert(
        `No fue posible procesar el archivo:\n\n${error.message}`
      );
    } finally {
      button.disabled = false;
    }
  }