/* ============================================================
   UTILIDADES
============================================================ */
const $ = (id) => document.getElementById(id);
function normalize(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}
function normalizeKey(v) {
  return normalize(v).toUpperCase();
}
function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function show(el) {
  if (el) el.style.display = '';
}
function hide(el) {
  if (el) el.style.display = 'none';
}
function setStatus(el, msg, type = '') {
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
}

let RESULT = null;
let CURRENT_FILE = null;

/* ============================================================
   LECTURA EXCEL
============================================================ */
async function readExcel(file) {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array', cellDates: true });
}
function findSheet(workbook, name) {
  const target = normalizeKey(name);
  return workbook.SheetNames.find((n) => normalizeKey(n) === target);
}
function findColumn(row, candidates) {
  const keys = Object.keys(row).map((k) => ({
    original: k,
    normalized: normalizeKey(k),
  }));
  for (const c of candidates) {
    const nc = normalizeKey(c);
    const found = keys.find(
      (k) => k.normalized === nc || k.normalized.includes(nc)
    );
    if (found) return found.original;
  }
  return null;
}
function parseHierarchyWorkbook(workbook) {
  const sheetName = findSheet(workbook, 'Input');
  if (!sheetName)
    throw new Error('El archivo debe contener una hoja llamada "Input".');
  const ws = workbook.Sheets[sheetName];
  const rowsWithHeaders = XLSX.utils.sheet_to_json(ws, {
    defval: '',
    raw: false,
  });

  let rows = [];
  if (rowsWithHeaders.length > 0) {
    const first = rowsWithHeaders[0];
    const idCol = findColumn(first, [
      'ID',
      'ID JERARQUIA',
      'ID NODO',
      'CODIGO',
      'CÓDIGO',
    ]);
    const descCol = findColumn(first, [
      'DESCRIPCION',
      'DESCRIPCIÓN',
      'DESCRIPTION',
      'TEXTO',
      'NOMBRE',
    ]);
    if (idCol && descCol) {
      rows = rowsWithHeaders.map((row, i) => ({
        originalRow: i + 2,
        id: normalize(row[idCol]),
        descripcion: normalize(row[descCol]),
      }));
    }
  }
  if (rows.length === 0) {
    const raw = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: false,
    });
    rows = raw.map((row, i) => ({
      originalRow: i + 1,
      id: row[0] !== undefined ? String(row[0]).trim() : '',
      descripcion: row[1] !== undefined ? String(row[1]).trim() : '',
    }));
  }
  rows = rows.filter((r) => r.id !== '' || r.descripcion !== '');
  if (rows.length === 0)
    throw new Error('La hoja "Input" no contiene registros.');
  return rows;
}

/* ============================================================
   CONSTRUCCIÓN DE JERARQUÍA (padre/nivel/tipo)
============================================================ */
function isStructuralId(id, records, currentIndex) {
  const value = normalize(id);
  if (!value) return false;
  const key = normalizeKey(value);
  for (let i = 0; i < records.length; i++) {
    if (i === currentIndex) continue;
    const otherId = normalizeKey(records[i]?.id);
    if (!otherId || otherId === key) continue;
    if (otherId.startsWith(key) && otherId.length > key.length) return true;
  }
  if (value.includes('.')) return true;
  if (value.includes('-') && value.split('-').length > 1) return true;
  if (/^\d+$/.test(value) && value.length <= 4) return true;
  return false;
}
function classifyNode(record, childrenMap, records) {
  const id = normalizeKey(record.id);
  const children = childrenMap.get(id) || [];
  if (children.length > 0) return 'Nodo';
  const index = records.indexOf(record);
  if (isStructuralId(record.id, records, index)) return 'Nodo';
  return 'Posición de cuenta de explotación de consolidación';
}

