/* ============================================================
   RESET — JERARQUÍA Y PLAN DE CUENTAS
============================================================ */

import {
    $,
    setStatus,
    hide,
  } from '../utils/helpers.js';
  
  import {
    resetPlanState,
  } from '../plan/planState.js';
  
  import {
    resetHierarchyState,
  } from '../hierarchy/hierarchyState.js';
  
  
  /* ============================================================
     RESET JERARQUÍA
  ============================================================ */
  
  export function resetHierarchy() {
  
    resetHierarchyState();
  
    $('file-input').value = '';
  
    setStatus(
      $('file-status'),
      ''
    );
  
    hide($('step3'));
    hide($('step4'));
  
    $('btn-process').disabled = true;
  
    $('btn-generate').disabled = false;
  
    $('summary-bar').innerHTML = '';
  
    $('incidencias-table').innerHTML = '';
  
    $('ai-result-jerarquia').innerHTML = '';
  
    $('ai-status').textContent = 'Listo';
  
    $('ai-status').classList.remove('ready');
  }
  
  
  /* ============================================================
     RESET PLAN
  ============================================================ */
  
  export function resetPlan() {
  
    resetPlanState();
  
    $('plan-file-input').value = '';
  
    setStatus(
      $('plan-file-status'),
      ''
    );
  
    hide($('plan-step3'));
    hide($('plan-step4'));
  
    $('btn-plan-process').disabled = true;
  
    $('btn-plan-generate').disabled = true;
  
    $('plan-summary-bar').innerHTML = '';
  
    $('plan-incidencias-table').innerHTML = '';
  
    $('ai-result-plan').innerHTML = '';
  
    $('ai-status-plan').textContent = 'Listo';
  
    $('ai-status-plan').classList.remove('ready');
  }