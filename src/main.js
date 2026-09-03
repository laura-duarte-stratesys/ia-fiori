import './style.css';

import {
  $,
} from './utils/helpers.js';

import {
  configureApp,
} from './app/configure.js';

import {
  initApp,
} from './app/init.js';

import {
  initAIActions,
} from './app/aiActions.js';

import {
  calculateLevels,
} from './hierarchy/hierarchyProcessor.js';

import {
  buildHierarchyTreeMap,
  renderHierarchyTree,
  collapseHierarchyTree,
} from './hierarchy/hierarchyTree.js';

import {
  refreshHierarchyIncidents,
  buildSummary,
  renderSummary,
} from './hierarchy/hierarchyValidation.js';

import {
  getPlanResult,
  setPlanResult,
  setPlanRawData,
  getPlanCurrentFile,
  setPlanCurrentFile,
} from './plan/planState.js';

import {
  setRawData,
  setCuentasMap,
  getCurrentFile,
  setCurrentFile,
  getResult,
  setResult,
} from './hierarchy/hierarchyState.js';

import {
  validatePlanParameters,
} from './plan/planWorkflow.js';


/* ============================================================
   CONFIGURACIÓN
============================================================ */

configureApp({
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
});


/* ============================================================
   START
============================================================ */

if (document.readyState === 'loading') {

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      initApp();
      initAIActions();
    }
  );

} else {

  initApp();
  initAIActions();

}