function calculateLevels(records, hierarchyId) {
  const byId = new Map();
  records.forEach((r) => byId.set(normalizeKey(r.id), r));
  function getLevel(record, visited = new Set()) {
    const key = normalizeKey(record.id);
    if (visited.has(key)) return 0;
    visited.add(key);
    if (!record.parentId) return 0;
    if (normalizeKey(record.parentId) === normalizeKey(hierarchyId)) return 1;
    const parent = byId.get(normalizeKey(record.parentId));
    if (!parent) return 0;
    return getLevel(parent, visited) + 1;
  }
  records.forEach((r) => (r.level = getLevel(r)));
  return records;
}
function processHierarchy(rows, hierarchyId, hierarchyDesc) {
  const incidents = [];
  const mainRoot = {
    index: 0,
    originalRow: '-',
    id: hierarchyId,
    descripcion: hierarchyDesc,
    parentId: '',
    level: 0,
    tipo: 'Raíz',
    valid: true,
  };
  const records = rows.map((row, i) => ({
    index: i + 1,
    originalRow: row.originalRow,
    id: normalize(row.id),
    descripcion: normalize(row.descripcion),
    parentId: '',
    level: 0,
    tipo: '',
    valid: true,
  }));

  records.forEach((record) => {
    if (!record.id) {
      record.valid = false;
      incidents.push({
        severity: 'Error',
        row: record.originalRow,
        id: '',
        message: 'El ID está vacío.',
      });
    }
    if (!record.descripcion) {
      record.valid = false;
      incidents.push({
        severity: 'Error',
        row: record.originalRow,
        id: record.id,
        message: 'La descripción está vacía.',
      });
    }
  });

  const ids = new Map();
  records.forEach((record) => {
    const key = normalizeKey(record.id);
    if (!key) return;
    if (ids.has(key)) {
      record.valid = false;
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

  const allIds = new Set(
    records.filter((r) => r.id).map((r) => normalizeKey(r.id))
  );
  const hierarchyRootId = normalize(hierarchyId);
  let ultimoNodo = '';
  records.forEach((record) => {
    if (!record.id) return;
    if (/^\d{1,6}$/.test(record.id)) {
      if (record.id.length === 1) {
        record.parentId = hierarchyRootId;
      } else {
        const prefix = record.id.slice(0, -1);
        if (allIds.has(normalizeKey(prefix))) {
          record.parentId = prefix;
        } else {
          record.parentId = 'REVISAR';
          record.valid = false;
          incidents.push({
            severity: 'Error',
            row: record.originalRow,
            id: record.id,
            message: `El padre "${prefix}" no existe.`,
          });
        }
      }
      ultimoNodo = record.id;
    } else {
      if (ultimoNodo) {
        record.parentId = ultimoNodo;
      } else {
        record.parentId = 'REVISAR';
        record.valid = false;
        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.id,
          message: 'No se pudo determinar el padre.',
        });
      }
    }
  });

  records.forEach((record) => {
    const parentKey = normalizeKey(record.parentId);
    if (
      record.parentId &&
      record.parentId !== 'REVISAR' &&
      parentKey !== normalizeKey(hierarchyRootId) &&
      !allIds.has(parentKey)
    ) {
      record.valid = false;
      incidents.push({
        severity: 'Error',
        row: record.originalRow,
        id: record.id,
        message: `El padre "${record.parentId}" no existe.`,
      });
    }
  });

  const childrenMap = new Map();
  records.forEach((record) => {
    if (!record.parentId) return;
    const key = normalizeKey(record.parentId);
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key).push(record);
  });

  calculateLevels(records, hierarchyId);
  records.forEach((record) => {
    record.tipo = classifyNode(record, childrenMap, records);
  });

  records.unshift(mainRoot);
  return { records, incidents, childrenMap };
}

function refreshIncidents() {
  if (!RESULT?.records?.length) return;
  const incidents = [];
  const records = RESULT.records.filter((r) => r.index !== 0);
  const hierarchyRootId = normalize(RESULT.records[0]?.id);
  const allIds = new Set(
    records.filter((r) => r.id).map((r) => normalizeKey(r.id))
  );

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
    if (!record.descripcion)
      incidents.push({
        severity: 'Error',
        row: record.originalRow,
        id: record.id,
        message: 'La descripción está vacía.',
      });
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
    if (parentKey !== normalizeKey(hierarchyRootId) && !allIds.has(parentKey)) {
      incidents.push({
        severity: 'Error',
        row: record.originalRow,
        id: record.id,
        message: `El padre "${record.parentId}" no existe.`,
      });
    }
  });

  const ids = new Map();
  records.forEach((record) => {
    const key = normalizeKey(record.id);
    if (!key) return;
    if (ids.has(key))
      incidents.push({
        severity: 'Error',
        row: record.originalRow,
        id: record.id,
        message: `ID duplicado. También aparece en la fila ${ids.get(key)}.`,
      });
    else ids.set(key, record.originalRow);
  });

  RESULT.incidents = incidents;
  renderIncidents($('incidencias-table'), incidents);
  if (incidents.length === 0) show($('clean-msg'));
  else hide($('clean-msg'));
}

