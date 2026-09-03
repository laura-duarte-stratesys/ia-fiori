import { $ } from '../utils/helpers.js';

/* ============================================================
   MODO DE TRABAJO
============================================================ */

export function initModes() {
  const btnJerarquia = $('accordion-jerarquia');
  const btnPlan = $('accordion-plan');

  const panelJerarquia = $('panel-jerarquia');
  const panelPlan = $('panel-plan');

  btnJerarquia?.addEventListener('click', () => {
    btnJerarquia.classList.add('active');
    btnPlan?.classList.remove('active');

    if (panelJerarquia) {
      panelJerarquia.style.display = '';
    }

    if (panelPlan) {
      panelPlan.style.display = 'none';
    }
  });

  btnPlan?.addEventListener('click', () => {
    btnPlan.classList.add('active');
    btnJerarquia?.classList.remove('active');

    if (panelPlan) {
      panelPlan.style.display = '';
    }

    if (panelJerarquia) {
      panelJerarquia.style.display = 'none';
    }
  });
}