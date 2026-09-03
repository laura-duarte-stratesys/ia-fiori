/* ============================================================
   VALIDACIÓN DE PARÁMETROS
============================================================ */

import {
    $,
    hide,
  } from '../utils/helpers.js';
  
  
  let parameterValidationConfig = {
    getHierarchyResult: null,
    setHierarchyResult: null,
    getPlanResult: null,
    setPlanResult: null,
  };
  
  
  export function configureParameterValidation(config = {}) {
    parameterValidationConfig = {
      ...parameterValidationConfig,
      ...config,
    };
  }
  
  
  /* ============================================================
     INICIALIZAR VALIDACIÓN DE PARÁMETROS
  ============================================================ */
  
  export function initParameterValidation() {
  
    /* ==========================================================
       JERARQUÍA
    ========================================================== */
  
    const hierarchyFields = [
      'f-id',
      'f-desc',
      'f-inicio',
      'f-fin',
      'f-coa',
    ];
  
    hierarchyFields.forEach((id) => {
  
      const element = $(id);
  
      element?.addEventListener('input', () => {
  
        const result =
          parameterValidationConfig.getHierarchyResult?.();
  
        if (result) {
  
          parameterValidationConfig.setHierarchyResult?.(
            null
          );
  
          hide($('step3'));
          hide($('step4'));
  
          $('btn-generate').disabled = false;
        }
  
      });
  
    });
  
  
    /* ==========================================================
       PLAN DE CUENTAS
    ========================================================== */
  
    const planFields = [
      'p-plan',
      'p-plan-desc',
      'p-version',
      'p-version-desc',
      'p-periodo',
      'p-idioma',
    ];
  
    planFields.forEach((id) => {
  
      const element = $(id);
  
      element?.addEventListener('input', () => {
  
        const result =
          parameterValidationConfig.getPlanResult?.();
  
        if (result) {
  
          parameterValidationConfig.setPlanResult?.(
            null
          );
  
          hide($('plan-step3'));
          hide($('plan-step4'));
  
          $('btn-plan-generate').disabled = true;
        }
  
      });
  
    });
  
  }