/* ============================================================
   RENDER: RESUMEN / ÁRBOL / INCIDENCIAS
============================================================ */
function buildSummary(records, incidents, hierarchyId) {
  const errors = incidents.filter((i) => i.severity === 'Error').length;
  const roots = records.filter(
    (r) => normalizeKey(r.parentId) === normalizeKey(hierarchyId)
  ).length;
  const maxLevel = records.length
    ? Math.max(...records.map((r) => r.level))
    : 0;
  return { total: records.length, errors, roots, levels: maxLevel + 1 };
}
function renderSummary(summary) {
  $('summary-bar').innerHTML = `
    <div class="summary-card"><div class="label">Registros</div><div class="value">${summary.total}</div></div>
    <div class="summary-card"><div class="label">Errores</div><div class="value">${summary.errors}</div></div>
    <div class="summary-card"><div class="label">Raíces</div><div class="value">${summary.roots}</div></div>
    <div class="summary-card"><div class="label">Niveles</div><div class="value">${summary.levels}</div></div>
  `;
}
function renderIncidents(container, incidents) {
  if (!container) return;
  if (!incidents.length) {
    container.innerHTML = '';
    return;
  }
  const rows = incidents
    .map(
      (inc) => `
    <tr class="${inc.severity === 'Error' ? 'problem' : ''}">
      <td>${escapeHtml(inc.severity)}</td><td>${escapeHtml(inc.row)}</td>
      <td>${escapeHtml(inc.id)}</td><td>${escapeHtml(inc.message)}</td>
    </tr>`
    )
    .join('');
  container.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Fila</th><th>ID</th><th>Incidencia</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function buildTreeMap(records) {
  const map = new Map();
  records.forEach((r) => {
    const key = normalizeKey(r.parentId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  map.forEach((children) =>
    children.sort((a, b) => a.originalRow - b.originalRow || 0)
  );
  return map;
}
function createTreeNode(record, childrenMap) {
  const children = childrenMap.get(normalizeKey(record.id)) || [];
  const hasChildren = children.length > 0;
  const wrapper = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'h-node-row' + (record.valid === false ? ' err' : '');

  const toggle = document.createElement('button');
  toggle.className = 'h-toggle' + (hasChildren ? '' : ' leaf');
  toggle.textContent = hasChildren ? '▼' : '•';
  if (!hasChildren) toggle.disabled = true;

  const icon = document.createElement('span');
  icon.className = 'h-icon';
  icon.textContent = hasChildren ? '📁' : '📄';
  const id = document.createElement('span');
  id.className = 'h-id';
  id.textContent = record.id;
  const desc = document.createElement('span');
  desc.className = 'h-desc';
  desc.textContent = record.descripcion;
  const type = document.createElement('span');
  type.className = 'h-type';
  type.textContent = record.tipo;

  row.append(toggle, icon, id, desc, type);
  wrapper.appendChild(row);

  if (hasChildren) {
    const childrenWrap = document.createElement('div');
    childrenWrap.className = 'h-children';
    children.forEach((c) =>
      childrenWrap.appendChild(createTreeNode(c, childrenMap))
    );
    wrapper.appendChild(childrenWrap);
    toggle.addEventListener('click', () => {
      const visible = childrenWrap.style.display !== 'none';
      childrenWrap.style.display = visible ? 'none' : '';
      toggle.textContent = visible ? '▶' : '▼';
    });
  }
  return wrapper;
}
function renderTree() {
  const container = $('hierarchy-tree');
  container.innerHTML = '';
  if (!RESULT?.records?.length) {
    container.innerHTML =
      '<div style="padding:24px;text-align:center;color:var(--muted)">Sin datos.</div>';
    return;
  }
  const treeMap = buildTreeMap(RESULT.records);
  const uniqueRoots = RESULT.records.filter((r) => r.index === 0);
  uniqueRoots.forEach((root) =>
    container.appendChild(createTreeNode(root, treeMap))
  );
}

function updateValidationUI() {
  const hierarchyId = normalize($('f-id').value);
  const summary = buildSummary(RESULT.records, RESULT.incidents, hierarchyId);
  renderSummary(summary);
  renderTree();
  renderIncidents($('incidencias-table'), RESULT.incidents);
  if (RESULT.incidents.length === 0) show($('clean-msg'));
  else hide($('clean-msg'));
  $('gen-status').textContent = RESULT.incidents.some(
    (i) => i.severity === 'Error'
  )
    ? 'Hay incidencias pendientes. Puedes usar el asistente IA o revisar manualmente.'
    : 'Validación completada. El archivo está listo para generar.';
  show($('step3'));
  show($('step4'));
}

/* ============================================================
   TROCEO POR RAMA (con fix de recursión infinita)
============================================================ */
function trocearPorRama(registros, tamanoMaximo) {
  const porId = new Map(registros.map((r) => [r.id, r]));
  const hijosDe = new Map();
  for (const r of registros) {
    const p = r.padre_original || '__RAIZ__';
    if (!hijosDe.has(p)) hijosDe.set(p, []);
    hijosDe.get(p).push(r);
  }
  function recolectarSubarbol(id, visitados = new Set()) {
    if (visitados.has(id)) return [];
    visitados.add(id);
    const nodo = porId.get(id);
    const resultado = nodo ? [nodo] : [];
    const hijos = hijosDe.get(id) || [];
    for (const hijo of hijos)
      resultado.push(...recolectarSubarbol(hijo.id, visitados));
    return resultado;
  }
  function dividirGrupoGrande(grupo, tamanoMaximo) {
    if (grupo.length <= tamanoMaximo) return [grupo];
    const nivelMinimo = Math.min(...grupo.map((r) => r.nivel_original));
    const raices = grupo.filter((r) => r.nivel_original === nivelMinimo);
    if (raices.length === 1) {
      const camino = [raices[0]];
      let actual = raices[0];
      let hijosDirectos = hijosDe.get(actual.id) || [];
      while (hijosDirectos.length === 1) {
        actual = hijosDirectos[0];
        camino.push(actual);
        hijosDirectos = hijosDe.get(actual.id) || [];
      }
      if (hijosDirectos.length === 0) return [grupo];
      const subGrupos = [];
      let primero = true;
      for (const hijo of hijosDirectos) {
        const subArbol = recolectarSubarbol(hijo.id);
        if (primero) {
          subGrupos.push([...camino, ...subArbol]);
          primero = false;
        } else subGrupos.push(subArbol);
      }
      const resultado = [];
      for (const sg of subGrupos) {
        if (sg.length >= grupo.length) resultado.push(sg);
        else resultado.push(...dividirGrupoGrande(sg, tamanoMaximo));
      }
      return resultado;
    }
    const resultado = [];
    for (const raiz of raices) {
      const subArbol = recolectarSubarbol(raiz.id);
      if (subArbol.length >= grupo.length) resultado.push(subArbol);
      else resultado.push(...dividirGrupoGrande(subArbol, tamanoMaximo));
    }
    return resultado;
  }
  const raicesAbsolutas = registros.filter((r) => !r.padre_original);
  const gruposIniciales = raicesAbsolutas.map((raiz) =>
    recolectarSubarbol(raiz.id)
  );
  const idsUsados = new Set(gruposIniciales.flat().map((r) => r.id));
  const huerfanos = registros.filter((r) => !idsUsados.has(r.id));
  if (huerfanos.length) gruposIniciales.push(huerfanos);

  let subGruposFinales = [];
  for (const grupo of gruposIniciales)
    subGruposFinales.push(...dividirGrupoGrande(grupo, tamanoMaximo));

  const bloques = [];
  let actual = [];
  for (const sg of subGruposFinales) {
    if (sg.length >= tamanoMaximo) {
      if (actual.length) {
        bloques.push(actual);
        actual = [];
      }
      bloques.push(sg);
      continue;
    }
    if (actual.length + sg.length > tamanoMaximo) {
      bloques.push(actual);
      actual = [];
    }
    actual.push(...sg);
  }
  if (actual.length) bloques.push(actual);
  return bloques;
}

/* ============================================================
   PROMPT DEL SISTEMA (las 6 reglas validadas)
============================================================ */
const SYSTEM_PROMPT = `Eres un experto en:
- Plan General Contable español.
- Estados financieros.
- Jerarquías contables.
- SAP Group Reporting.
- Jerarquías de posiciones de consolidación.
- Estructuras jerárquicas contables utilizadas en SAP Fiori.

OBJETIVO
Tu función es analizar los registros contables recibidos en formato JSON y determinar
la estructura jerárquica más coherente, detectando inconsistencias en la jerarquía original.

REGLAS DE ANÁLISIS (aplícalas en este orden)

1. INTEGRIDAD REFERENCIAL
   - "padre_original" debe corresponder a un "id" que exista dentro de los registros recibidos.
     Si no existe, márcalo como incidencia "padre_no_encontrado".
   - Si "padre_original" está vacío y el nodo no es raíz, márcalo como "padre_faltante".

2. COHERENCIA DE NIVELES
   - "nivel_original" debe ser igual al nivel de su padre + 1.
   - Si no se cumple, sugiere "nivel_sugerido" = nivel del padre (real o corregido) + 1.

3. IDS DUPLICADOS - DETECCIÓN
   - Si dos o más registros comparten "id", márcalos con incidencia "id_duplicado".

4. IDS DUPLICADOS - MANEJO OBLIGATORIO (prevalece sobre cualquier otra regla)
   - Si un "id" aparece más de una vez: para TODOS los registros con ese id (y los que lo
     tengan como padre_original), NO propongas cambios de padre_sugerido ni nivel_sugerido.
   - "padre_sugerido" = "padre_original", "nivel_sugerido" = "nivel_original",
     "cambio_propuesto" = false, "confianza" = "baja".
   - NUNCA asignes como padre_sugerido un id duplicado.
   - La resolución requiere corrección manual en el archivo origen, nunca inferencia automática.

5. INFERENCIA POR DESCRIPCIÓN Y CÓDIGO (PGC) — incluye detección de RAMA INCORRECTA
   - Aunque el padre_original exista y el nivel sea coherente, analiza si la rama jerárquica
     (Activo/Pasivo/Patrimonio Neto, o equivalente) corresponde a la naturaleza contable de
     la descripción y el código/prefijo PGC del nodo.
   - Si detectas que un nodo está colgado en la rama equivocada (ej. una cuenta de Pasivo
     bajo un nodo de Activo), sugiere el padre correcto dentro de la rama correspondiente,
     "cambio_propuesto" = true, y genera una incidencia "rama_incorrecta".
   - Los grupos 4 y 5 del PGC son ambiguos; si no hay señal clara, confianza "baja".

6. TIPOS VÁLIDOS (lista cerrada — NUNCA generar valores fuera de esta lista)
   Los únicos valores permitidos para "tipo_original" y "tipo_sugerido" son, EXACTAMENTE:
   - "Raíz"
   - "Nodo"
   - "Posición de cuenta de explotación de consolidación"
   NUNCA inventes variantes (ej. "Posición de balance de consolidación"). Si el tipo original
   ya es válido y coherente con la posición del nodo (raíz/intermedio/hoja), mantenlo igual,
   aunque conceptualmente distingas Balance vs P&L — el sistema no admite esa distinción.

REGLAS DE DECISIÓN
- "cambio_propuesto" = true ÚNICAMENTE si padre_sugerido, nivel_sugerido o tipo_sugerido
  difieren de los valores "_original".
- "confianza": "alta" (integridad referencial clara o código PGC exacto), "media"
  (inferencia por descripción sin coincidencia exacta), "baja" (sin señal suficiente, o
  afectado por la regla 4).
- NUNCA inventes un id que no exista en la lista recibida.

FORMATO DE SALIDA (exacto, sin texto adicional, sin markdown, sin comentarios)
Cada elemento de "registros" DEBE contener EXACTAMENTE estos campos, en este orden:
"id","descripcion","padre_original","nivel_original","tipo_original",
"padre_sugerido","nivel_sugerido","tipo_sugerido","cambio_propuesto","confianza","explicacion"

"incidencias" debe existir siempre como array (puede estar vacío). CADA elemento debe ser
un objeto con esta estructura EXACTA — nunca un string suelto:
{"id":"...","tipo_incidencia":"padre_no_encontrado | padre_faltante | id_duplicado | rama_incorrecta | ambiguedad_pgc","detalle":"..."}

Responde EXCLUSIVAMENTE con este objeto JSON:
{"registros":[{"id":"...","descripcion":"...","padre_original":"...","nivel_original":0,"tipo_original":"...","padre_sugerido":"...","nivel_sugerido":0,"tipo_sugerido":"...","cambio_propuesto":false,"confianza":"alta","explicacion":"..."}],"incidencias":[]}

No añadas texto antes ni después del JSON. No uses bloques de markdown.`;

/* ============================================================
   LLAMADA DIRECTA A LA API DE CLAUDE
============================================================ */
async function callClaude(bloqueRegistros) {
  const apiKey = $('api-key').value.trim();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (apiKey) headers['anthropic-version'] = '2023-06-01';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ registros: bloqueRegistros }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error API (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((c) => c.type === 'text');
  if (!textBlock) throw new Error('La respuesta no contiene texto.');

  let raw = textBlock.text.trim();
  raw = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      'No se pudo parsear el JSON devuelto por la IA: ' + e.message
    );
  }

  if (!Array.isArray(parsed.registros))
    throw new Error('La respuesta no contiene el array "registros".');
  return parsed;
}

/* ============================================================
   FLUJO PRINCIPAL DE ANÁLISIS IA
============================================================ */
async function suggestWithAI() {
  const btn = $('btn-ai');
  const statusLine = $('status-line');
  const badge = $('ai-status-badge');
  const progressWrap = $('ai-progress-wrap');
  const progressFill = $('ai-progress-fill');

  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> Analizando...';
  badge.textContent = 'Analizando';
  badge.className = 'badge media';
  show(progressWrap);
  progressFill.style.width = '0%';

  const estructuraIA = RESULT.records
    .filter((r) => r.index !== 0)
    .map((x) => ({
      id: String(x.id ?? '').trim(),
      descripcion: String(x.descripcion ?? '').trim(),
      // 'REVISAR' es un marcador interno para "padre no determinado"; no es un
      // ID real, así que se envía vacío para que la IA lo trate como padre_faltante.
      padre_original:
        normalizeKey(x.parentId) === 'REVISAR'
          ? ''
          : String(x.parentId ?? '').trim(),
      nivel_original: Number(x.level ?? 0),
      tipo_original: String(x.tipo ?? '').trim(),
    }));

  if (!estructuraIA.length) {
    statusLine.textContent = 'No hay registros para analizar.';
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-bulb"></i> Sugerir con IA';
    hide(progressWrap);
    return;
  }

  const CHUNK_SIZE = 30;
  const bloques = trocearPorRama(estructuraIA, CHUNK_SIZE);

  const todosLosRegistros = [];
  const todasLasIncidencias = [];

  try {
    for (let i = 0; i < bloques.length; i++) {
      const bloque = bloques[i];
      statusLine.textContent = `Analizando bloque ${i + 1} de ${
        bloques.length
      } (${bloque.length} registros)...`;
      progressFill.style.width = `${Math.round((i / bloques.length) * 100)}%`;

      const data = await callClaude(bloque);
      todosLosRegistros.push(...data.registros);
      if (Array.isArray(data.incidencias))
        todasLasIncidencias.push(...data.incidencias);

      progressFill.style.width = `${Math.round(
        ((i + 1) / bloques.length) * 100
      )}%`;
    }

    const idsOriginales = new Set(estructuraIA.map((x) => x.id));
    const hierarchyRootIdNow = normalize($('f-id').value);
    if (hierarchyRootIdNow) idsOriginales.add(hierarchyRootIdNow);

    const resultadoIA = todosLosRegistros.map((item) => {
      const id = String(item.id ?? '').trim();
      const padre = String(item.padre_sugerido ?? '').trim();
      if (!idsOriginales.has(id))
        throw new Error(`La IA devolvió un ID inexistente: ${id}`);
      if (padre && !idsOriginales.has(padre))
        throw new Error(
          `La IA asignó un padre inexistente: ${padre} para ${id}`
        );
      return {
        id,
        descripcion: String(item.descripcion ?? '').trim(),
        padre_original: String(item.padre_original ?? '').trim(),
        nivel_original: Number(item.nivel_original ?? 0),
        tipo_original: String(item.tipo_original ?? '').trim(),
        padre_sugerido: padre,
        nivel_sugerido: Number.isFinite(Number(item.nivel_sugerido))
          ? Number(item.nivel_sugerido)
          : 0,
        tipo_sugerido: String(item.tipo_sugerido ?? '').trim(),
        cambio_propuesto: item.cambio_propuesto === true,
        confianza: item.confianza || 'baja',
        explicacion: item.explicacion || '',
      };
    });

    if (resultadoIA.length !== estructuraIA.length) {
      throw new Error(
        `La IA devolvió ${resultadoIA.length} registros, pero se enviaron ${estructuraIA.length}.`
      );
    }

    RESULT.aiSuggestion = resultadoIA;
    RESULT.aiIncidencias = todasLasIncidencias;

    const cambios = resultadoIA.filter((i) => i.cambio_propuesto === true);
    renderAIResult(resultadoIA, cambios, todasLasIncidencias);

    badge.textContent = 'Listo';
    badge.className = 'badge alta';
    statusLine.textContent =
      cambios.length === 0 && todasLasIncidencias.length === 0
        ? `✓ Todo está correcto. Se analizaron ${resultadoIA.length} registros.`
        : `Análisis de ${resultadoIA.length} registros completado. Revisa los ${cambios.length} cambios propuestos.`;
    statusLine.classList.add('success');
  } catch (err) {
    console.error('Error analizando con IA:', err);
    statusLine.textContent = 'Error: ' + err.message;
    badge.textContent = 'Error';
    badge.className = 'badge baja';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-bulb"></i> Sugerir con IA';
    hide(progressWrap);
  }
}

function renderAIResult(resultadoIA, cambios, incidencias) {
  const aiResult = $('ai-result');
  let html = '';

  if (incidencias.length) {
    html += `<h3 style="margin-top:0">Incidencias detectadas (${incidencias.length})</h3>`;
    html += `<div class="table-wrap" style="margin-bottom:14px"><table><thead><tr><th>ID</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>`;
    html += incidencias
      .map(
        (inc) => `
      <tr><td>${escapeHtml(inc.id)}</td>
      <td><span class="incident-badge">${escapeHtml(
        inc.tipo_incidencia
      )}</span></td>
      <td>${escapeHtml(inc.detalle)}</td></tr>`
      )
      .join('');
    html += `</tbody></table></div>`;
  }

  if (cambios.length === 0 && incidencias.length === 0) {
    html += `<div class="success-msg" style="margin-top:0"><i class="ti ti-circle-check"></i> No se encontraron cambios necesarios.</div>`;
  } else if (cambios.length > 0) {
    html += `<h3>Cambios propuestos (${cambios.length})</h3>`;
    html += `<div class="table-wrap"><table><thead><tr><th></th><th>ID</th><th>Padre actual</th><th>Padre sugerido</th><th>Nivel</th><th>Tipo sugerido</th><th>Confianza</th></tr></thead><tbody>`;
    html += cambios
      .map((item) => {
        const idx = resultadoIA.indexOf(item);
        return `<tr class="change-row">
        <td><input type="checkbox" class="ai-change-checkbox" data-ai-index="${idx}" checked /></td>
        <td><strong>${escapeHtml(item.id)}</strong></td>
        <td>${escapeHtml(item.padre_original || 'Sin padre')}</td>
        <td><strong>${escapeHtml(
          item.padre_sugerido || 'Sin padre'
        )}</strong></td>
        <td>${item.nivel_original} → <strong>${
          item.nivel_sugerido
        }</strong></td>
        <td>${escapeHtml(item.tipo_sugerido)}</td>
        <td><span class="badge ${item.confianza}">${escapeHtml(
          item.confianza
        )}</span></td>
      </tr>
      <tr><td></td><td colspan="6" style="font-size:11px;color:var(--muted);padding-top:0;">${escapeHtml(
        item.explicacion
      )}</td></tr>`;
      })
      .join('');
    html += `</tbody></table></div>`;
    html += `<div class="action-row"><button id="btn-apply-ai" class="primary" type="button"><i class="ti ti-check"></i> Aplicar cambios seleccionados</button></div>`;
  }

  aiResult.innerHTML = html;

  const btnApply = $('btn-apply-ai');
  if (btnApply) btnApply.addEventListener('click', applyAISuggestions);
}

function applyAISuggestions() {
  if (!RESULT?.aiSuggestion?.length) return 0;
  const checkboxes = document.querySelectorAll('.ai-change-checkbox:checked');
  let aplicados = 0;

  checkboxes.forEach((cb) => {
    const idx = Number(cb.dataset.aiIndex);
    const sug = RESULT.aiSuggestion[idx];
    if (!sug) return;
    const record = RESULT.records.find(
      (r) => normalizeKey(r.id) === normalizeKey(sug.id)
    );
    if (!record || record.index === 0) return;

    record.parentId = normalize(sug.padre_sugerido);
    record.level = Number(sug.nivel_sugerido);
    if (sug.tipo_sugerido) record.tipo = sug.tipo_sugerido;
    aplicados++;
  });

  if (aplicados === 0) return 0;

  refreshIncidents();
  renderTree();
  renderSummary(
    buildSummary(RESULT.records, RESULT.incidents, normalize($('f-id').value))
  );

  $(
    'ai-result'
  ).innerHTML = `<div class="success-msg" style="margin-top:0"><i class="ti ti-circle-check"></i> Se aplicaron ${aplicados} cambios sugeridos por la IA.</div>`;
  $('status-line').textContent = `✓ Se aplicaron ${aplicados} cambios.`;
  return aplicados;
}

/* ============================================================
   EXPORTAR EXCEL (formato Fiori exacto, con hoja Validation oculta)
============================================================ */
function buildHierarchyFioriData() {
  if (!RESULT) throw new Error('No existe información procesada.');

  const hierarchyId = normalize($('f-id').value);
  const hierarchyDescription = normalize($('f-desc').value);
  const validFrom = normalize($('f-inicio').value);
  const validTo = normalize($('f-fin').value);
  const coa = normalize($('f-coa').value);

  const header = {
    'ID Jerarquía': hierarchyId,
    'Descripción jerarquía': hierarchyDescription,
    'Inicio de validez': validFrom,
    'Fin de validez': validTo,
    'COA de consolidación': coa,
  };

  const data = RESULT.records
    .filter((r) => r.index !== 0)
    .map((record) => ({
      ID: record.id,
      Descripción: record.descripcion,
      Padre: record.parentId,
      Nivel: record.level,
      Tipo: record.tipo,
    }));

  return { header, data };
}

function buildJson1(idJerarquia, descJerarquia) {
  return JSON.stringify({
    CLIENT: '',
    VER_ID: '',
    VER_PID: '',
    VER_STATUS: 'S',
    VER_VLDFM: '00000000',
    VER_VLDTO: '00000000',
    VER_MSG: '',
    VER_NBR: '',
    VER_IDX: '000000000000001',
    HIER_HID: idJerarquia,
    HIER_CATG: 'CS15',
    UPDATED_AT: null,
    UPDATED_BY: '',
    CREATED_AT: null,
    CREATED_BY: '',
    LOCKED_BY: '',
    LOCKED_AT: null,
    ALLOW_LEGACY_TCODE_USAGE: '',
    VER_SRC: '',
    MAINTENANCE_LANG: 'S',
    REF_UPDATED_AT: 0,
    CREATED_ON: '',
    CATEGORYTEXT: 'Posición de cuenta de explotación de consolidación',
    HIER_DESC: descJerarquia,
    HRY_CLASS: '',
    STATUSTEXT: '',
    SIMULATE_REPORT_ID: '',
    ACTIVE_REPORT_ID: '',
    IS_UNASSIGNED_SHOW: '',
    IS_RANGE_SUPPORTED: '',
    HIDE_VALIDITY: '',
    ATTRIBUTEVALUES: '',
    LOCK_HIER_ATTR_EDIT: '',
    HIERARCHY_TAG: '',
    HIERARCHY_TAG_TEXT: '',
    HAS_REFERENCE_NODE: '',
    ISPRIVATE: '',
  });
}

function buildJson2(planCuentas) {
  return JSON.stringify([
    {
      CLIENT: '',
      OBJ_ID: '',
      FLD_NAME: 'CONSOLIDATIONCHARTOFACCOUNTS',
      VAL_SIGN: 'S',
      VAL_LOW: planCuentas,
      VAL_HIGH: '',
      VER_ID: '',
      VAL_LOW_TEXT: 'Plan de cuentas consolidación',
      VAL_HIGH_TEXT: '',
      LANG: '',
    },
  ]);
}

async function downloadWorkbook(data, filename) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Jerarquía');

  worksheet.getCell('A1').value =
    'Posición de cuenta de explotación de consolidación';
  worksheet.getCell('A1').font = {
    name: 'Aptos Narrow',
    size: 11,
    bold: true,
    color: { argb: '000000' },
  };

  const fields = [
    ['ID de jerarquía:', 'ID Jerarquía'],
    ['Inicio de validez:', 'Inicio de validez'],
    ['Fin de validez:', 'Fin de validez'],
    ['COA de consolidación:', 'COA de consolidación'],
  ];
  fields.forEach(([label, key], index) => {
    const row = index + 2;
    worksheet.getCell(`A${row}`).value = label;
    worksheet.getCell(`B${row}`).value = data.header[key];
    worksheet.getRow(row).eachCell((cell) => {
      cell.font = { name: 'Aptos Narrow', size: 11 };
    });
  });

  const technicalHeaders = [
    'Posición de cuenta de explotación de consolidación',
    'Nivel',
    'Tipo',
    'ID',
    'Descripción',
    'ID principal',
    'Cambio de signo',
  ];
  worksheet.getRow('7').values = technicalHeaders;
  worksheet.getRow(7).eachCell((cell) => {
    cell.font = { name: 'Aptos Narrow', size: 11, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
  });

  // Fila 8: raíz de la jerarquía — texto descriptivo en A8 y también sus
  // columnas técnicas (Tipo/ID/Descripción), igual que el resto de nodos.
  const hierarchyId = data.header['ID Jerarquía'];
  const hierarchyDescription = data.header['Descripción jerarquía'];
  worksheet.getCell('A8').value = `|-${hierarchyId} (${hierarchyDescription})`;
  worksheet.getCell('C8').value = 'Raíz';
  worksheet.getCell('D8').value = hierarchyId;
  worksheet.getCell('E8').value = hierarchyDescription;

  // Los datos empiezan en la fila 9.
  data.data.forEach((record, index) => {
    const row = index + 9;
    worksheet.getCell(`C${row}`).value = record.Tipo;
    worksheet.getCell(`D${row}`).value = record.ID;
    worksheet.getCell(`E${row}`).value = record.Descripción;
    worksheet.getCell(`F${row}`).value = record.Padre;
  });

  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const length = cell.value ? String(cell.value).length : 0;
      if (length > maxLength) maxLength = length;
    });
    column.width = maxLength + 2;
  });

  const worksheetValidation = workbook.addWorksheet('Validation');
  const validationData = [
    ['Nodo', 'Posición de cuenta de explotación de consolidación', 'Raíz'],
    [
      buildJson1(
        data.header['ID Jerarquía'],
        data.header['Descripción jerarquía']
      ),
      buildJson2(data.header['COA de consolidación']),
    ],
    ['8'],
    ['F'],
    [],
    ['', '', 'E', 'S', 'G', 'SIGN', 'B', 'SIGN', ''],
    ['', '', '', '', '', '', '', 'SIGN', 'X'],
  ];
  validationData.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      worksheetValidation.getCell(rowIndex + 1, colIndex + 1).value = value;
    });
  });
  worksheetValidation.state = 'hidden';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function generateHierarchyFile() {
  if (!RESULT) {
    alert('Primero debes procesar el archivo.');
    return;
  }
  try {
    const data = buildHierarchyFioriData();
    const hierarchyId = normalize($('f-id').value) || 'JERARQUIA';
    const filename = `Fiori_Jerarquia_${hierarchyId}.xlsx`;
    await downloadWorkbook(data, filename);
    $('gen-status').textContent = `Archivo generado correctamente: ${filename}`;
  } catch (error) {
    console.error(error);
    alert(`No fue posible generar el archivo:\n${error.message}`);
  }
}

