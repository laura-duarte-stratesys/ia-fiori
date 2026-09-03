/* ============================================================
   CONFIGURACIÓN DE MÓDULOS
============================================================ */

import {
    configureHierarchyTree,
  } from '../hierarchy/hierarchyTree.js';
  
  import {
    configureHierarchyValidation,
  } from '../hierarchy/hierarchyValidation.js';
  
  import {
    configureHierarchyAI,
  } from '../hierarchy/hierarchyAI.js';
  
  import {
    configureHierarchyExport,
  } from '../hierarchy/hierarchyExport.js';
  
  import {
    configureHierarchyWorkflow,
  } from '../hierarchy/hierarchyWorkflow.js';
  
  import {
    configureHierarchyFileInput,
  } from '../hierarchy/hierarchyFileInput.js';
  
  import {
    configurePlanValidation,
  } from '../plan/planValidation.js';
  
  import {
    configurePlanAI,
  } from '../plan/planAI.js';
  
  import {
    configurePlanExport,
  } from '../plan/planExport.js';
  
  import {
    configurePlanWorkflow,
  } from '../plan/planWorkflow.js';
  
  import {
    configurePlanFileInput,
  } from '../plan/planFileInput.js';
  
  import {
    configureParameterValidation,
  } from '../ui/parameterValidation.js';
  
  
  /* ============================================================
     CONFIGURAR APLICACIÓN
  ============================================================ */
  
  export function configureApp({
    getResult,
    setResult,
    calculateLevels,
    refreshHierarchyIncidents,
    buildSummary,
    renderSummary,
    renderHierarchyTree,
    collapseHierarchyTree,
    buildHierarchyTreeMap,
    getCurrentFile,
    setRawData,
    setCuentasMap,
    setCurrentFile,
  
    getPlanResult,
    setPlanResult,
    setPlanRawData,
    getPlanCurrentFile,
    setPlanCurrentFile,
    validatePlanParameters,
  }) {
  
    /* ==========================================================
       JERARQUÍA
    ========================================================== */
  
    configureHierarchyTree({
      getResult,
      calculateLevels,
      refreshHierarchyIncidents,
      buildSummary,
      renderSummary,
    });
  
    configureHierarchyValidation({
      getResult,
      renderHierarchyTree,
      collapseHierarchyTree,
    });
  
    configureHierarchyAI({
      getResult,
      refreshHierarchyIncidents,
      renderHierarchyTree,
      buildHierarchyTreeMap,
    });
  
    configureHierarchyExport({
      getResult,
    });
  
    configureHierarchyWorkflow({
      getCurrentFile,
      setRawData,
      setCuentasMap,
      setResult,
    });
  
    configureHierarchyFileInput({
      setCurrentFile,
      setResult,
    });
  
  
    /* ==========================================================
       PLAN DE CUENTAS
    ========================================================== */
  
    configurePlanValidation({
      getPlanResult,
    });
  
    configurePlanAI({
      getPlanResult,
      setPlanResult,
      setPlanRawData,
    });
  
    configurePlanExport({
      getPlanResult,
      validatePlanParameters,
    });
  
    configurePlanWorkflow({
      getPlanCurrentFile,
      getPlanResult,
      setPlanResult,
      setPlanRawData,
    });
  
    configurePlanFileInput({
      setPlanCurrentFile,
      setPlanResult,
    });
  
  
    /* ==========================================================
       VALIDACIÓN DE PARÁMETROS
    ========================================================== */
  
    configureParameterValidation({
      getHierarchyResult: getResult,
      setHierarchyResult: setResult,
      getPlanResult,
      setPlanResult,
    });
  }