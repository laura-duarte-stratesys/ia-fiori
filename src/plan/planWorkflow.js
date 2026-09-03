/* ============================================================
   WORKFLOW — PLAN DE CUENTAS
============================================================ */

import {
    $,
    normalize,
    setStatus,
    show,
    hide,
    scrollToElement,
  } from '../utils/helpers.js';
  
  import {
    parsePlanWorkbook,
  } from './planParser.js';
  
  import {
    processPlan,
    buildPlanSummary,
    renderPlanSummary,
    renderPlanIncidents,
    eliminarDuplicadosExactosDePlan,
  } from './planValidation.js';
  
  import {
    readExcel,
  } from '../utils/excel.js';
  let planWorkflowConfig = {
    getPlanCurrentFile: null,
    setPlanResult: null,
    getPlanResult: null,
    setPlanRawData: null,
  };
  
  
  export function configurePlanWorkflow(config = {}) {
    planWorkflowConfig = {
      ...planWorkflowConfig,
      ...config,
    };
  }
  
  
  /* ============================================================
     VALIDAR PARÁMETROS PLAN
  ============================================================ */
  
  export function validatePlanParameters() {
    const plan = normalize($('p-plan')?.value);
  
    const planDesc = normalize($('p-plan-desc')?.value);
  
    const version = normalize($('p-version')?.value);
  
    const versionDesc = normalize($('p-version-desc')?.value);
  
    const periodo = normalize($('p-periodo')?.value);
  
    const idioma = normalize($('p-idioma')?.value);
  
    if (!plan) {
      alert('Ingresa el plan de cuentas.');
  
      $('p-plan')?.focus();
  
      return false;
    }
  
    if (!planDesc) {
      alert('Ingresa la descripción del plan de cuentas.');
  
      $('p-plan-desc')?.focus();
  
      return false;
    }
  
    if (!version) {
      alert('Ingresa la versión de consolidación.');
  
      $('p-version')?.focus();
  
      return false;
    }
  
    if (!versionDesc) {
      alert('Ingresa la descripción de la versión.');
  
      $('p-version-desc')?.focus();
  
      return false;
    }
  
    if (!periodo) {
      alert('Ingresa el ejercicio y período.');
  
      $('p-periodo')?.focus();
  
      return false;
    }
  
    if (!/^\d{4}\/\d{3}$/.test(periodo)) {
      alert(
        'El ejercicio/período debe tener el formato YYYY/MMM. Ejemplo: 2026/006.'
      );
  
      $('p-periodo')?.focus();
  
      return false;
    }
  
    if (!idioma) {
      alert('Selecciona un idioma.');
  
      $('p-idioma')?.focus();
  
      return false;
    }
  
    return true;
  }
  
  
  /* ============================================================
     PROCESAR ARCHIVO PLAN
  ============================================================ */
  
  export async function processPlanFile() {
    const PLAN_CURRENT_FILE =
      planWorkflowConfig.getPlanCurrentFile?.();
  
    if (!PLAN_CURRENT_FILE) {
      alert('Selecciona primero un archivo Excel.');
      return;
    }
  
    const button = $('btn-plan-process');
  
    button.disabled = false;
  
    setStatus(
      $('plan-file-status'),
      'Procesando archivo...'
    );
  
    try {
      /* ========================================================
         1. LEER EXCEL
      ======================================================== */
  
      const workbook = await readExcel(
        PLAN_CURRENT_FILE
      );
  
      /* ========================================================
         2. PARSEAR REGISTROS
      ======================================================== */
  
      const rows = parsePlanWorkbook(workbook);
  
      if (!rows.length) {
        throw new Error(
          'No existen registros para procesar.'
        );
      }
  
      /* ========================================================
         3. VALIDACIÓN INICIAL
      ======================================================== */
  
      let planResult = processPlan(rows);
  
      planWorkflowConfig.setPlanResult(planResult);
  
      /* ========================================================
         4. ELIMINAR DUPLICADOS EXACTOS
      ======================================================== */
  
      const duplicadosEliminados =
        eliminarDuplicadosExactosDePlan();
  
      /* ========================================================
         5. GUARDAR DATOS LIMPIOS
      ======================================================== */
  
      planResult =
        planWorkflowConfig.getPlanResult?.();
  
      const planRawData =
        planResult?.records || [];
  
      planWorkflowConfig.setPlanRawData(
        planRawData
      );
  
      /* ========================================================
         6. REVALIDAR DESPUÉS DE LA LIMPIEZA
      ======================================================== */
  
      planResult = processPlan(planRawData);
  
      planWorkflowConfig.setPlanResult(
        planResult
      );
  
      /* ========================================================
         7. RESUMEN
      ======================================================== */
  
      const summary =
        buildPlanSummary(planResult);
  
      renderPlanSummary(summary);
  
      /* ========================================================
         8. INCIDENCIAS
      ======================================================== */
  
      renderPlanIncidents(
        planResult.incidents
      );
  
      /* ========================================================
         9. ERRORES
      ======================================================== */
  
      const hasErrors =
        planResult.incidents.some(
          (incident) =>
            incident.severity === 'Error'
        );
  
      $('plan-gen-status').textContent =
        hasErrors
          ? 'Corrige las incidencias antes de generar el archivo.'
          : 'Validación completada. El archivo está listo para generar.';
  
      /* ========================================================
         10. MOSTRAR PASOS
      ======================================================== */
  
      show($('plan-step3'));
      show($('plan-step4'));
  
      /* ========================================================
         11. MENSAJE FINAL
      ======================================================== */
  
      let mensaje =
        `${planResult.records.length} registros procesados correctamente.`;
  
      if (duplicadosEliminados > 0) {
        mensaje +=
          ` Se eliminaron automáticamente ` +
          `${duplicadosEliminados} ` +
          `duplicado(s) exacto(s).`;
      }
  
      setStatus(
        $('plan-file-status'),
        mensaje,
        'success'
      );
  
      /* ========================================================
         12. SCROLL
      ======================================================== */
  
      scrollToElement(
        $('plan-step3')
      );
  
    } catch (error) {
      console.error(
        'Error al procesar el plan:',
        error
      );
  
      planWorkflowConfig.setPlanResult(null);
      planWorkflowConfig.setPlanRawData([]);
  
      hide($('plan-step3'));
      hide($('plan-step4'));
  
      setStatus(
        $('plan-file-status'),
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