/* ============================================================
   INIT
============================================================ */
function initDropzone(inputId) {
  const input = $(inputId);
  const label = document.querySelector(`label[for="${inputId}"]`);
  if (!input || !label) return;
  ['dragenter', 'dragover'].forEach((ev) =>
    label.addEventListener(ev, (e) => {
      e.preventDefault();
      label.style.borderColor = 'var(--blue)';
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    label.addEventListener(ev, (e) => {
      e.preventDefault();
      label.style.borderColor = '';
    })
  );
  label.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
}

async function processHierarchyFile() {
  if (!CURRENT_FILE) {
    alert('Selecciona primero un archivo Excel.');
    return;
  }
  const button = $('btn-process');
  button.disabled = true;
  setStatus($('file-status'), 'Procesando archivo...');

  try {
    const workbook = await readExcel(CURRENT_FILE);
    const rows = parseHierarchyWorkbook(workbook);
    const hierarchyId = normalize($('f-id').value);
    const hierarchyDesc = normalize($('f-desc').value);

    RESULT = processHierarchy(rows, hierarchyId, hierarchyDesc);
    updateValidationUI();
    setStatus(
      $('file-status'),
      `${rows.length} registros procesados correctamente.`,
      'success'
    );
  } catch (error) {
    console.error(error);
    RESULT = null;
    hide($('step3'));
    hide($('step4'));
    setStatus($('file-status'), error.message, 'error');
    alert(`No fue posible procesar el archivo:\n\n${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function init() {
  initDropzone('file-input');

  $('file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    CURRENT_FILE = file;
    RESULT = null;
    hide($('step3'));
    hide($('step4'));
    $('btn-process').disabled = false;
    setStatus($('file-status'), `Archivo seleccionado: ${file.name}`);
  });

  $('btn-process').addEventListener('click', processHierarchyFile);
  $('btn-ai').addEventListener('click', suggestWithAI);
  $('btn-generate').addEventListener('click', generateHierarchyFile);
}
init();
