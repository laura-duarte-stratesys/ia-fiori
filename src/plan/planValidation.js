import {
    $,
    normalize,
    normalizeKey,
    escapeHtml,
    normalizeAIValue,
    show,
    hide,
  } from '../utils/helpers.js';
  
  let planValidationConfig = {
    getPlanResult: null,
    setPlanResult: null,
  };
  
  export function configurePlanValidation(config = {}) {
    planValidationConfig = {
      ...planValidationConfig,
      ...config,
    };
  }
  
  /* ============================================================
     NORMALIZAR ACCTYPE
  ============================================================ */
  
  export function normalizeAcctype(value) {
    const text = normalize(value).trim().toUpperCase();
  
    if (/^AST(\s|$)/.test(text)) return 'AST -- Activo';
    if (/^LEQ(\s|$)/.test(text)) return 'LEQ -- Pasivo';
    if (/^INC(\s|$)/.test(text)) return 'INC -- Ingreso';
    if (/^EXP(\s|$)/.test(text)) return 'EXP -- Gasto';
  
    return text;
  }
  

  
  /* ============================================================
     DETECTAR DUPLICADOS EXACTOS
  ============================================================ */
  
  export function detectarDuplicadosExactos(registros) {
    const duplicados = [];
    const vistos = new Map();
  
    registros.forEach((registro) => {
      const key = [
        normalizeAIValue(registro.cuentaLocal),
        normalizeAIValue(registro.cuenta),
        normalizeAIValue(registro.descripcion),
        normalizeAIValue(registro.acctype),
        normalizeAIValue(registro.typelim),
        normalizeAIValue(registro.conversion),
      ].join('|');
  
      if (!key.replace(/\|/g, '')) {
        return;
      }
  
      if (!vistos.has(key)) {
        vistos.set(key, registro);
        return;
      }
  
      const conservar = vistos.get(key);
  
      duplicados.push({
        originalRow: registro.originalRow,
  
        cuentaLocal: registro.cuentaLocal,
  
        cuenta: registro.cuenta,
  
        accion: 'eliminar',
  
        motivo: 'duplicado_exacto',
  
        conservarCuentaLocal: conservar.cuentaLocal,
  
        explicacion:
          `La fila ${registro.originalRow} es un duplicado exacto ` +
          `de la fila ${conservar.originalRow}. ` +
          `Coinciden CUENTA LOCAL, CTA. GRUPO, DESCRIPTION, ` +
          `ACCTYPE, TYPELIM y CONVERSION.`,
      });
    });
  
    return duplicados;
  }
  
  /* ============================================================
     OBTENER CÓDIGO ACCTYPE
  ============================================================ */
  
  export function getAcctypeCode(value) {
    const text = normalize(value).toUpperCase();
  
    if (text.includes('AST')) return 'AST';
    if (text.includes('LEQ')) return 'LEQ';
    if (text.includes('INC')) return 'INC';
    if (text.includes('EXP')) return 'EXP';
  
    return '';
  }
  
  /* ============================================================
     GET MEASURE
  ============================================================ */
  
  export function getMeasure(acctype, measureMap) {
    const code = getAcctypeCode(acctype);
  
    return measureMap?.[code] || null;
  }
  
  /* ============================================================
     GET CONVERSION
  ============================================================ */
  
  export function getConversion(acctype, conversionMap) {
    const code = getAcctypeCode(acctype);
  
    return conversionMap?.[code] || null;
  }
  
  /* ============================================================
     PROCESAR PLAN
  ============================================================ */
  
  export function processPlan(rows) {
    const incidents = [];
  
    const records = rows.map((row) => ({
      originalRow: row.originalRow,
  
      cuentaLocal: row.cuentaLocal,
  
      cuenta: row.cuenta,
  
      descripcion: row.descripcion,
  
      acctype: row.acctype,
  
      typelim: row.typelim,
  
      conversion: row.conversion,
  
      valid: true,
    }));
  
    records.forEach((record) => {
      if (!record.cuenta) {
        record.valid = false;
  
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.cuentaLocal,
          cuentaLocal: record.cuentaLocal,
          tipo: 'cuenta_faltante',
          message: 'La cuenta de grupo está vacía.',
          removable: false,
        });
      }
  
      if (!record.descripcion) {
        record.valid = false;
  
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.cuenta || record.cuentaLocal,
          cuentaLocal: record.cuentaLocal,
          tipo: 'descripcion_ambigua',
          message: 'La descripción está vacía.',
          removable: false,
        });
      }
  
      if (!record.acctype) {
        record.valid = false;
  
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.cuenta || record.cuentaLocal,
          cuentaLocal: record.cuentaLocal,
          tipo: 'acctype_incorrecto',
          message: 'El ACCTYPE está vacío.',
          removable: false,
        });
      } else {
        const acctypeCode = normalizeKey(record.acctype).split(' ')[0];
  
        const validAcctype = new Set(['AST', 'LEQ', 'INC', 'EXP']);
  
        if (!validAcctype.has(acctypeCode)) {
          record.valid = false;
  
          incidents.push({
            severity: 'Error',
            row: record.originalRow,
            id: record.cuenta || record.cuentaLocal,
            cuentaLocal: record.cuentaLocal,
            tipo: 'acctype_incorrecto',
            message: `ACCTYPE "${record.acctype}" no es válido.`,
            removable: false,
          });
        }
      }
    });
  
    const accountPairs = new Map();
  
    records.forEach((record) => {
      const cuentaLocal = normalizeKey(record.cuentaLocal);
      const cuentaGrupo = normalizeKey(record.cuenta);
  
      if (!cuentaLocal || !cuentaGrupo) {
        return;
      }
  
      const key = `${cuentaLocal}|${cuentaGrupo}`;
  
      if (!accountPairs.has(key)) {
        accountPairs.set(key, []);
      }
  
      accountPairs.get(key).push(record);
    });
  
    accountPairs.forEach((groupRecords) => {
      if (groupRecords.length < 2) {
        return;
      }
  
      const primerRegistro = groupRecords[0];
  
      const acctypes = [
        ...new Set(
          groupRecords
            .map((record) => normalizeAIValue(record.acctype))
            .filter(Boolean)
        ),
      ];
  
      if (acctypes.length > 1) {
        incidents.push({
          severity: 'Warning',
          row: primerRegistro.originalRow,
          id: primerRegistro.cuenta,
          cuentaLocal: primerRegistro.cuentaLocal,
          tipo: 'multiples_acctype',
          message:
            `La cuenta local "${primerRegistro.cuentaLocal}" ` +
            `asociada a la cuenta de grupo ` +
            `"${primerRegistro.cuenta}" ` +
            `tiene varios ACCTYPE: ` +
            `${acctypes.join(', ')}.`,
          removable: false,
        });
      }
  
      const existenDiferencias = groupRecords.some(
        (record) =>
          normalizeAIValue(record.typelim) !==
            normalizeAIValue(primerRegistro.typelim) ||
          normalizeAIValue(record.conversion) !==
            normalizeAIValue(primerRegistro.conversion)
      );
  
      if (!existenDiferencias) {
        return;
      }
  
      incidents.push({
        severity: 'Warning',
        row: primerRegistro.originalRow,
        id: primerRegistro.cuenta,
        cuentaLocal: primerRegistro.cuentaLocal,
        tipo: 'cuenta_duplicada',
        message:
          `La cuenta local "${primerRegistro.cuentaLocal}" ` +
          `está asociada a la cuenta de grupo ` +
          `"${primerRegistro.cuenta}" con diferencias ` +
          `en TYPELIM o CONVERSION. ` +
          `Revisa la configuración.`,
        removable: false,
      });
    });
  
    return {
      records,
      incidents,
    };
  }
  
  /* ============================================================
     SUMMARY PLAN
  ============================================================ */
  
  export function buildPlanSummary(result) {
    const errors = result.incidents.filter(
      (i) => i.severity === 'Error'
    ).length;
  
    const warnings = result.incidents.filter(
      (i) => i.severity === 'Warning'
    ).length;
  
    const accounts = new Set(
      result.records.map((r) => normalizeKey(r.cuenta)).filter(Boolean)
    ).size;
  
    const acctype = new Set(
      result.records
        .map((r) => normalizeKey(r.acctype).split(' ')[0])
        .filter(Boolean)
    ).size;
  
    return {
      total: result.records.length,
      errors,
      warnings,
      accounts,
      acctype,
    };
  }
  
  /* ============================================================
     RENDER SUMMARY PLAN
  ============================================================ */
  
  export function renderPlanSummary(summary) {
    $('plan-summary-bar').innerHTML = `
      <div class="summary-card">
        <div class="label">Registros</div>
        <div class="value">${summary.total}</div>
      </div>
  
      <div class="summary-card">
        <div class="label">Cuentas</div>
        <div class="value">${summary.accounts}</div>
      </div>
  
      <div class="summary-card">
        <div class="label">Errores</div>
        <div class="value">${summary.errors}</div>
      </div>
  
      <div class="summary-card">
        <div class="label">ACCTYPE</div>
        <div class="value">${summary.acctype}</div>
      </div>
    `;
  }
  
  /* ============================================================
     RENDER PLAN INCIDENTS
  ============================================================ */
  
  export function renderPlanIncidents(incidents) {
    const container = $('plan-incidencias-table');
  
    if (!container) {
      return;
    }
  
    if (!incidents || !incidents.length) {
      container.innerHTML = '';
  
      show($('plan-clean-msg'));
  
      return;
    }
  
    hide($('plan-clean-msg'));
  
    container.innerHTML = `
      <div class="incidents-table-wrapper">
  
        <table class="incidents-table">
  
          <thead>
            <tr>
              <th>Severidad</th>
              <th>Fila</th>
              <th>Cuenta local</th>
              <th>Cuenta grupo</th>
              <th>Tipo</th>
              <th>Descripción</th>
            </tr>
          </thead>
  
          <tbody>
  
            ${incidents
              .map(
                (incident) => `
                  <tr>
  
                    <td>
                      <span
                        class="
                          incident-severity
                          ${String(incident.severity || '').toLowerCase()}
                        "
                      >
                        ${escapeHtml(incident.severity || '')}
                      </span>
                    </td>
  
                    <td>
                      ${escapeHtml(incident.row ?? '—')}
                    </td>
  
                    <td>
                      ${escapeHtml(incident.cuentaLocal || '—')}
                    </td>
  
                    <td>
                      ${escapeHtml(
                        incident.id || incident.cuenta || '—'
                      )}
                    </td>
  
                    <td>
                      ${escapeHtml(incident.tipo || '—')}
                    </td>
  
                    <td>
                      ${escapeHtml(
                        incident.message ||
                          incident.explicacion ||
                          ''
                      )}
                    </td>
  
                  </tr>
                `
              )
              .join('')}
  
          </tbody>
  
        </table>
  
      </div>
    `;
  }
  
  /* ============================================================
     ELIMINAR DUPLICADOS EXACTOS
  ============================================================ */
  
  export function eliminarDuplicadosExactosDePlan() {
    const result = planValidationConfig.getPlanResult?.();
  
    if (!result?.records?.length) {
      return 0;
    }
  
    const duplicados = detectarDuplicadosExactos(result.records);
  
    if (!duplicados.length) {
      return 0;
    }
  
    const filasAEliminar = new Set(
      duplicados
        .map((item) => item.originalRow)
        .filter(
          (row) => row !== undefined && row !== null
        )
    );
  
    const antes = result.records.length;
  
    result.records = result.records.filter(
      (record) => !filasAEliminar.has(record.originalRow)
    );
  
    const eliminados = antes - result.records.length;
  
    return eliminados;
  }