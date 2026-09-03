/* ============================================================
   INICIALIZACIÓN DE LA APLICACIÓN
============================================================ */

import {
    $,
  } from '../utils/helpers.js';
  
  import {
    initHierarchyFileInput,
    initDropzone,
  } from '../hierarchy/hierarchyFileInput.js';
  
  import {
    initPlanFileInput,
  } from '../plan/planFileInput.js';
  
  import {
    initModes,
  } from '../ui/modeSwitcher.js';
  
  import {
    processHierarchyFile,
  } from '../hierarchy/hierarchyWorkflow.js';
  
  import {
    generateHierarchyFile,
  } from '../hierarchy/hierarchyExport.js';
  
  import {
    expandHierarchyTree,
    collapseHierarchyTree,
  } from '../hierarchy/hierarchyTree.js';
  
  import {
    suggestWithAI,
  } from '../hierarchy/hierarchyAI.js';
  
  import {
    processPlanFile,
  } from '../plan/planWorkflow.js';
  
  import {
    generatePlanFile,
  } from '../plan/planExport.js';
  
  import {
    analyzePlanWithAI,
  } from '../plan/planAI.js';
  
  import {
    initParameterValidation,
  } from '../ui/parameterValidation.js';
  
  
  /* ============================================================
     INICIALIZAR APLICACIÓN
  ============================================================ */
  
  export function initApp() {
  
    /* Modos */
    initModes();
  
  
    /* Inputs */
    initHierarchyFileInput();
    initPlanFileInput();
  
  
    /* Drag & drop */
    initDropzone('file-input');
    initDropzone('plan-file-input');
  
  
    /* ==========================================================
       BOTONES — JERARQUÍA
    ========================================================== */
  
    $('btn-process')?.addEventListener(
      'click',
      processHierarchyFile
    );
  
    $('btn-generate')?.addEventListener(
      'click',
      generateHierarchyFile
    );
  
    $('btn-expand-all')?.addEventListener(
      'click',
      expandHierarchyTree
    );
  
    $('btn-collapse-all')?.addEventListener(
      'click',
      collapseHierarchyTree
    );
  
    $('btn-ai-jerarquia')?.addEventListener(
      'click',
      suggestWithAI
    );
  
  
    /* ==========================================================
       BOTONES — PLAN DE CUENTAS
    ========================================================== */
  
    $('btn-plan-process')?.addEventListener(
      'click',
      processPlanFile
    );
  
    $('btn-plan-generate')?.addEventListener(
      'click',
      generatePlanFile
    );
  
    $('btn-ai-plan')?.addEventListener(
      'click',
      analyzePlanWithAI
    );
  
  
    /* ==========================================================
       VALIDACIONES
    ========================================================== */
  
    initParameterValidation();
  }