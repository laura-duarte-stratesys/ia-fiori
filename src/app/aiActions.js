/* ============================================================
   ACCIONES DE IA
============================================================ */

import {
    applyAISuggestions,
  } from '../hierarchy/hierarchyAI.js';
  
  
  /* ============================================================
     APLICAR SUGERENCIAS IA
  ============================================================ */
  
  export function initAIActions() {
  
    document
      .getElementById('btn-apply-ai')
      ?.addEventListener('click', () => {
  
        const cambiosAplicados =
          applyAISuggestions();
  
        const statusLine =
          document.getElementById('status-line');
  
        if (cambiosAplicados > 0) {
  
          statusLine.textContent =
            `Se aplicaron ${cambiosAplicados} cambios propuestos por la IA.`;
  
          statusLine.classList.add('success');
  
        } else {
  
          statusLine.textContent =
            'No había cambios de la IA para aplicar.';
        }
  
        document
          .getElementById('btn-apply-ai')
          .style.display = 'none';
      });
  }