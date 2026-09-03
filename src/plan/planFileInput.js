/* ============================================================
   FILE INPUT — PLAN DE CUENTAS
============================================================ */

import {
    $,
    setStatus,
    hide,
  } from '../utils/helpers.js';
  
  
  let planFileInputConfig = {
    setPlanCurrentFile: null,
    setPlanResult: null,
  };
  
  
  export function configurePlanFileInput(config = {}) {
    planFileInputConfig = {
      ...planFileInputConfig,
      ...config,
    };
  }
  
  
  /* ============================================================
     INICIALIZAR INPUT DE ARCHIVO
  ============================================================ */
  
  export function initPlanFileInput() {
    const input = $('plan-file-input');
  
    if (!input) {
      return;
    }
  
    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
  
      if (!file) {
        return;
      }
  
      planFileInputConfig.setPlanCurrentFile?.(file);
  
      planFileInputConfig.setPlanResult?.(null);
  
      hide($('plan-step3'));
      hide($('plan-step4'));
  
      $('btn-plan-process').disabled = false;
  
      setStatus(
        $('plan-file-status'),
        `Archivo seleccionado: ${file.name}`
      );
    });
  }