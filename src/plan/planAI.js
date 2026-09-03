import {
    $,
    normalizeAIValue,
    escapeHtml,
    scrollToElement,
  } from '../utils/helpers.js';
  
  import {
    processPlan,
    buildPlanSummary,
    renderPlanSummary,
    renderPlanIncidents,
  } from './planValidation.js';
  
  
  let planAIConfig = {
    getPlanResult: null,
    setPlanResult: null,
    setPlanRawData: null,
  };
  
  
  export function configurePlanAI(config = {}) {
    planAIConfig = {
      ...planAIConfig,
      ...config,
    };
  }
  
  
  /* ============================================================
     IA PLAN
  ============================================================ */
  
  export function chunkPlanRecords(records, chunkSize = 150) {
  
    const chunks = [];
  
    for (let i = 0; i < records.length; i += chunkSize) {
  
      chunks.push(records.slice(i, i + chunkSize));
  
    }
  
    return chunks;
  
  }
  
  
  /* ============================================================
     ANALIZAR PLAN CON IA
  ============================================================ */
  
  export async function analyzePlanWithAI() {
  
    const PLAN_RESULT = planAIConfig.getPlanResult?.();
  
    const aiResult = $('ai-result-plan');
    const statusLine = $('ai-status-plan');
    const btn = document.getElementById('btn-ai-plan');
  
    /*
     * ============================================================
     * 1. VALIDAR PLAN
     * ============================================================
     */
  
    if (!PLAN_RESULT) {
  
      aiResult.innerHTML = `
        <div class="ai-empty-state">
  
          <div class="ai-empty-icon">
            <i class="ti ti-alert-circle"></i>
          </div>
  
          <strong>Primero procesa el archivo</strong>
  
          <p>
            Debes procesar y validar el plan de cuentas antes
            de ejecutar el análisis mediante IA.
          </p>
  
        </div>
      `;
  
      return;
    }
  
    /*
     * ============================================================
     * 2. PREPARAR REGISTROS
     * ============================================================
     */
  
    const registros = (PLAN_RESULT.records || []).map((record) => ({
  
      originalRow: Number(record.originalRow),
  
      cuentaLocal: String(record.cuentaLocal ?? '').trim(),
  
      cuenta: String(record.cuenta ?? '').trim(),
  
      descripcion: String(record.descripcion ?? '').trim(),
  
      acctype: String(record.acctype ?? '').trim(),
  
      typelim: String(record.typelim ?? '').trim(),
  
      conversion: String(record.conversion ?? '').trim(),
  
    }));
  
    /*
     * ============================================================
     * 3. VALIDAR REGISTROS
     * ============================================================
     */
  
    if (!registros.length) {
  
      aiResult.innerHTML = `
        <div class="ai-empty-state">
  
          <div class="ai-empty-icon">
            <i class="ti ti-database-off"></i>
          </div>
  
          <strong>Sin registros para analizar</strong>
  
          <p>
            No existen registros del plan de cuentas disponibles
            para el análisis.
          </p>
  
        </div>
      `;
  
      statusLine.textContent = 'Sin datos';
  
      statusLine.classList.remove('ready');
  
      return;
    }
  
    /*
     * ============================================================
     * 4. PREPARAR BLOQUES
     * ============================================================
     */
  
    const CHUNK_SIZE = 150;
  
    const chunks = chunkPlanRecords(
      registros,
      CHUNK_SIZE
    );
  
    /*
     * ============================================================
     * 5. ESTADO — ANALIZANDO
     * ============================================================
     */
  
    if (btn) {
  
      btn.disabled = true;
  
      btn.innerHTML = `
        <i
          class="ti ti-loader-2"
          style="
            font-size:15px;
            vertical-align:-2px;
            margin-right:4px;
          "
          aria-hidden="true"
        ></i>
        Analizando plan…
      `;
  
    }
  
    statusLine.textContent =
      `Preparando análisis de ${registros.length.toLocaleString(
        'es-ES'
      )} registros…`;
  
    statusLine.classList.remove('ready');
  
    aiResult.innerHTML = `
      <div class="ai-analysis-summary">
  
        <div class="ai-summary-main">
  
          <i class="ti ti-sparkles"></i>
  
          <div>
  
            <strong>
              Analizando plan de cuentas
            </strong>
  
            <span>
              La IA revisará
              ${registros.length.toLocaleString('es-ES')}
              registros en
              ${chunks.length.toLocaleString('es-ES')}
              bloque(s)…
            </span>
  
          </div>
  
        </div>
  
      </div>
    `;
  
    /*
     * ============================================================
     * 6. POWER AUTOMATE
     * ============================================================
     */
  
    const FLOW_URL =
      'https://default18479be7da7b44a1ba5f47085a09a1.d0.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/00/workflows/76cd58ff12a74cc5a231a257f872554d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Tca1hPTQq2148nc604gtrpvSUEXbAEBZ7MheNtP2EZU';
  
    try {
  
      /*
       * ==========================================================
       * 7. ACUMULADORES
       * ==========================================================
       */
  
      const allSuggestions = [];
  
      const allIncidents = [];
  
      /*
       * ==========================================================
       * 8. PROCESAR BLOQUES
       * ==========================================================
       */
  
      for (let i = 0; i < chunks.length; i++) {
  
        const chunk = chunks[i];
  
        const processedBefore = chunks
          .slice(0, i)
          .reduce(
            (total, currentChunk) =>
              total + currentChunk.length,
            0
          );
  
        const processedAfter =
          processedBefore + chunk.length;
  
        statusLine.textContent =
          `Analizando bloque ${i + 1} de ${chunks.length} · ` +
          `${processedBefore.toLocaleString('es-ES')}–` +
          `${processedAfter.toLocaleString('es-ES')} de ` +
          `${registros.length.toLocaleString('es-ES')} registros…`;
  
        aiResult.innerHTML = `
          <div class="ai-analysis-summary">
  
            <div class="ai-summary-main">
  
              <i class="ti ti-sparkles"></i>
  
              <div>
  
                <strong>
                  Analizando plan de cuentas
                </strong>
  
                <span>
                  Bloque
                  ${i + 1}
                  de
                  ${chunks.length}
                  ·
                  ${processedBefore.toLocaleString('es-ES')}
                  –
                  ${processedAfter.toLocaleString('es-ES')}
                  de
                  ${registros.length.toLocaleString('es-ES')}
                  registros
                </span>
  
              </div>
  
            </div>
  
          </div>
        `;
  
        /*
         * --------------------------------------------------------
         * LLAMADA HTTP
         * --------------------------------------------------------
         */
  
        const response = await fetch(FLOW_URL, {
  
          method: 'POST',
  
          headers: {
            'Content-Type': 'application/json',
          },
  
          body: JSON.stringify({
            registros: chunk,
          }),
  
        });
  
        /*
         * --------------------------------------------------------
         * VALIDAR HTTP
         * --------------------------------------------------------
         */
  
        if (!response.ok) {
  
          const errorText = await response.text();
  
          throw new Error(
            `Error HTTP ${response.status} en el bloque ` +
            `${i + 1} de ${chunks.length}: ${errorText}`
          );
  
        }
  
        /*
         * --------------------------------------------------------
         * LEER RESPUESTA
         * --------------------------------------------------------
         */
  
        const aiResponse = await response.json();
  
        /*
         * --------------------------------------------------------
         * VALIDAR RESPUESTA IA
         * --------------------------------------------------------
         */
  
        if (
          !aiResponse ||
          typeof aiResponse !== 'object'
        ) {
  
          throw new Error(
            `La IA no devolvió una respuesta JSON válida ` +
            `en el bloque ${i + 1} de ${chunks.length}.`
          );
  
        }
  
        /*
         * --------------------------------------------------------
         * OBTENER SUGERENCIAS
         * --------------------------------------------------------
         */
  
        const suggestions =
          Array.isArray(aiResponse.registros)
            ? aiResponse.registros
            : [];
  
        suggestions.forEach((suggestion) => {
  
          delete suggestion.parentId;
          delete suggestion.padre;
          delete suggestion.padre_sugerido;
          delete suggestion.nivel;
          delete suggestion.nivel_sugerido;
          delete suggestion.tipo;
          delete suggestion.tipo_sugerido;
  
        });
  
        /*
         * --------------------------------------------------------
         * OBTENER INCIDENCIAS
         * --------------------------------------------------------
         */
  
        const incidents =
          Array.isArray(aiResponse.incidencias)
            ? aiResponse.incidencias
            : [];
  
        /*
         * --------------------------------------------------------
         * ACUMULAR
         * --------------------------------------------------------
         */
  
        allSuggestions.push(...suggestions);
  
        allIncidents.push(...incidents);
  
      }
  
      /*
       * ==========================================================
       * 9. RESULTADO COMPLETO
       * ==========================================================
       */
  
      const suggestions = allSuggestions;
  
      const incidents = allIncidents;
  
      /*
       * ==========================================================
       * 10. DETECTAR CAMBIOS REALES
       * ==========================================================
       */
  
      const realSuggestions =
        suggestions.filter((suggestion) => {
  
          const descripcionCambio =
            suggestion.descripcion_sugerida !== undefined &&
            normalizeAIValue(
              suggestion.descripcion_sugerida
            ) !==
            normalizeAIValue(
              suggestion.descripcion_original
            );
  
          const acctypeCambio =
            suggestion.acctype_sugerido !== undefined &&
            normalizeAIValue(
              suggestion.acctype_sugerido
            ) !==
            normalizeAIValue(
              suggestion.acctype_original
            );
  
          const typelimCambio =
            suggestion.typelim_sugerido !== undefined &&
            normalizeAIValue(
              suggestion.typelim_sugerido
            ) !==
            normalizeAIValue(
              suggestion.typelim_original
            );
  
          const conversionCambio =
            suggestion.conversion_sugerida !== undefined &&
            normalizeAIValue(
              suggestion.conversion_sugerida
            ) !==
            normalizeAIValue(
              suggestion.conversion_original
            );
  
          return (
            descripcionCambio ||
            acctypeCambio ||
            typelimCambio ||
            conversionCambio
          );
  
        });
  
      /*
       * ==========================================================
       * 11. GUARDAR RESULTADOS
       * ==========================================================
       */
  
      PLAN_RESULT.aiSuggestion =
        realSuggestions;
  
      PLAN_RESULT.aiIncidents =
        incidents;
  
      /*
       * ==========================================================
       * 12. CONSTRUIR HTML
       * ==========================================================
       */
  
      let html = `
        <div class="ai-analysis-summary">
  
          <div class="ai-summary-main">
  
            <i class="ti ti-sparkles"></i>
  
            <div>
  
              <strong>
                Análisis completado
              </strong>
  
              <span>
                ${registros.length.toLocaleString('es-ES')}
                registros analizados por IA
              </span>
  
            </div>
  
          </div>
  
          <div class="ai-summary-count">
  
            <strong>
              ${realSuggestions.length}
            </strong>
  
            <span>
              cambios
            </span>
  
          </div>
  
        </div>
      `;
  
      /*
       * ==========================================================
       * 13. CAMBIOS PROPUESTOS
       * ==========================================================
       */
  
      if (realSuggestions.length) {
  
        html += `
          <div class="ai-changes-title">
            Cambios propuestos por IA
          </div>
  
          <div
            style="
              overflow:auto;
              max-height:360px;
            "
          >
  
            <table>
  
              <thead>
  
                <tr>
  
                  <th></th>
  
                  <th>
                    Cuenta
                  </th>
  
                  <th>
                    Cambios
                  </th>
  
                </tr>
  
              </thead>
  
              <tbody>
        `;
  
        html += realSuggestions
          .map((suggestion, index) => {
  
            const cambios = [];
  
            /*
             * DESCRIPCIÓN
             */
  
            if (
              suggestion.descripcion_sugerida !== undefined &&
              normalizeAIValue(
                suggestion.descripcion_sugerida
              ) !==
              normalizeAIValue(
                suggestion.descripcion_original
              )
            ) {
  
              cambios.push(`
                <div class="ai-field-change">
  
                  <strong>
                    Descripción
                  </strong>
  
                  <div class="ai-field-values">
  
                    <span class="ai-old-value">
                      ${escapeHtml(
                        suggestion.descripcion_original ||
                        '—'
                      )}
                    </span>
  
                    <span class="ai-arrow">
                      →
                    </span>
  
                    <span class="ai-new-value">
                      ${escapeHtml(
                        suggestion.descripcion_sugerida ||
                        '—'
                      )}
                    </span>
  
                  </div>
  
                </div>
              `);
  
            }
  
            /*
             * ACCTYPE
             */
  
            if (
              suggestion.acctype_sugerido !== undefined &&
              normalizeAIValue(
                suggestion.acctype_sugerido
              ) !==
              normalizeAIValue(
                suggestion.acctype_original
              )
            ) {
  
              cambios.push(`
                <div class="ai-field-change">
  
                  <strong>
                    ACCTYPE
                  </strong>
  
                  <div class="ai-field-values">
  
                    <span class="ai-old-value">
                      ${escapeHtml(
                        suggestion.acctype_original ||
                        '—'
                      )}
                    </span>
  
                    <span class="ai-arrow">
                      →
                    </span>
  
                    <span class="ai-new-value">
                      ${escapeHtml(
                        suggestion.acctype_sugerido ||
                        '—'
                      )}
                    </span>
  
                  </div>
  
                </div>
              `);
  
            }
  
            /*
             * TYPELIM
             */
  
            if (
              suggestion.typelim_sugerido !== undefined &&
              normalizeAIValue(
                suggestion.typelim_sugerido
              ) !==
              normalizeAIValue(
                suggestion.typelim_original
              )
            ) {
  
              cambios.push(`
                <div class="ai-field-change">
  
                  <strong>
                    TYPELIM
                  </strong>
  
                  <div class="ai-field-values">
  
                    <span class="ai-old-value">
                      ${escapeHtml(
                        suggestion.typelim_original ||
                        '—'
                      )}
                    </span>
  
                    <span class="ai-arrow">
                      →
                    </span>
  
                    <span class="ai-new-value">
                      ${escapeHtml(
                        suggestion.typelim_sugerido ||
                        '—'
                      )}
                    </span>
  
                  </div>
  
                </div>
              `);
  
            }
  
            /*
             * CONVERSION
             */
  
            if (
              suggestion.conversion_sugerida !== undefined &&
              normalizeAIValue(
                suggestion.conversion_sugerida
              ) !==
              normalizeAIValue(
                suggestion.conversion_original
              )
            ) {
  
              cambios.push(`
                <div class="ai-field-change">
  
                  <strong>
                    CONVERSION
                  </strong>
  
                  <div class="ai-field-values">
  
                    <span class="ai-old-value">
                      ${escapeHtml(
                        suggestion.conversion_original ||
                        '—'
                      )}
                    </span>
  
                    <span class="ai-arrow">
                      →
                    </span>
  
                    <span class="ai-new-value">
                      ${escapeHtml(
                        suggestion.conversion_sugerida ||
                        '—'
                      )}
                    </span>
  
                  </div>
  
                </div>
              `);
  
            }
  
            /*
             * FILA
             */
  
            return `
              <tr>
  
                <td
                  style="
                    text-align:center;
                  "
                >
  
                  <input
                    type="checkbox"
                    class="ai-change-checkbox"
                    data-ai-index="${index}"
                    checked
                  />
  
                </td>
  
                <td>
  
                  <strong>
                    ${escapeHtml(
                      suggestion.cuenta ||
                      'Sin cuenta'
                    )}
                  </strong>
  
                  ${
                    suggestion.cuentaLocal
                      ? `
                        <div
                          style="
                            font-size:12px;
                            color:#64748b;
                            margin-top:3px;
                          "
                        >
                          Local:
                          ${escapeHtml(
                            suggestion.cuentaLocal
                          )}
                        </div>
                      `
                      : ''
                  }
  
                  <div
                    style="
                      font-size:11px;
                      color:#94a3b8;
                      margin-top:2px;
                    "
                  >
                    Fila:
                    ${escapeHtml(
                      String(
                        suggestion.originalRow
                      )
                    )}
                  </div>
  
                </td>
  
                <td>
  
                  ${cambios.join('')}
  
                  ${
                    suggestion.explicacion
                      ? `
                        <div class="ai-row-explanation">
  
                          <i class="ti ti-bulb"></i>
  
                          ${escapeHtml(
                            suggestion.explicacion
                          )}
  
                        </div>
                      `
                      : ''
                  }
  
                </td>
  
              </tr>
            `;
  
          })
          .join('');
  
        html += `
              </tbody>
  
            </table>
  
          </div>
        `;
  
      }
  
      /*
       * ==========================================================
       * 14. INCIDENCIAS IA
       * ==========================================================
       */
  
      if (incidents.length) {
  
        html += `
          <div class="ai-changes-title">
            Incidencias detectadas
          </div>
  
          <div class="ai-alert-section">
  
            <ul class="ai-alert-list">
  
              ${incidents
                .slice(0, 10)
                .map(
                  (incident) => `
                    <li>
  
                      <strong>
                        ${escapeHtml(
                          incident.cuenta ||
                          'Cuenta'
                        )}
                      </strong>
  
                      —
  
                      ${escapeHtml(
                        incident.explicacion ||
                        ''
                      )}
  
                    </li>
                  `
                )
                .join('')}
  
            </ul>
  
          </div>
        `;
  
      }
  
      /*
       * ==========================================================
       * 15. SIN CAMBIOS NI INCIDENCIAS
       * ==========================================================
       */
  
      if (
        !realSuggestions.length &&
        !incidents.length
      ) {
  
        html += `
          <div class="ai-success-box">
  
            <div class="ai-success-icon">
  
              <i class="ti ti-circle-check"></i>
  
            </div>
  
            <div>
  
              <strong>
                Todo está correcto
              </strong>
  
              <p>
                La IA no ha detectado
                inconsistencias ni cambios
                necesarios.
              </p>
  
            </div>
  
          </div>
        `;
  
      }
  
      /*
       * ==========================================================
       * 16. BOTÓN APLICAR
       * ==========================================================
       */
  
      if (realSuggestions.length) {
  
        html += `
          <div class="ai-actions">
  
            <button
              type="button"
              id="btn-apply-ai-plan"
              class="primary"
            >
  
              <i class="ti ti-check"></i>
  
              Aplicar cambios seleccionados
  
            </button>
  
          </div>
        `;
  
      }
  
      /*
       * ==========================================================
       * 17. MOSTRAR RESULTADO
       * ==========================================================
       */
  
      aiResult.innerHTML = html;
  
      /*
       * ==========================================================
       * 18. CONECTAR BOTÓN APLICAR
       * ==========================================================
       */
  
      const btnApplyAI =
        document.getElementById(
          'btn-apply-ai-plan'
        );
  
      if (btnApplyAI) {
  
        btnApplyAI.addEventListener(
          'click',
          async () => {
  
            btnApplyAI.disabled = true;
  
            btnApplyAI.innerHTML = `
              <i
                class="ti ti-loader-2"
                style="
                  font-size:15px;
                  vertical-align:-2px;
                  margin-right:4px;
                "
              ></i>
  
              Aplicando cambios…
            `;
  
            try {
  
              const cambiosAplicados =
                await applyAISuggestionsPlan();
  
              statusLine.textContent =
                `✓ Se aplicaron ${cambiosAplicados} cambio(s).`;
  
              statusLine.classList.add('ready');
  
              btnApplyAI.innerHTML = `
                <i class="ti ti-check"></i>
  
                Cambios aplicados
              `;
  
            } catch (error) {
  
              console.error(
                'Error aplicando cambios IA:',
                error
              );
  
              btnApplyAI.disabled = false;
  
              btnApplyAI.innerHTML = `
                <i class="ti ti-check"></i>
  
                Aplicar cambios seleccionados
              `;
  
              statusLine.textContent =
                'No se pudieron aplicar los cambios.';
  
              statusLine.classList.remove('ready');
  
            }
  
          }
        );
  
      }
  
      /*
       * ==========================================================
       * 19. ESTADO FINAL
       * ==========================================================
       */
  
      if (realSuggestions.length) {
  
        statusLine.textContent =
          `IA terminó el análisis de ` +
          `${registros.length.toLocaleString('es-ES')} registros. ` +
          `Se proponen ${realSuggestions.length} cambio(s).`;
  
      } else if (incidents.length) {
  
        statusLine.textContent =
          `IA terminó el análisis de ` +
          `${registros.length.toLocaleString('es-ES')} registros. ` +
          `No se proponen cambios.`;
  
      } else {
  
        statusLine.textContent =
          `✓ La IA analizó ` +
          `${registros.length.toLocaleString('es-ES')} registros ` +
          `y no detectó cambios necesarios.`;
  
      }
  
      statusLine.classList.add('ready');
  
    } catch (error) {
  
      console.error(
        'Error al ejecutar el análisis con IA:',
        error
      );
  
      aiResult.innerHTML = `
        <div class="ai-alert-section">
  
          <div class="ai-alert-header error">
  
            <i class="ti ti-alert-circle"></i>
  
            No se pudo completar el análisis
  
          </div>
  
          <div
            style="
              padding:15px;
              font-size:13px;
              color:#475569;
            "
          >
  
            ${escapeHtml(
              error.message ||
              'Error desconocido'
            )}
  
          </div>
  
        </div>
      `;
  
      statusLine.textContent = 'Error';
  
      statusLine.classList.remove('ready');
  
    } finally {
  
      if (btn) {
  
        btn.disabled = false;
  
        btn.innerHTML = `
          <i
            class="ti ti-sparkles"
            style="
              font-size:15px;
              vertical-align:-2px;
            "
            aria-hidden="true"
          ></i>
  
          Analizar con IA
        `;
  
      }
  
    }
  
  }
  
  
  /* ============================================================
     APLICAR SUGERENCIAS IA
  ============================================================ */
  
  export async function applyAISuggestionsPlan() {
  
    const PLAN_RESULT = planAIConfig.getPlanResult?.();
  
    /*
     * ============================================================
     * 1. VALIDACIÓN
     * ============================================================
     */
  
    if (!PLAN_RESULT) {
  
      console.warn(
        'No existe PLAN_RESULT.'
      );
  
      return 0;
  
    }
  
    const aiSuggestions =
      Array.isArray(PLAN_RESULT.aiSuggestion)
        ? PLAN_RESULT.aiSuggestion
        : [];
  
    if (!aiSuggestions.length) {
  
      console.warn(
        'No existen sugerencias de IA para aplicar.'
      );
  
      return 0;
  
    }
  
    /*
     * ============================================================
     * 2. CHECKBOXES SELECCIONADOS
     * ============================================================
     */
  
    const checkboxes =
      document.querySelectorAll(
        '#ai-result-plan .ai-change-checkbox:checked'
      );
  
    if (!checkboxes.length) {
  
      alert(
        'Selecciona al menos un cambio para aplicar.'
      );
  
      return 0;
  
    }
  
    /*
     * ============================================================
     * 3. CONTADORES
     * ============================================================
     */
  
    let cambiosAplicados = 0;
  
    const indicesAplicados = [];
  
    /*
     * ============================================================
     * 4. APLICAR SUGERENCIAS
     * ============================================================
   */
  
    checkboxes.forEach((checkbox) => {
  
      const index =
        Number(checkbox.dataset.aiIndex);
  
      const suggestion =
        aiSuggestions[index];
  
      if (!suggestion) {
  
        console.warn(
          'No existe sugerencia IA para el índice:',
          index
        );
  
        return;
  
      }
  
      /*
       * IDENTIFICAR REGISTRO POR ORIGINAL ROW
       */
  
      const originalRow =
        Number(suggestion.originalRow);
  
      if (!Number.isFinite(originalRow)) {
  
        console.warn(
          'La sugerencia IA no contiene un originalRow válido:',
          suggestion
        );
  
        return;
  
      }
  
      const record =
        (PLAN_RESULT.records || []).find(
          (item) =>
            Number(item.originalRow) ===
            originalRow
        );
  
      if (!record) {
  
        console.warn(
          'No se encontró el registro correspondiente a originalRow:',
          originalRow,
          suggestion
        );
  
        return;
  
      }
  
      let modificado = false;
  
      /*
       * DESCRIPCIÓN
       */
  
      if (
        suggestion.descripcion_sugerida !== undefined &&
        normalizeAIValue(
          suggestion.descripcion_sugerida
        ) !==
        normalizeAIValue(
          record.descripcion
        )
      ) {
  
        record.descripcion =
          suggestion.descripcion_sugerida;
  
        modificado = true;
  
      }
  
      /*
       * ACCTYPE
       */
  
      if (
        suggestion.acctype_sugerido !== undefined &&
        normalizeAIValue(
          suggestion.acctype_sugerido
        ) !==
        normalizeAIValue(
          record.acctype
        )
      ) {
  
        record.acctype =
          suggestion.acctype_sugerido;
  
        modificado = true;
  
      }
  
      /*
       * TYPELIM
       */
  
      if (
        suggestion.typelim_sugerido !== undefined &&
        normalizeAIValue(
          suggestion.typelim_sugerido
        ) !==
        normalizeAIValue(
          record.typelim
        )
      ) {
  
        record.typelim =
          suggestion.typelim_sugerido;
  
        modificado = true;
  
      }
  
      /*
       * CONVERSION
       */
  
      if (
        suggestion.conversion_sugerida !== undefined &&
        normalizeAIValue(
          suggestion.conversion_sugerida
        ) !==
        normalizeAIValue(
          record.conversion
        )
      ) {
  
        record.conversion =
          suggestion.conversion_sugerida;
  
        modificado = true;
  
      }
  
      /*
       * REGISTRAR CAMBIO
       */
  
      if (modificado) {
  
        cambiosAplicados++;
  
        indicesAplicados.push(index);
  
      }
  
    });
  
    /*
     * ============================================================
     * 5. COMPROBAR CAMBIOS
     * ============================================================
     */
  
    if (cambiosAplicados === 0) {
  
      alert(
        'No se pudo aplicar ningún cambio seleccionado.'
      );
  
      return 0;
  
    }
  
    /*
     * ============================================================
     * 6. ELIMINAR ÚNICAMENTE LAS SUGERENCIAS APLICADAS
     * ============================================================
     */
  
    indicesAplicados
      .sort((a, b) => b - a)
      .forEach((index) => {
  
        PLAN_RESULT.aiSuggestion.splice(
          index,
          1
        );
  
      });
  
    /*
     * ============================================================
     * 7. SINCRONIZAR DATOS
     * ============================================================
     */
  
    planAIConfig.setPlanRawData?.(
      PLAN_RESULT.records
    );
  
    /*
     * ============================================================
     * 8. REVALIDAR
     * ============================================================
     */
  
    const validationResult =
      processPlan(
        PLAN_RESULT.records
      );
  
    /*
     * ============================================================
     * 9. CONSERVAR INFORMACIÓN IA
     * ============================================================
     */
  
    const aiSuggestionRestantes =
      PLAN_RESULT.aiSuggestion || [];
  
    const aiIncidents =
      PLAN_RESULT.aiIncidents || [];
  
    const newPlanResult = {
  
      ...validationResult,
  
      aiSuggestion:
        aiSuggestionRestantes,
  
      aiIncidents:
        aiIncidents,
  
    };
  
    planAIConfig.setPlanResult?.(
      newPlanResult
    );
  
    /*
     * ============================================================
     * 10. ACTUALIZAR RESUMEN
     * ============================================================
     */
  
    const summary =
      buildPlanSummary(
        newPlanResult
      );
  
    renderPlanSummary(summary);
  
    /*
     * ============================================================
     * 11. ACTUALIZAR INCIDENCIAS
     * ============================================================
     */
  
    renderPlanIncidents(
      newPlanResult.incidents
    );
  
    /*
     * ============================================================
     * 12. COMPROBAR ERRORES
     * ============================================================
     */
  
    const errors =
      newPlanResult.incidents.filter(
        (incident) =>
          incident.severity === 'Error'
      );
  
    const warnings =
      newPlanResult.incidents.filter(
        (incident) =>
          incident.severity === 'Warning'
      );
  
    const hasErrors =
      errors.length > 0;
  
    /*
     * ============================================================
     * 13. BOTÓN GENERAR
     * ============================================================
     */
  
    $('btn-plan-generate').disabled =
      hasErrors;
  
    /*
     * ============================================================
     * 14. RESULTADO VISUAL
     * ============================================================
     */
  
    if (hasErrors) {
  
      $('ai-result-plan').innerHTML = `
        <div class="ai-priority">
  
          <strong>
            ${cambiosAplicados}
            cambio(s) aplicado(s)
          </strong>
  
        </div>
  
        <p>
          Los cambios seleccionados se han aplicado
          correctamente.
        </p>
  
        <p>
          El plan se volvió a validar,
          pero todavía existen incidencias.
        </p>
  
        <ul>
  
          <li>
            Errores:
            <strong>
              ${errors.length}
            </strong>
          </li>
  
          <li>
            Advertencias:
            <strong>
              ${warnings.length}
            </strong>
          </li>
  
        </ul>
      `;
  
      $('ai-status-plan').textContent =
        'Incidencias pendientes';
  
      $('ai-status-plan').classList.add(
        'ready'
      );
  
    } else {
  
      $('ai-result-plan').innerHTML = `
        <div class="ai-success-box">
  
          <div class="ai-success-icon">
  
            <i class="ti ti-circle-check"></i>
  
          </div>
  
          <div>
  
            <strong>
              Cambios aplicados correctamente
            </strong>
  
            <p>
              Se aplicaron
              <strong>
                ${cambiosAplicados}
              </strong>
              cambio(s).
            </p>
  
            <p>
              El plan se volvió a validar correctamente.
            </p>
  
          </div>
  
        </div>
      `;
  
      $('ai-status-plan').textContent =
        'Validación correcta';
  
      $('ai-status-plan').classList.add(
        'ready'
      );
  
    }
  
    /*
     * ============================================================
     * 15. SCROLL
     * ============================================================
     */
  
    scrollToElement(
      $('plan-step3')
    );
  
    return cambiosAplicados;
  
  }