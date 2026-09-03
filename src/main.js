import './style.css';

import {
  $
} from './utils/helpers.js';


import {
  processHierarchy,
  calculateLevels,
} from './hierarchy/hierarchyProcessor.js';

import {
  configureHierarchyTree,
  buildHierarchyTreeMap,
  renderHierarchyTree,
  expandHierarchyTree,
  collapseHierarchyTree,
} from './hierarchy/hierarchyTree.js';

import {
  configureHierarchyValidation,
  refreshHierarchyIncidents,
  buildSummary,
  renderSummary,
} from './hierarchy/hierarchyValidation.js';

import {
  suggestWithAI,
  applyAISuggestions,
  configureHierarchyAI,
} from './hierarchy/hierarchyAI.js';


import {
  configureHierarchyExport,
  generateHierarchyFile,
} from './hierarchy/hierarchyExport.js';

import {
  configureHierarchyWorkflow,
  processHierarchyFile,
} from './hierarchy/hierarchyWorkflow.js';

import {
  configureHierarchyFileInput,
  initHierarchyFileInput,
  initDropzone,
} from './hierarchy/hierarchyFileInput.js';

import {
  initModes,
} from './ui/modeSwitcher.js';

import {
  configureParameterValidation,
  initParameterValidation,
} from './ui/parameterValidation.js';

import {
  configurePlanValidation,
} from './plan/planValidation.js';

import {
  configurePlanAI,
  analyzePlanWithAI,
} from './plan/planAI.js';

import {
  configurePlanExport,
  generatePlanFile,
} from './plan/planExport.js';

import {
  configurePlanWorkflow,
  processPlanFile,
  validatePlanParameters,
} from './plan/planWorkflow.js';

import {
  configurePlanFileInput,
  initPlanFileInput,
} from './plan/planFileInput.js';

import {
  configureReset,
  resetHierarchy,
  resetPlan,
} from './ui/reset.js';
import {
  getPlanResult,
  setPlanResult,
  setPlanRawData,
  getPlanCurrentFile,
  setPlanCurrentFile,
} from './plan/planState.js';

import {
  getRawData,
  setRawData,
  getCuentasMap,
  setCuentasMap,
  getCurrentFile,
  setCurrentFile,
} from './hierarchy/hierarchyState.js';

let RESULT = null;




configureHierarchyTree({
  getResult: () => RESULT,
  calculateLevels: calculateLevels,
  refreshHierarchyIncidents: refreshHierarchyIncidents,
  buildSummary: buildSummary,
  renderSummary: renderSummary,
});

configureHierarchyValidation({
  getResult: () => RESULT,
  renderHierarchyTree: renderHierarchyTree,
  collapseHierarchyTree: collapseHierarchyTree,
});

configureHierarchyAI({
  getResult: () => RESULT,
  refreshHierarchyIncidents: refreshHierarchyIncidents,
  renderHierarchyTree: renderHierarchyTree,
  buildHierarchyTreeMap: buildHierarchyTreeMap,
});

configureHierarchyExport({
  getResult: () => RESULT,
});

configureHierarchyWorkflow({
  getCurrentFile,
  setRawData,
  setCuentasMap,
  setResult: (result) => {
    RESULT = result;
  },
});

configureHierarchyFileInput({
  setCurrentFile,
  setResult: (result) => {
    RESULT = result;
  },
});

configurePlanValidation({
  getPlanResult,
});

configurePlanAI({
  getPlanResult,
  setPlanResult,
  setPlanRawData,
});

configurePlanExport({
  getPlanResult: () => PLAN_RESULT,
  validatePlanParameters: validatePlanParameters,
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

configureParameterValidation({
  getHierarchyResult: () => RESULT,

  setHierarchyResult: (result) => {
    RESULT = result;
  },

  getPlanResult,

  setPlanResult,
});

configureReset({
  setRawData,
  setCuentasMap,
  setCurrentFile,
});




/* ============================================================
   INICIALIZACIÓN
============================================================ */

function init() {
  /* Modos */
  initModes();

  /* Inputs */
  initHierarchyFileInput();
  initPlanFileInput();

  /* Drag & drop */
  initDropzone('file-input');
  initDropzone('plan-file-input');

  /* Botón jerarquía */
  $('btn-process')?.addEventListener('click', processHierarchyFile);

  $('btn-generate')?.addEventListener('click', generateHierarchyFile);
  $('btn-expand-all')?.addEventListener('click', expandHierarchyTree);

  $('btn-collapse-all')?.addEventListener('click', collapseHierarchyTree);

  $('btn-ai-jerarquia')?.addEventListener('click', suggestWithAI);

  /* Botón plan */
  $('btn-plan-process')?.addEventListener('click', processPlanFile);

  $('btn-plan-generate')?.addEventListener('click', generatePlanFile);

  $('btn-ai-plan')?.addEventListener('click', analyzePlanWithAI);

  /* Validaciones */
  initParameterValidation();
}

/* ============================================================
   START
============================================================ */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

document.getElementById('btn-apply-ai')?.addEventListener('click', () => {
  const cambiosAplicados = applyAISuggestions();

  const statusLine = document.getElementById('status-line');

  if (cambiosAplicados > 0) {
    statusLine.textContent = `Se aplicaron ${cambiosAplicados} cambios propuestos por la IA.`;

    statusLine.classList.add('success');
  } else {
    statusLine.textContent = 'No había cambios de la IA para aplicar.';
  }

  // Ocultar botón después de aplicar
  document.getElementById('btn-apply-ai').style.display = 'none';
});
