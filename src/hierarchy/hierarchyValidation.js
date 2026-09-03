import {
    $,
    normalize,
    normalizeKey,
    escapeHtml,
    show,
    hide,
  } from '../utils/helpers.js';
  
  let validationConfig = {
    getResult: () => null,
    renderHierarchyTree: () => {},
    collapseHierarchyTree: () => {},
  };
  
  export function configureHierarchyValidation(config = {}) {
    validationConfig = {
      ...validationConfig,
      ...config,
    };
  }
  
  export function refreshHierarchyIncidents() {
    const RESULT = validationConfig.getResult();
  
    if (!RESULT?.records?.length) {
      return;
    }
  
    const incidents = [];
  
    const records = RESULT.records.filter(
      (record) => record.index !== 0
    );
  
    const hierarchyRootId = normalize(
      RESULT.records[0]?.id
    );
  
    const allIds = new Set(
      records
        .filter((record) => record.id)
        .map((record) => normalizeKey(record.id))
    );
  
    /* ============================================================
       VALIDAR PADRES
    ============================================================ */
  
    records.forEach((record) => {
      if (!record.id) {
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: '',
          message: 'El ID está vacío.',
        });
  
        return;
      }
  
      if (!record.descripcion) {
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.id,
          message: 'La descripción está vacía.',
        });
      }
  
      if (!record.parentId) {
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.id,
          message: 'No se pudo determinar el padre.',
        });
  
        return;
      }
  
      const parentKey = normalizeKey(record.parentId);
  
      if (
        parentKey !== normalizeKey(hierarchyRootId) &&
        !allIds.has(parentKey)
      ) {
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.id,
          message: `El padre "${record.parentId}" no existe.`,
        });
      }
    });
  
    /* ============================================================
       DUPLICADOS
    ============================================================ */
  
    const ids = new Map();
  
    records.forEach((record) => {
      const key = normalizeKey(record.id);
  
      if (!key) return;
  
      if (ids.has(key)) {
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.id,
          message: `ID duplicado. También aparece en la fila ${ids.get(key)}.`,
        });
      } else {
        ids.set(key, record.originalRow);
      }
    });
  
    /* ============================================================
       CICLOS
    ============================================================ */
  
    records.forEach((record) => {
      const visited = new Set();
  
      let current = record;
  
      while (current?.parentId) {
        const key = normalizeKey(current.id);
  
        if (visited.has(key)) {
          incidents.push({
            severity: 'Error',
            row: record.originalRow,
            id: record.id,
            message: 'Se detectó un ciclo en la jerarquía.',
          });
  
          break;
        }
  
        visited.add(key);
  
        const parentKey = normalizeKey(current.parentId);
  
        if (
          parentKey === normalizeKey(hierarchyRootId)
        ) {
          break;
        }
  
        current = records.find(
          (r) => normalizeKey(r.id) === parentKey
        );
  
        if (!current) {
          break;
        }
      }
    });
  
    /*
     * Mantener el resultado actual si la validación
     * no genera nuevas incidencias.
     */
  
    if (incidents.length > 0) {
      RESULT.incidents = incidents;
    }
  
    const incidentsToRender =
      RESULT.incidents || [];
  
    const incidentsContainer =
      document.getElementById('incidencias-table');
  
    if (incidentsContainer) {
      renderIncidents(
        incidentsContainer,
        incidentsToRender
      );
    }
  }
  
  /* ============================================================
     RESUMEN
  ============================================================ */
  
  export function buildSummary(
    records,
    incidents,
    hierarchyId
  ) {
    const errors = incidents.filter(
      (i) => i.severity === 'Error'
    ).length;
  
    const warnings = incidents.filter(
      (i) => i.severity === 'Warning'
    ).length;
  
    const roots = records.filter(
      (r) =>
        normalizeKey(r.parentId) ===
        normalizeKey(hierarchyId)
    ).length;
  
    const maxLevel = records.length
      ? Math.max(...records.map((r) => r.level))
      : 0;
  
    return {
      total: records.length,
      errors,
      warnings,
      roots,
      levels: maxLevel + 1,
    };
  }
  
  /* ============================================================
     RENDER SUMMARY
  ============================================================ */
  
  export function renderSummary(
    container,
    summary
  ) {
    if (!container) return;
  
    container.innerHTML = `
      <div class="summary-card">
        <div class="label">Registros</div>
        <div class="value">${summary.total}</div>
      </div>
  
      <div class="summary-card">
        <div class="label">Errores</div>
        <div class="value">${summary.errors}</div>
      </div>
  
      <div class="summary-card">
        <div class="label">Raíces</div>
        <div class="value">${summary.roots}</div>
      </div>
  
      <div class="summary-card">
        <div class="label">Niveles</div>
        <div class="value">${summary.levels}</div>
      </div>
    `;
  }
  
  /* ============================================================
     RENDER INCIDENCIAS
  ============================================================ */
  
  export function renderIncidents(
    container,
    incidents
  ) {
    if (!container) return;
  
    if (!incidents.length) {
      container.innerHTML = '';
  
      return;
    }
  
    const rows = incidents
      .map((incident) => {
        const className =
          incident.severity === 'Error'
            ? 'problem'
            : '';
  
        return `
          <tr class="${className}">
            <td>${escapeHtml(incident.severity)}</td>
            <td>${escapeHtml(incident.row)}</td>
            <td>${escapeHtml(incident.id)}</td>
            <td>${escapeHtml(incident.message)}</td>
          </tr>
        `;
      })
      .join('');
  
    container.innerHTML = `
      <div style="overflow:auto; max-height:360px;">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Fila</th>
              <th>ID</th>
              <th>Incidencia</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }
  
  /* ============================================================
     ESTADO DE VALIDACIÓN
  ============================================================ */
  
  export function updateHierarchyValidationUI(
    result
  ) {
    const hierarchyId =
      normalize($('f-id')?.value);
  
    const summary = buildSummary(
      result.records,
      result.incidents,
      hierarchyId
    );
  
    renderSummary(
      $('summary-bar'),
      summary
    );
  
    validationConfig.renderHierarchyTree(
      result
    );
  
    validationConfig.collapseHierarchyTree();
  
    renderIncidents(
      $('incidencias-table'),
      result.incidents
    );
  
    if (result.incidents.length === 0) {
      show($('clean-msg'));
    } else {
      hide($('clean-msg'));
    }
  
    const hasErrors =
      result.incidents.some(
        (i) => i.severity === 'Error'
      );
  
    $('gen-status').textContent =
      hasErrors
        ? 'Corrige las incidencias antes de generar el archivo.'
        : 'Validación completada. El archivo está listo para generar.';
  
    show($('step3'));
    show($('step4'));
  }