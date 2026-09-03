import {
    normalize,
    normalizeKey,
    escapeHtml,
  } from '../utils/helpers.js';
  
  let aiConfig = {
    getResult: null,
    refreshHierarchyIncidents: null,
    renderHierarchyTree: null,
    buildHierarchyTreeMap: null,
  };
  
  export function configureHierarchyAI(config = {}) {
    aiConfig = {
      ...aiConfig,
      ...config,
    };
  }
  
  /* ============================================================
     TROCEAR POR RAMA
  ============================================================ */
  
  export function trocearPorRama(registros, tamanoMaximo) {
    const porId = new Map(
      registros.map((r) => [r.id, r])
    );
  
    const hijosDe = new Map();
  
    for (const r of registros) {
      const p = r.padre_original || '__RAIZ__';
  
      if (!hijosDe.has(p)) {
        hijosDe.set(p, []);
      }
  
      hijosDe.get(p).push(r);
    }
  
    function recolectarSubarbol(
      id,
      visitados = new Set()
    ) {
      if (visitados.has(id)) {
        return [];
      }
  
      visitados.add(id);
  
      const nodo = porId.get(id);
  
      const resultado = nodo ? [nodo] : [];
  
      const hijos = hijosDe.get(id) || [];
  
      for (const hijo of hijos) {
        resultado.push(
          ...recolectarSubarbol(
            hijo.id,
            visitados
          )
        );
      }
  
      return resultado;
    }
  
    function dividirGrupoGrande(
      grupoRegistros,
      tamanoMaximo
    ) {
      if (
        grupoRegistros.length <=
        tamanoMaximo
      ) {
        return [grupoRegistros];
      }
  
      const nivelMinimo = Math.min(
        ...grupoRegistros.map(
          (r) => r.nivel_original
        )
      );
  
      const raicesDelGrupo =
        grupoRegistros.filter(
          (r) =>
            r.nivel_original ===
            nivelMinimo
        );
  
      if (raicesDelGrupo.length === 1) {
        const camino = [
          raicesDelGrupo[0],
        ];
  
        let actual =
          raicesDelGrupo[0];
  
        let hijosDirectos =
          hijosDe.get(actual.id) || [];
  
        while (
          hijosDirectos.length === 1
        ) {
          actual = hijosDirectos[0];
  
          camino.push(actual);
  
          hijosDirectos =
            hijosDe.get(actual.id) || [];
        }
  
        if (hijosDirectos.length === 0) {
          return [grupoRegistros];
        }
  
        const subGrupos = [];
  
        let primero = true;
  
        for (const hijo of hijosDirectos) {
          const subArbol =
            recolectarSubarbol(
              hijo.id
            );
  
          if (primero) {
            subGrupos.push([
              ...camino,
              ...subArbol,
            ]);
  
            primero = false;
          } else {
            subGrupos.push(
              subArbol
            );
          }
        }
  
        const resultado = [];
  
        for (const sg of subGrupos) {
          if (
            sg.length >=
            grupoRegistros.length
          ) {
            resultado.push(sg);
          } else {
            resultado.push(
              ...dividirGrupoGrande(
                sg,
                tamanoMaximo
              )
            );
          }
        }
  
        return resultado;
      }
  
      const resultado = [];
  
      for (const raiz of raicesDelGrupo) {
        const subArbol =
          recolectarSubarbol(
            raiz.id
          );
  
        if (
          subArbol.length >=
          grupoRegistros.length
        ) {
          resultado.push(
            subArbol
          );
        } else {
          resultado.push(
            ...dividirGrupoGrande(
              subArbol,
              tamanoMaximo
            )
          );
        }
      }
  
      return resultado;
    }
  
    const raicesAbsolutas =
      registros.filter(
        (r) => !r.padre_original
      );
  
    const gruposIniciales =
      raicesAbsolutas.map(
        (raiz) =>
          recolectarSubarbol(
            raiz.id
          )
      );
  
    const idsUsados = new Set(
      gruposIniciales
        .flat()
        .map((r) => r.id)
    );
  
    const huerfanos =
      registros.filter(
        (r) =>
          !idsUsados.has(r.id)
      );
  
    if (huerfanos.length) {
      gruposIniciales.push(
        huerfanos
      );
    }
  
    let subGruposFinales = [];
  
    for (const grupo of gruposIniciales) {
      subGruposFinales.push(
        ...dividirGrupoGrande(
          grupo,
          tamanoMaximo
        )
      );
    }
  
    const bloques = [];
  
    let bloqueActual = [];
  
    for (const sg of subGruposFinales) {
      if (sg.length >= tamanoMaximo) {
        if (bloqueActual.length) {
          bloques.push(
            bloqueActual
          );
  
          bloqueActual = [];
        }
  
        bloques.push(sg);
  
        continue;
      }
  
      if (
        bloqueActual.length +
          sg.length >
        tamanoMaximo
      ) {
        bloques.push(
          bloqueActual
        );
  
        bloqueActual = [];
      }
  
      bloqueActual.push(
        ...sg
      );
    }
  
    if (bloqueActual.length) {
      bloques.push(
        bloqueActual
      );
    }
  
    return bloques;
  }
  
  /* ============================================================
     PROBAR TROCEADO
  ============================================================ */
  
  export function probarTroceado(
    registros,
    tamanoMaximo = 75
  ) {
    const bloques =
      trocearPorRama(
        registros,
        tamanoMaximo
      );
  
    const usados = new Map();
  
    bloques.forEach(
      (bloque, i) => {
        for (const r of bloque) {
          if (!usados.has(r.id)) {
            usados.set(
              r.id,
              []
            );
          }
  
          usados
            .get(r.id)
            .push(i + 1);
        }
      }
    );
  
    const duplicados =
      [...usados.entries()]
        .filter(
          ([id, bloques]) =>
            bloques.length > 1
        );
  
    return bloques;
  }
  
  /* ============================================================
     SUGERIR CON IA
  ============================================================ */
  
  export async function suggestWithAI() {
    const RESULT =
      aiConfig.getResult?.();
  
    if (!RESULT) {
      return;
    }
  
    const btn =
      document.getElementById(
        'btn-ai-jerarquia'
      );
  
    const statusLine =
      document.getElementById(
        'status-line'
      );
  
    const aiResult =
      document.getElementById(
        'ai-result-jerarquia'
      );
  
    if (!btn) return;
  
    btn.disabled = true;
  
    btn.innerHTML =
      '<i class="ti ti-loader-2" style="font-size:15px; vertical-align:-2px; margin-right:4px;" aria-hidden="true"></i>Analizando estructura…';
  
    statusLine.style.display =
      'block';
  
    statusLine.classList.remove(
      'success'
    );
  
    const estructuraIA =
      RESULT.records
        .filter(
          (x) =>
            String(
              x.id ?? ''
            ).trim() !== ''
        )
        .map(
          (x, index) => ({
            orden: index + 1,
  
            id: String(
              x.id ?? ''
            ).trim(),
  
            descripcion:
              String(
                x.descripcion ?? ''
              ).trim(),
  
            padre_original:
              String(
                x.parentId ?? ''
              ).trim(),
  
            nivel_original:
              Number(
                x.level ?? 0
              ),
  
            tipo_original:
              String(
                x.tipo ?? ''
              ).trim(),
          })
        );
  
    if (!estructuraIA.length) {
      statusLine.textContent =
        'No hay registros para analizar.';
  
      btn.disabled = false;
  
      return;
    }
  
    const CHUNK_SIZE = 75;
  
    const FLOW_URL =
      'https://default18479be7da7b44a1ba5f47085a09a1.d0.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/22/workflows/9b90abcb09c0455c895afec69ab684dd/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=0dAwdP4ReVtIjpF2wD6x9NteMmap_D7z2krxqq716Ik';
  
    console.table(
      estructuraIA.map(
        (r) => ({
          id: r.id,
          padre: r.padre_original,
          nivel: r.nivel_original,
        })
      )
    );
  
    const bloques =
      trocearPorRama(
        estructuraIA,
        CHUNK_SIZE
      );
  
    const prueba =
      probarTroceado(
        RESULT.records,
        75
      );
  
    const todosLosRegistros = [];
  
    const todasLasIncidencias = [];
  
    try {
      for (
        let i = 0;
        i < bloques.length;
        i++
      ) {
        const bloque =
          bloques[i];
  
        statusLine.textContent =
          `Analizando bloque ${i + 1} de ${bloques.length} (${bloque.length} registros)…`;
  
        const response =
          await fetch(
            FLOW_URL,
            {
              method: 'POST',
  
              headers: {
                'Content-Type':
                  'application/json',
              },
  
              body: JSON.stringify({
                registros:
                  bloque,
              }),
            }
          );
  
        if (!response.ok) {
          const errorText =
            await response.text();
  
          throw new Error(
            `Error HTTP ${response.status} en bloque ${i + 1}: ${errorText}`
          );
        }
  
        const data =
          await response.json();
  
        if (
          !data ||
          typeof data !==
            'object'
        ) {
          throw new Error(
            `El bloque ${i + 1} no devolvió un objeto JSON válido.`
          );
        }
  
        if (
          !Array.isArray(
            data.registros
          )
        ) {
          throw new Error(
            `La respuesta del bloque ${i + 1} no contiene el array "registros".`
          );
        }
  
        todosLosRegistros.push(
          ...data.registros
        );
  
        if (
          Array.isArray(
            data.incidencias
          )
        ) {
          todasLasIncidencias.push(
            ...data.incidencias
          );
        }
      }
  
      const parsed =
        todosLosRegistros;
  
      const incidencias =
        todasLasIncidencias;
  
      const idsOriginales =
        new Set(
          estructuraIA.map(
            (x) => x.id
          )
        );
  
      const resultadoIA =
        parsed.map(
          (item) => {
            const id =
              String(
                item.id ?? ''
              ).trim();
  
            const padre =
              String(
                item.padre_sugerido ??
                  ''
              ).trim();
  
            if (
              !idsOriginales.has(
                id
              )
            ) {
              throw new Error(
                `La IA devolvió un ID inexistente: ${id}`
              );
            }
  
            if (
              padre &&
              !idsOriginales.has(
                padre
              )
            ) {
              throw new Error(
                `La IA asignó un padre inexistente: ${padre} para ${id}`
              );
            }
  
            return {
              id,
  
              descripcion:
                String(
                  item.descripcion ??
                    ''
                ).trim(),
  
              padre_original:
                String(
                  item.padre_original ??
                    ''
                ).trim(),
  
              nivel_original:
                Number(
                  item.nivel_original ??
                    0
                ),
  
              tipo_original:
                String(
                  item.tipo_original ??
                    ''
                ).trim(),
  
              padre_sugerido:
                padre,
  
              nivel_sugerido:
                Number.isFinite(
                  Number(
                    item.nivel_sugerido
                  )
                )
                  ? Number(
                      item.nivel_sugerido
                    )
                  : 0,
  
              tipo_sugerido:
                String(
                  item.tipo_sugerido ??
                    ''
                ).trim(),
  
              cambio_propuesto:
                item.cambio_propuesto ===
                true,
  
              confianza:
                item.confianza ||
                'baja',
  
              explicacion:
                item.explicacion ||
                '',
            };
          }
        );
  
      RESULT.aiSuggestion =
        resultadoIA;
  
      RESULT.aiIncidencias =
        incidencias;
  
      const cambios =
        resultadoIA.filter(
          (item) => {
            const padreOriginal =
              normalize(
                item.padre_original
              );
  
            const padreSugerido =
              normalize(
                item.padre_sugerido
              );
  
            const nivelOriginal =
              Number(
                item.nivel_original
              );
  
            const nivelSugerido =
              Number(
                item.nivel_sugerido
              );
  
            const tipoOriginal =
              normalize(
                item.tipo_original
              );
  
            const tipoSugerido =
              normalize(
                item.tipo_sugerido
              );
  
            return (
              padreOriginal !==
                padreSugerido ||
              nivelOriginal !==
                nivelSugerido ||
              tipoOriginal !==
                tipoSugerido
            );
          }
        );
  
      if (aiResult) {
        if (
          incidencias.length ===
            0 &&
          cambios.length === 0
        ) {
          aiResult.innerHTML = `
            <div class="ai-success-box">
              <div class="ai-success-icon">
                <i class="ti ti-circle-check"></i>
              </div>
  
              <div>
                <strong>Todo está correcto</strong>
  
                <p>
                  La IA analizó
                  <strong>${resultadoIA.length}</strong>
                  registros y no encontró cambios necesarios.
                </p>
              </div>
            </div>
          `;
        } else {
          const rows =
            cambios
              .map(
                (item) => {
                  const aiIndex =
                    resultadoIA.indexOf(
                      item
                    );
  
                  return `
                    <tr>
  
                      <td style="text-align:center;">
                        <input
                          type="checkbox"
                          class="ai-change-checkbox"
                          data-ai-index="${aiIndex}"
                          checked
                        />
                      </td>
  
                      <td>
                        ${escapeHtml(
                          item.tipo_sugerido ||
                            item.tipo_original
                        )}
                      </td>
  
                      <td>
                        <strong>
                          ${escapeHtml(
                            item.id
                          )}
                        </strong>
                      </td>
  
                      <td>
                        ${escapeHtml(
                          item.padre_original ||
                            'Sin padre'
                        )}
                      </td>
  
                      <td>
                        <strong>
                          ${escapeHtml(
                            item.padre_sugerido ||
                              'Sin padre'
                          )}
                        </strong>
                      </td>
  
                      <td>
                        ${item.nivel_original}
                      </td>
  
                      <td>
                        <strong>
                          ${item.nivel_sugerido}
                        </strong>
                      </td>
  
                      <td>
                        ${escapeHtml(
                          item.confianza
                        )}
                      </td>
  
                    </tr>
                  `;
                }
              )
              .join('');
  
          aiResult.innerHTML = `
            <div class="ai-analysis-summary">
  
              <div class="ai-summary-main">
  
                <i class="ti ti-sparkles"></i>
  
                <div>
                  <strong>Análisis completado</strong>
  
                  <span>
                    ${resultadoIA.length} registros analizados
                  </span>
                </div>
  
              </div>
  
              <div class="ai-summary-count">
  
                <strong>
                  ${cambios.length}
                </strong>
  
                <span>
                  cambios
                </span>
  
              </div>
  
            </div>
  
            <div class="ai-changes-title">
              Cambios propuestos
            </div>
  
            <div style="overflow:auto; max-height:360px;">
  
              <table>
  
                <thead>
  
                  <tr>
                    <th></th>
                    <th>Tipo</th>
                    <th>ID</th>
                    <th>Padre actual</th>
                    <th>Padre sugerido</th>
                    <th>Nivel actual</th>
                    <th>Nivel sugerido</th>
                    <th>Confianza</th>
                  </tr>
  
                </thead>
  
                <tbody>
                  ${rows}
                </tbody>
  
              </table>
  
            </div>
  
            <div class="ai-actions">
  
              <button
                type="button"
                id="btn-apply-ai"
                class="primary"
              >
                <i class="ti ti-check"></i>
                Aplicar cambios seleccionados
              </button>
  
            </div>
          `;
        }
      }
  
      const btnApplyAI =
        document.getElementById(
          'btn-apply-ai'
        );
  
      if (btnApplyAI) {
        btnApplyAI.addEventListener(
          'click',
          () => {
            const cambiosAplicados =
              applyAISuggestions();
  
            statusLine.textContent =
              `✓ Se aplicaron ${cambiosAplicados} cambios de la IA.`;
  
            statusLine.classList.add(
              'success'
            );
  
            btnApplyAI.style.display =
              'none';
          }
        );
      }
  
      if (
        incidencias.length ===
          0 &&
        cambios.length === 0
      ) {
        statusLine.textContent =
          `✓ Todo está correcto. La IA analizó ${resultadoIA.length} registros y no encontró cambios necesarios.`;
      } else {
        statusLine.textContent =
          `IA terminó el análisis de ${resultadoIA.length} registros. Revisá los ${cambios.length} cambios propuestos antes de aplicarlos.`;
      }
    } catch (err) {
      console.error(
        'Error analizando estructura con IA:',
        err
      );
  
      statusLine.textContent =
        'No se pudo analizar la estructura con IA. Revisá la consola.';
    } finally {
      btn.disabled = false;
  
      btn.innerHTML =
        '<i class="ti ti-sparkles" style="font-size:15px; vertical-align:-2px;" aria-hidden="true"></i>Sugerir con IA';
    }
  }
  
  /* ============================================================
     APLICAR SUGERENCIAS
  ============================================================ */
  
  export function applyAISuggestions() {
    const RESULT =
      aiConfig.getResult?.();
  
    if (
      !RESULT?.aiSuggestion?.length
    ) {
      return 0;
    }
  
    const checkboxes =
      document.querySelectorAll(
        '.ai-change-checkbox:checked'
      );
  
    let cambiosAplicados = 0;
  
    checkboxes.forEach(
      (checkbox) => {
        const index =
          Number(
            checkbox.dataset
              .aiIndex
          );
  
        const suggestion =
          RESULT.aiSuggestion[
            index
          ];
  
        if (!suggestion) return;
  
        const suggestionId =
          normalize(
            suggestion.id
          );
  
        if (!suggestionId) {
          console.warn(
            '⚠️ Se ignoró una sugerencia sin ID:',
            suggestion
          );
  
          return;
        }
  
        const record =
          RESULT.records.find(
            (r) =>
              r.index !== 0 &&
              normalizeKey(
                r.id
              ) ===
                normalizeKey(
                  suggestionId
                )
          );
  
        if (!record) {
          console.warn(
            '⚠️ No se encontró el registro para aplicar la sugerencia:',
            suggestion
          );
  
          return;
        }
  
        if (
          record.tipo === 'Raíz' ||
          record.index === 0
        ) {
          return;
        }
  
        const padreOriginal =
          normalize(
            record.parentId
          );
  
        const padreSugerido =
          normalize(
            suggestion.padre_sugerido
          );
  
        const nivelOriginal =
          Number(
            record.level
          );
  
        const nivelSugerido =
          Number(
            suggestion.nivel_sugerido
          );
  
        const tipoOriginal =
          normalize(
            record.tipo
          );
  
        const tipoSugerido =
          normalize(
            suggestion.tipo_sugerido ||
              record.tipo
          );
  
        const cambioPadre =
          padreOriginal !==
          padreSugerido;
  
        const cambioNivel =
          nivelOriginal !==
          nivelSugerido;
  
        const cambioTipo =
          tipoOriginal !==
          tipoSugerido;
  
        const hayCambioReal =
          cambioPadre ||
          cambioNivel ||
          cambioTipo;
  
        if (!hayCambioReal) {
          console.warn(
            'ℹ️ Sugerencia ignorada porque no supone un cambio real:',
            suggestion
          );
  
          return;
        }
  
        if (padreSugerido) {
          const padreExiste =
            RESULT.records.some(
              (r) =>
                normalizeKey(
                  r.id
                ) ===
                  normalizeKey(
                    padreSugerido
                  )
            );
  
          if (!padreExiste) {
            console.warn(
              '⚠️ Sugerencia ignorada: el padre no existe:',
              suggestion
            );
  
            return;
          }
        }
  
        if (
          padreSugerido &&
          normalizeKey(
            record.id
          ) ===
            normalizeKey(
              padreSugerido
            )
        ) {
          console.warn(
            '⚠️ Sugerencia ignorada: el registro sería su propio padre:',
            suggestion
          );
  
          return;
        }
  
        if (padreSugerido) {
          const padreRecord =
            RESULT.records.find(
              (r) =>
                normalizeKey(
                  r.id
                ) ===
                  normalizeKey(
                    padreSugerido
                  )
            );
  
          if (padreRecord) {
            const nivelEsperado =
              Number(
                padreRecord.level
              ) + 1;
  
            if (
              nivelSugerido !==
              nivelEsperado
            ) {
              console.warn(
                '⚠️ Sugerencia ignorada: nivel incompatible con el padre:',
                {
                  id: record.id,
                  padre:
                    padreSugerido,
                  nivelSugerido,
                  nivelEsperado,
                }
              );
  
              return;
            }
          }
        }
  
        record.parentId =
          padreSugerido;
  
        record.level =
          nivelSugerido;
  
        if (
          suggestion.tipo_sugerido
        ) {
          record.tipo =
            suggestion.tipo_sugerido;
        }
  
        suggestion.aplicado =
          true;
  
        cambiosAplicados++;
      }
    );
  
    if (
      cambiosAplicados === 0
    ) {
      return 0;
    }
  
    RESULT.childrenMap =
      aiConfig.buildHierarchyTreeMap(
        RESULT.records
      );
  
    const root =
      RESULT.records[0];
  
    RESULT.roots = [
      root,
      ...RESULT.records.filter(
        (record) =>
          record.index !== 0 &&
          normalizeKey(
            record.parentId
          ) ===
            normalizeKey(
              root.id
            )
      ),
    ];
  
    aiConfig.refreshHierarchyIncidents?.();
  
    aiConfig.renderHierarchyTree?.(
      RESULT
    );
  
    const aiResult =
      document.getElementById(
        'ai-result-jerarquia'
      );
  
    if (aiResult) {
      aiResult.innerHTML = `
        <div class="ai-success-box">
  
          <div class="ai-success-icon">
            <i class="ti ti-circle-check"></i>
          </div>
  
          <div>
            <strong>Cambios aplicados</strong>
  
            <p>
              Se aplicaron
              <strong>${cambiosAplicados}</strong>
              cambios sugeridos por la IA.
            </p>
          </div>
  
        </div>
      `;
    }
  
    const statusLine =
      document.getElementById(
        'status-line'
      );
  
    if (statusLine) {
      statusLine.textContent =
        `✓ Se aplicaron ${cambiosAplicados} cambios de la IA.`;
  
      statusLine.classList.add(
        'success'
      );
    }
  
    return cambiosAplicados;
  }