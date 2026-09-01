import './style.css';

/* ============================================================
   GENERADOR SAP GROUP REPORTING
   main.js
   ============================================================

   Dependencia:
   SheetJS ya está cargado desde el HTML mediante CDN.

   Funcionalidades:
   - Generador de jerarquía
   - Generador de plan de cuentas
   - Lectura Excel
   - Validaciones
   - Resumen
   - Incidencias
   - Generación Fiori
   ============================================================ */

/* ============================================================
   VARIABLES GLOBALES
============================================================ */

let RAW_DATA = [];
let CUENTAS_MAP = new Map();
let RESULT = null;
let CURRENT_FILE = null;

let PLAN_RAW_DATA = [];
let PLAN_RESULT = null;
let PLAN_CURRENT_FILE = null;
const MEASURE_MAP = {
  LEQ: { codigo: '1F10', detalle: 'TT915/904/906/920/940/992P' },
  AST: { codigo: '1D10', detalle: 'TT915/925/935P' },
  EXP: { codigo: '2A10', detalle: 'FA (YB99) P opt' },
  INC: { codigo: '2A10', detalle: 'FA (YB99) P opt' },
};

const CONVERSION_MAP = {
  LEQ: { codigo: 'S-CT-BS-CLO', detalle: 'Posiciones B/S - tasas cierre' },
  AST: { codigo: 'S-CT-BS-CLO', detalle: 'Posiciones B/S - tasas cierre' },
  EXP: { codigo: 'S-CT-PL-AVG', detalle: 'Posiciones PyG - cotiz.media' },
  INC: { codigo: 'S-CT-PL-AVG', detalle: 'Posiciones PyG - cotiz.media' },
};
/* ============================================================
   UTILIDADES GENERALES
============================================================ */

const $ = (id) => document.getElementById(id);

function normalize(value) {
  if (value === null || value === undefined) return '';

  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeKey(value) {
  return normalize(value).toUpperCase();
}

function isEmpty(value) {
  return normalize(value) === '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setStatus(element, message, type = '') {
  if (!element) return;

  element.textContent = message;
  element.className = `status ${type}`;
}

function show(element) {
  if (element) element.style.display = '';
}

function hide(element) {
  if (element) element.style.display = 'none';
}

function scrollToElement(element) {
  if (!element) return;

  setTimeout(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, 100);
}

/* ============================================================
   MODO DE TRABAJO
============================================================ */

function initModes() {
  const btnJerarquia = $('accordion-jerarquia');
  const btnPlan = $('accordion-plan');

  const panelJerarquia = $('panel-jerarquia');
  const panelPlan = $('panel-plan');

  btnJerarquia?.addEventListener('click', () => {
    btnJerarquia.classList.add('active');
    btnPlan?.classList.remove('active');

    if (panelJerarquia) panelJerarquia.style.display = '';
    if (panelPlan) panelPlan.style.display = 'none';
  });

  btnPlan?.addEventListener('click', () => {
    btnPlan.classList.add('active');
    btnJerarquia?.classList.remove('active');

    if (panelPlan) panelPlan.style.display = '';
    if (panelJerarquia) panelJerarquia.style.display = 'none';
  });
}

/* ============================================================
   LECTURA DE EXCEL
============================================================ */

async function readExcel(file) {
  if (!file) {
    throw new Error('No se recibió ningún archivo.');
  }

  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
  });

  return workbook;
}

function findSheet(workbook, sheetName) {
  const target = normalizeKey(sheetName);

  return workbook.SheetNames.find((name) => normalizeKey(name) === target);
}

function sheetToRows(workbook, sheetName, options = {}) {
  const realSheetName = findSheet(workbook, sheetName);

  if (!realSheetName) {
    throw new Error(`No se encontró la hoja "${sheetName}".`);
  }

  const worksheet = workbook.Sheets[realSheetName];

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: options.defval ?? '',
    raw: false,
    header: options.header,
  });
}

/* ============================================================
   DETECCIÓN FLEXIBLE DE COLUMNAS
============================================================ */

function findColumn(row, candidates) {
  const keys = Object.keys(row);

  const normalizedKeys = keys.map((key) => ({
    original: key,
    normalized: normalizeKey(key),
  }));

  for (const candidate of candidates) {
    const c = normalizeKey(candidate);

    const found = normalizedKeys.find(
      (item) => item.normalized === c || item.normalized.includes(c)
    );

    if (found) {
      return found.original;
    }
  }

  return null;
}

/* ============================================================
   JERARQUÍA
============================================================ */
function limpiarId(id) {
  return String(id ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '');
}
function parseHierarchyWorkbook(workbook) {
  const sheetName = findSheet(workbook, 'Input');

  if (!sheetName) {
    throw new Error('El archivo debe contener una hoja llamada "Input".');
  }

  const worksheet = workbook.Sheets[sheetName];

  /*
   * Primero intentamos leer como tabla con encabezados.
   */

  const rowsWithHeaders = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  let rows = [];

  /*
   * Si existen encabezados reconocibles,
   * utilizamos esos encabezados.
   */

  if (rowsWithHeaders.length > 0) {
    const first = rowsWithHeaders[0];

    const idColumn = findColumn(first, [
      'ID',
      'ID JERARQUIA',
      'ID NODO',
      'CODIGO',
      'CÓDIGO',
    ]);

    const descColumn = findColumn(first, [
      'DESCRIPCION',
      'DESCRIPCIÓN',
      'DESCRIPTION',
      'TEXTO',
      'NOMBRE',
    ]);

    if (idColumn && descColumn) {
      rows = rowsWithHeaders.map((row, index) => ({
        originalRow: index + 2,
        id: limpiarId(row[idColumn]),
        descripcion: normalize(row[descColumn]),
      }));
    }
  }

  /*
   * Compatibilidad con la estructura de VBA:
   *
   * B = ID
   * C = Descripción
   *
   * Sin encabezado.
   */

  if (rows.length === 0) {
    const raw = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    rows = raw.map((row, index) => {
      return {
        originalRow: index + 1,
        id: row[0] !== undefined ? limpiarId(row[0]) : '',
        descripcion: row[1] !== undefined ? String(row[1]).trim() : '',
      };
    });
  }

  // Ignorar filas completamente vacías
  rows = rows.filter((row) => row.id !== '' || row.descripcion !== '');

  if (rows.length === 0) {
    throw new Error('La hoja "Input" no contiene registros.');
  }

  return rows;

  if (rows.length === 0) {
    throw new Error('La hoja "Input" no contiene registros.');
  }

  return rows;
}

/* ============================================================
   CUENTAS
============================================================ */

function parseCuentasWorkbook(workbook) {
  const sheetName = findSheet(workbook, 'Cuentas');

  if (!sheetName) {
    return new Map();
  }

  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  if (!rows.length) {
    return new Map();
  }

  const first = rows[0];

  const idColumn = findColumn(first, [
    'ID',
    'CUENTA',
    'CUENTA CONTABLE',
    'CODIGO',
    'CÓDIGO',
  ]);

  const descColumn = findColumn(first, [
    'DESCRIPCION',
    'DESCRIPCIÓN',
    'DESCRIPTION',
    'TEXTO',
  ]);

  if (!idColumn || !descColumn) {
    return new Map();
  }

  const map = new Map();

  rows.forEach((row) => {
    const id = normalizeKey(row[idColumn]);
    const description = normalize(row[descColumn]);

    if (id) {
      map.set(id, description);
    }
  });

  return map;
}

/* ============================================================
   DETECCIÓN DE PADRES
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
/* ============================================================
   CÁLCULO DE NIVEL
============================================================ */

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

/* ============================================================
   CLASIFICACIÓN
============================================================ */

function classifyNode(record, childrenMap, records) {
  const id = normalizeKey(record.id);
  const children = childrenMap.get(id) || [];
  if (children.length > 0) return 'Nodo';
  const index = records.indexOf(record);
  if (isStructuralId(record.id, records, index)) return 'Nodo';
  return 'Posición de cuenta de explotación de consolidación';
}
/* ============================================================
   PROCESAMIENTO JERARQUÍA
============================================================ */

function processHierarchy(rows, cuentasMap, hierarchyId, hierarchyDesc) {
  const incidents = [];

  /* ==========================================================
     RAÍZ PRINCIPAL
  ========================================================== */

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

  /* ==========================================================
     REGISTROS
  ========================================================== */

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

  /* ==========================================================
     OBLIGATORIOS
  ========================================================== */

  records.forEach((record) => {
    // ID obligatorio
    if (!record.id) {
      record.valid = false;

      incidents.push({
        severity: 'Error',
        row: record.originalRow,
        id: '',
        message: 'El ID está vacío.',
      });
    }

    // DESCRIPCIÓN
    if (!record.descripcion) {
      // Intentar recuperar descripción desde Cuentas
      const cuentaDescription = cuentasMap?.get(normalizeKey(record.id));

      if (cuentaDescription) {
        record.descripcion = cuentaDescription;
      } else {
        record.valid = false;

        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.id,
          message: 'La descripción está vacía.',
        });
      }
    }
  });

  /* ==========================================================
     DUPLICADOS
  ========================================================== */

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

  /* ==========================================================
     IDs EXISTENTES
  ========================================================== */

  const allIds = new Set(
    records
      .filter((record) => record.id)
      .map((record) => normalizeKey(record.id))
  );

  const hierarchyRootId = normalize(hierarchyId);

  /* ==========================================================
     CONSTRUIR PADRES
     
     NODO:
       1      → raíz
       11     → padre 1
       111    → padre 11
       211    → padre 21

     CUENTA / HOJA:
       pertenece al último nodo encontrado.
  ========================================================== */

  let ultimoNodo = '';

  records.forEach((record) => {
    if (!record.id) return;

    /* --------------------------------------------------------
       NODO: entre 1 y 6 dígitos
    -------------------------------------------------------- */

    if (/^\d{1,6}$/.test(record.id)) {
      // Primer nivel
      if (record.id.length === 1) {
        record.parentId = hierarchyRootId;
      } else {
        // Padre = quitar último dígito
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

      // Este nodo pasa a ser el padre de las cuentas siguientes
      ultimoNodo = record.id;

      return;
    }

    /* --------------------------------------------------------
       CUENTA / HOJA
    -------------------------------------------------------- */

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
  });

  /* ==========================================================
     VALIDAR PADRES
  ========================================================== */

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

  /* ==========================================================
     HIJOS
  ========================================================== */

  const childrenMap = new Map();

  records.forEach((record) => {
    if (!record.parentId) return;

    const key = normalizeKey(record.parentId);

    if (!childrenMap.has(key)) {
      childrenMap.set(key, []);
    }

    childrenMap.get(key).push(record);
  });

  /* ==========================================================
     NIVELES
  ========================================================== */

  calculateLevels(records, hierarchyId);

  /* ==========================================================
     TIPO
  ========================================================== */

  records.forEach((record) => {
    record.tipo = classifyNode(record, childrenMap, records);
  });

  /* ==========================================================
     RAÍCES
  ========================================================== */

  const roots = [mainRoot];

  const firstLevelNodes = records.filter(
    (record) => normalizeKey(record.parentId) === normalizeKey(mainRoot.id)
  );

  roots.push(...firstLevelNodes);

  if (firstLevelNodes.length === 0 && records.length > 0) {
    incidents.push({
      severity: 'Error',
      row: '-',
      id: '-',
      message:
        'No se encontró ningún nodo raíz. La estructura puede contener un ciclo.',
    });
  }

  /* ==========================================================
     CICLOS
  ========================================================== */

  records.forEach((record) => {
    const visited = new Set();

    let current = record;

    while (current?.parentId) {
      const currentKey = normalizeKey(current.id);

      if (visited.has(currentKey)) {
        record.valid = false;

        incidents.push({
          severity: 'Error',
          row: record.originalRow,
          id: record.id,
          message: 'Se detectó un ciclo en la jerarquía.',
        });

        break;
      }

      visited.add(currentKey);

      // Si llega a la raíz, terminamos
      if (normalizeKey(current.parentId) === normalizeKey(hierarchyRootId)) {
        break;
      }

      current = records.find(
        (r) => normalizeKey(r.id) === normalizeKey(current.parentId)
      );

      // Padre inexistente
      if (!current) {
        break;
      }
    }
  });

  /* ==========================================================
     AGREGAR RAÍZ AL PRINCIPIO
  ========================================================== */

  records.unshift(mainRoot);

  /* ==========================================================
     RESULTADO
  ========================================================== */

  return {
    records,
    incidents,
    roots,
    childrenMap,
  };
}

function refreshHierarchyIncidents() {
  if (!RESULT?.records?.length) {
    return;
  }

  const incidents = [];

  const records = RESULT.records.filter((record) => record.index !== 0);

  const hierarchyRootId = normalize(RESULT.records[0]?.id);

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

    /*
     * El padre puede ser la raíz principal.
     */

    if (parentKey !== normalizeKey(hierarchyRootId) && !allIds.has(parentKey)) {
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

      /*
       * Llegamos a la raíz principal.
       */

      if (parentKey === normalizeKey(hierarchyRootId)) {
        break;
      }

      current = records.find((r) => normalizeKey(r.id) === parentKey);

      /*
       * Si no existe el padre, ya fue reportado
       * anteriormente.
       */

      if (!current) {
        break;
      }
    }
  });

  /* ============================================================
     GUARDAR NUEVAS INCIDENCIAS
  ============================================================ */

  RESULT.incidents = incidents;

  /*
   * Actualizar tabla visual.
   */

  const incidentsContainer = document.getElementById('incidents');

  if (incidentsContainer) {
    renderIncidents(incidentsContainer, incidents);
  }
}
/* ============================================================
   RESUMEN
============================================================ */

function buildSummary(records, incidents, hierarchyId) {
  const errors = incidents.filter((i) => i.severity === 'Error').length;

  const warnings = incidents.filter((i) => i.severity === 'Warning').length;

  const roots = records.filter(
    (r) => normalizeKey(r.parentId) === normalizeKey(hierarchyId)
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

function renderSummary(container, summary) {
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
function buildHierarchyTreeMap(records) {
  const map = new Map();

  records.forEach((record) => {
    const parentKey = normalizeKey(record.parentId);

    if (!map.has(parentKey)) {
      map.set(parentKey, []);
    }

    map.get(parentKey).push(record);
  });

  /*
   * Ordenamos por el orden original del Excel.
   */

  map.forEach((children) => {
    children.sort((a, b) => {
      return a.originalRow - b.originalRow;
    });
  });

  return map;
}

/*
 * Crea visualmente un nodo y todos sus hijos.
 */

function createHierarchyTreeNode(record, childrenMap, expanded = true) {
  const children = childrenMap.get(normalizeKey(record.id)) || [];

  const hasChildren = children.length > 0;

  const wrapper = document.createElement('div');

  wrapper.className = 'hierarchy-node';

  /*
   * Guardamos información para expandir/contraer.
   */

  wrapper.dataset.id = record.id;

  /*
   * CONTENEDOR DEL NODO
   */

  const nodeRow = document.createElement('div');

  nodeRow.className = 'hierarchy-node-row';

  /*
   * Botón expandir/contraer
   */

  const toggle = document.createElement('button');

  toggle.type = 'button';

  toggle.className = 'hierarchy-toggle';

  if (hasChildren) {
    toggle.textContent = expanded ? '▼' : '▶';
    toggle.title = expanded ? 'Contraer' : 'Expandir';
  } else {
    toggle.textContent = '•';
    toggle.classList.add('leaf');
    toggle.disabled = true;
  }

  /*
   * Icono
   */

  const icon = document.createElement('span');

  icon.className = 'hierarchy-icon';

  icon.textContent = hasChildren ? '📁' : '📄';

  /*
   * ID
   */

  const id = document.createElement('span');

  id.className = 'hierarchy-id';

  id.textContent = record.id;

  /*
   * Descripción
   */

  const description = document.createElement('span');

  description.className = 'hierarchy-description';

  description.textContent = record.descripcion;

  /*
   * Tipo
   */

  const type = document.createElement('span');

  type.className = 'hierarchy-type';

  type.textContent = record.tipo;

  /*
   * Si hay error en el registro
   */

  if (record.valid === false) {
    nodeRow.classList.add('hierarchy-node-error');
  }

  /*
   * Armamos la fila
   */

  nodeRow.appendChild(toggle);
  nodeRow.appendChild(icon);
  nodeRow.appendChild(id);
  nodeRow.appendChild(description);
  nodeRow.appendChild(type);

  wrapper.appendChild(nodeRow);

  /*
   * CONTENEDOR DE HIJOS
   */

  if (hasChildren) {
    const childrenContainer = document.createElement('div');

    childrenContainer.className = 'hierarchy-children';

    if (!expanded) {
      childrenContainer.style.display = 'none';
    }

    children.forEach((child) => {
      const childNode = createHierarchyTreeNode(child, childrenMap, expanded);

      childrenContainer.appendChild(childNode);
    });

    wrapper.appendChild(childrenContainer);

    /*
     * Expandir / contraer
     */

    toggle.addEventListener('click', () => {
      const isVisible = childrenContainer.style.display !== 'none';

      childrenContainer.style.display = isVisible ? 'none' : '';

      toggle.textContent = isVisible ? '▶' : '▼';

      toggle.title = isVisible ? 'Expandir' : 'Contraer';
    });
  }

  return wrapper;
}

/*
 * Renderiza toda la jerarquía.
 */

function renderHierarchyTree(result, expanded = true) {
  const container = $('hierarchy-tree');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!result || !result.records || !result.records.length) {
    container.innerHTML = `
      <div class="hierarchy-empty">
        No hay información para mostrar.
      </div>
    `;

    return;
  }

  /*
   * Construimos mapa padre -> hijos.
   */

  const treeMap = buildHierarchyTreeMap(result.records);

  /*
   * Las raíces son los registros sin padre.
   */

  const hierarchyId = normalize($('f-id')?.value);

  const roots = result.records.filter(
    (record) => normalizeKey(record.parentId) === normalizeKey(hierarchyId)
  );

  /*
   * Las ordenamos igual que el Excel.
   */

  roots.sort((a, b) => {
    return a.originalRow - b.originalRow;
  });

  /*
   * Creamos cada raíz.
   */

  roots.forEach((root) => {
    const node = createHierarchyTreeNode(root, treeMap, expanded);

    container.appendChild(node);
  });

  /*
   * Por seguridad:
   *
   * si existen registros que no quedaron conectados
   * a ninguna raíz, también los mostramos.
   */

  const renderedIds = new Set(roots.map((root) => normalizeKey(root.id)));

  if (!roots.length) {
    container.innerHTML = `
      <div class="hierarchy-empty hierarchy-empty-error">
        ⚠️ No se encontró ninguna raíz en la jerarquía.
      </div>
    `;
  }
}

/*
 * Expande toda la jerarquía.
 */

function expandHierarchyTree() {
  const container = $('hierarchy-tree');

  if (!container) {
    return;
  }

  container.querySelectorAll('.hierarchy-children').forEach((element) => {
    element.style.display = '';
  });

  container
    .querySelectorAll('.hierarchy-toggle:not(.leaf)')
    .forEach((button) => {
      button.textContent = '▼';
      button.title = 'Contraer';
    });
}

/*
 * Contrae toda la jerarquía.
 */

function collapseHierarchyTree() {
  const container = $('hierarchy-tree');

  if (!container) {
    return;
  }

  container.querySelectorAll('.hierarchy-children').forEach((element) => {
    element.style.display = 'none';
  });

  container
    .querySelectorAll('.hierarchy-toggle:not(.leaf)')
    .forEach((button) => {
      button.textContent = '▶';
      button.title = 'Expandir';
    });
}

/* ============================================================
   FIN VISTA PREVIA DE JERARQUÍA
============================================================ */
function renderIncidents(container, incidents) {
  if (!container) return;

  if (!incidents.length) {
    container.innerHTML = '';

    return;
  }

  const rows = incidents
    .map((incident) => {
      const className = incident.severity === 'Error' ? 'problem' : '';

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

function updateHierarchyValidationUI(result) {
  const hierarchyId = normalize($('f-id')?.value);

  const summary = buildSummary(result.records, result.incidents, hierarchyId);

  renderSummary($('summary-bar'), summary);
  renderHierarchyTree(result);
  collapseHierarchyTree();
  renderIncidents($('incidencias-table'), result.incidents);

  if (result.incidents.length === 0) {
    show($('clean-msg'));
  } else {
    hide($('clean-msg'));
  }

  const hasErrors = result.incidents.some((i) => i.severity === 'Error');

  // $('btn-generate').disabled = hasErrors;

  $('gen-status').textContent = hasErrors
    ? 'Corrige las incidencias antes de generar el archivo.'
    : 'Validación completada. El archivo está listo para generar.';

  show($('step3'));
  show($('step4'));
}

/* ============================================================
   GENERACIÓN ARCHIVO FIORI — JERARQUÍA
============================================================ */

function buildHierarchyFioriData() {
  if (!RESULT) {
    throw new Error('No existe información procesada.');
  }

  const hierarchyId = normalize($('f-id')?.value);
  const hierarchyDescription = normalize($('f-desc')?.value);
  const validFrom = normalize($('f-inicio')?.value);
  const validTo = normalize($('f-fin')?.value);
  const coa = normalize($('f-coa')?.value);

  const header = {
    'ID Jerarquía': hierarchyId,
    'Descripción jerarquía': hierarchyDescription,
    'Inicio de validez': validFrom,
    'Fin de validez': validTo,
    'COA de consolidación': coa,
  };

  const data = RESULT.records.map((record) => ({
    ID: record.id,
    Descripción: record.descripcion,
    Padre: record.parentId,
    Nivel: record.level,
    Tipo: record.tipo,
  }));

  return {
    header,
    data,
  };
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

/* ============================================================
   EXPORTAR EXCEL
============================================================ */

async function downloadWorkbook(data, filename, sheetName = 'Fiori') {
  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet('Jerarquía');

  // ========================================================
  // FILA 1 - TÍTULO
  // ========================================================

  worksheet.getCell('A1').value =
    'Posición de cuenta de explotación de consolidación';

  worksheet.getCell('A1').font = {
    name: 'Aptos Narrow',
    size: 11,
    bold: true,
    color: { argb: '000000' },
  };

  // ========================================================
  // INFORMACIÓN DE LA JERARQUÍA
  // ========================================================

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
      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
      };
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
    cell.font = {
      name: 'Aptos Narrow',
      size: 11,
      bold: true,
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
  });
  /* ========================================================
      ESCRIBIR DATOS DESDE FILA 8
    ======================================================== */
  const hierarchyId = data.header['ID Jerarquía'];
  const hierarchyDescription = data.header['Descripción jerarquía'];

  worksheet.getCell('A8').value = `|-${hierarchyId} (${hierarchyDescription})`;
  // worksheet.getCell('C8').value = 'Raíz';
  // worksheet.getCell('D8').value = data.header['ID Jerarquía'];gb
  // worksheet.getCell('E8').value = data.header['Descripción jerarquía'];
  // worksheet.getCell('F8').value = '';

  data.data.forEach((record, index) => {
    const row = index + 8;

    worksheet.getCell(`C${row}`).value = record.Tipo;
    worksheet.getCell(`D${row}`).value = record.ID;
    worksheet.getCell(`E${row}`).value = record.Descripción;
    worksheet.getCell(`F${row}`).value = record.Padre;
  });
  // ========================================================
  // AJUSTAR ANCHO DE COLUMNAS
  // ========================================================

  worksheet.columns.forEach((column) => {
    let maxLength = 0;

    column.eachCell({ includeEmpty: true }, (cell) => {
      const length = cell.value ? String(cell.value).length : 0;

      if (length > maxLength) {
        maxLength = length;
      }
    });

    column.width = maxLength + 2;
  });
  /* ========================================================
      HOJA OCULTA DE VALIDACION
    ======================================================== */
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

  /* ========================================================
       GENERAR ARCHIVO
    ======================================================== */

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

  document.getElementById(
    'plan-gen-status'
  ).textContent = `Archivo generado correctamente: ${filename}`;
}
/* ============================================================
   GENERAR JERARQUÍA
============================================================ */

function generateHierarchyFile() {
  if (!RESULT) {
    alert('Primero debes procesar y validar el archivo.');

    return;
  }

  const errors = RESULT.incidents.filter((i) => i.severity === 'Error');

  // if (errors.length > 0) {
  //   alert(
  //     'No se puede generar el archivo porque existen errores de validación.'
  //   );

  //   return;
  // }

  try {
    const data = buildHierarchyFioriData();

    const hierarchyId = normalize($('f-id')?.value) || 'JERARQUIA';

    const filename = `Fiori_Jerarquia_${hierarchyId}.xlsx`;

    downloadWorkbook(data, filename, 'Hierarchy');

    $('gen-status').textContent = `Archivo generado correctamente: ${filename}`;
  } catch (error) {
    console.error(error);

    alert(`No fue posible generar el archivo:\n${error.message}`);
  }
}

/* ============================================================
   VALIDAR PARÁMETROS JERARQUÍA
============================================================ */

function validateHierarchyParameters() {
  const hierarchyId = normalize($('f-id')?.value);

  const description = normalize($('f-desc')?.value);

  const validFrom = normalize($('f-inicio')?.value);

  const validTo = normalize($('f-fin')?.value);

  const coa = normalize($('f-coa')?.value);

  if (!hierarchyId) {
    alert('Ingresa el ID de la jerarquía.');
    $('f-id')?.focus();
    return false;
  }

  if (!description) {
    alert('Ingresa la descripción de la jerarquía.');
    $('f-desc')?.focus();
    return false;
  }

  if (!validFrom) {
    alert('Ingresa el inicio de validez.');
    $('f-inicio')?.focus();
    return false;
  }

  if (!validTo) {
    alert('Ingresa el fin de validez.');
    $('f-fin')?.focus();
    return false;
  }

  if (!coa) {
    alert('Ingresa el COA de consolidación.');
    $('f-coa')?.focus();
    return false;
  }

  return true;
}

/* ============================================================
   EVENTO PROCESAR JERARQUÍA
============================================================ */

async function processHierarchyFile() {
  if (!validateHierarchyParameters()) {
    return;
  }

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

    const cuentas = parseCuentasWorkbook(workbook);

    RAW_DATA = rows;

    CUENTAS_MAP = cuentas;

    const hierarchyId = normalize($('f-id')?.value);
    const hierarchyDesc = normalize($('f-desc')?.value);

    RESULT = processHierarchy(rows, cuentas, hierarchyId, hierarchyDesc);

    updateHierarchyValidationUI(RESULT);

    setStatus(
      $('file-status'),
      `${rows.length} registros procesados correctamente.`,
      'success'
    );

    scrollToElement($('step3'));
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

/* ============================================================
   INPUT ARCHIVO JERARQUÍA
============================================================ */

function initHierarchyFileInput() {
  const input = $('file-input');

  if (!input) return;

  input.addEventListener('change', (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    CURRENT_FILE = file;

    RESULT = null;

    hide($('step3'));
    hide($('step4'));

    $('btn-process').disabled = false;

    setStatus($('file-status'), `Archivo seleccionado: ${file.name}`);
  });
}

/* ============================================================
   DRAG & DROP
============================================================ */

function initDropzone(inputId) {
  const input = $(inputId);

  if (!input) return;

  const label = document.querySelector(`label[for="${inputId}"]`);

  if (!label) return;

  ['dragenter', 'dragover'].forEach((eventName) => {
    label.addEventListener(eventName, (event) => {
      event.preventDefault();

      label.style.borderColor = 'var(--blue)';
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    label.addEventListener(eventName, (event) => {
      event.preventDefault();

      label.style.borderColor = '';
    });
  });

  label.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files?.[0];

    if (!file) return;

    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(file);

    input.files = dataTransfer.files;

    input.dispatchEvent(new Event('change'));
  });
}

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
    for (const hijo of hijos) {
      resultado.push(...recolectarSubarbol(hijo.id, visitados));
    }
    return resultado;
  }

  function dividirGrupoGrande(grupoRegistros, tamanoMaximo) {
    if (grupoRegistros.length <= tamanoMaximo) {
      return [grupoRegistros];
    }

    const nivelMinimo = Math.min(
      ...grupoRegistros.map((r) => r.nivel_original)
    );
    const raicesDelGrupo = grupoRegistros.filter(
      (r) => r.nivel_original === nivelMinimo
    );

    if (raicesDelGrupo.length === 1) {
      // Camino acumulado de nodos "de paso" (cadena de hijo único) hasta la bifurcación real
      const camino = [raicesDelGrupo[0]];
      let actual = raicesDelGrupo[0];
      let hijosDirectos = hijosDe.get(actual.id) || [];

      // Baja mientras haya exactamente un hijo -> no hay nada que dividir todavía
      while (hijosDirectos.length === 1) {
        actual = hijosDirectos[0];
        camino.push(actual);
        hijosDirectos = hijosDe.get(actual.id) || [];
      }

      if (hijosDirectos.length === 0) {
        // Llegamos a una hoja sin encontrar bifurcación -> no se puede dividir más
        return [grupoRegistros];
      }

      // hijosDirectos.length >= 2: aquí sí hay una bifurcación real, dividimos por ella
      const subGrupos = [];
      let primero = true;
      for (const hijo of hijosDirectos) {
        const subArbol = recolectarSubarbol(hijo.id);
        if (primero) {
          subGrupos.push([...camino, ...subArbol]); // el camino "de paso" va con el primer hijo
          primero = false;
        } else {
          subGrupos.push(subArbol);
        }
      }

      const resultado = [];
      for (const sg of subGrupos) {
        // Salvaguarda: si por lo que sea no se redujo el tamaño, no sigas recursando
        if (sg.length >= grupoRegistros.length) {
          resultado.push(sg);
        } else {
          resultado.push(...dividirGrupoGrande(sg, tamanoMaximo));
        }
      }
      return resultado;
    }

    // Varias raíces en el grupo -> se procesan por separado
    const resultado = [];
    for (const raiz of raicesDelGrupo) {
      const subArbol = recolectarSubarbol(raiz.id);
      if (subArbol.length >= grupoRegistros.length) {
        resultado.push(subArbol);
      } else {
        resultado.push(...dividirGrupoGrande(subArbol, tamanoMaximo));
      }
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
  for (const grupo of gruposIniciales) {
    subGruposFinales.push(...dividirGrupoGrande(grupo, tamanoMaximo));
  }

  const bloques = [];
  let bloqueActual = [];
  for (const sg of subGruposFinales) {
    if (sg.length >= tamanoMaximo) {
      if (bloqueActual.length) {
        bloques.push(bloqueActual);
        bloqueActual = [];
      }
      bloques.push(sg);
      continue;
    }
    if (bloqueActual.length + sg.length > tamanoMaximo) {
      bloques.push(bloqueActual);
      bloqueActual = [];
    }
    bloqueActual.push(...sg);
  }
  if (bloqueActual.length) bloques.push(bloqueActual);

  return bloques;
}
function probarTroceado(registros, tamanoMaximo = 75) {
  const bloques = trocearPorRama(registros, tamanoMaximo);

  const usados = new Map();

  bloques.forEach((bloque, i) => {
    for (const r of bloque) {
      if (!usados.has(r.id)) {
        usados.set(r.id, []);
      }

      usados.get(r.id).push(i + 1);
    }
  });

  const duplicados = [...usados.entries()].filter(
    ([id, bloques]) => bloques.length > 1
  );

  return bloques;
}

async function suggestWithAI() {
  const btn = document.getElementById('btn-ai-jerarquia');
  const statusLine = document.getElementById('status-line');
  const aiResult = document.getElementById('ai-result-jerarquia');

  btn.disabled = true;

  btn.innerHTML =
    '<i class="ti ti-loader-2" style="font-size:15px; vertical-align:-2px; margin-right:4px;" aria-hidden="true"></i>Analizando estructura…';

  statusLine.style.display = 'block';
  statusLine.classList.remove('success');

  // ============================================================
  // 1. PREPARAR ESTRUCTURA ORIGINAL
  // ============================================================

  const estructuraIA = RESULT.records.map((x, index) => ({
    orden: index + 1,
    id: String(x.id ?? '').trim(),
    descripcion: String(x.descripcion ?? '').trim(),
    padre_original: String(x.parentId ?? '').trim(),
    nivel_original: Number(x.level ?? 0),
    tipo_original: String(x.tipo ?? '').trim(),
  }));

  if (!estructuraIA.length) {
    statusLine.textContent = 'No hay registros para analizar.';
    btn.disabled = false;
    return;
  }

  // ============================================================
  // 2. CONFIGURACIÓN
  // ============================================================

  const CHUNK_SIZE = 75;

  const FLOW_URL =
    'https://default18479be7da7b44a1ba5f47085a09a1.d0.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/22/workflows/9b90abcb09c0455c895afec69ab684dd/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=0dAwdP4ReVtIjpF2wD6x9NteMmap_D7z2krxqq716Ik';

  // ============================================================
  // 3. DIVIDIR EN BLOQUES
  // ============================================================
  console.table(
    estructuraIA.map((r) => ({
      id: r.id,
      padre: r.padre_original,
      nivel: r.nivel_original,
    }))
  );

  const bloques = trocearPorRama(estructuraIA, CHUNK_SIZE);

  const prueba = probarTroceado(RESULT.records, 75);

  // ============================================================
  // 4. ENVIAR BLOQUES
  // ============================================================

  const todosLosRegistros = [];
  const todasLasIncidencias = [];

  try {
    for (let i = 0; i < bloques.length; i++) {
      const bloque = bloques[i];

      statusLine.textContent =
        `Analizando bloque ${i + 1} de ${bloques.length} ` +
        `(${bloque.length} registros)…`;

      const response = await fetch(FLOW_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          registros: bloque,
        }),
      });

      // ========================================================
      // VALIDAR RESPUESTA HTTP
      // ========================================================

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Error HTTP ${response.status} en bloque ${i + 1}: ${errorText}`
        );
      }

      // ========================================================
      // LEER RESPUESTA
      // ========================================================

      const data = await response.json();

      // ========================================================
      // VALIDAR RESPUESTA
      // ========================================================

      if (!data || typeof data !== 'object') {
        throw new Error(
          `El bloque ${i + 1} no devolvió un objeto JSON válido.`
        );
      }

      if (!Array.isArray(data.registros)) {
        throw new Error(
          `La respuesta del bloque ${i + 1} no contiene el array "registros".`
        );
      }

      // ========================================================
      // GUARDAR RESULTADOS
      // ========================================================

      todosLosRegistros.push(...data.registros);

      if (Array.isArray(data.incidencias)) {
        todasLasIncidencias.push(...data.incidencias);
      }
    }

    // ============================================================
    // 5. RESULTADO COMPLETO
    // ============================================================

    const parsed = todosLosRegistros;
    const incidencias = todasLasIncidencias;

    // ============================================================
    // 6. VALIDAR IDS ORIGINALES
    // ============================================================

    const idsOriginales = new Set(estructuraIA.map((x) => x.id));

    const resultadoIA = parsed.map((item) => {
      const id = String(item.id ?? '').trim();

      const padre = String(item.padre_sugerido ?? '').trim();

      // ----------------------------------------------------------
      // ID DEBE EXISTIR
      // ----------------------------------------------------------

      if (!idsOriginales.has(id)) {
        throw new Error(`La IA devolvió un ID inexistente: ${id}`);
      }

      // ----------------------------------------------------------
      // PADRE DEBE EXISTIR
      // ----------------------------------------------------------

      if (padre && !idsOriginales.has(padre)) {
        throw new Error(
          `La IA asignó un padre inexistente: ${padre} para ${id}`
        );
      }

      // ----------------------------------------------------------
      // ESTRUCTURA NORMALIZADA
      // ----------------------------------------------------------

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

    // ============================================================
    // 7. VALIDAR QUE NO FALTEN REGISTROS
    // ============================================================

    // if (resultadoIA.length !== estructuraIA.length) {
    //   throw new Error(
    //     `La IA devolvió ${resultadoIA.length} registros, ` +
    //       `pero se enviaron ${estructuraIA.length}.`
    //   );
    // }

    // ============================================================
    // 8. GUARDAR RESULTADO
    // ============================================================

    RESULT.aiSuggestion = resultadoIA;
    RESULT.aiIncidencias = incidencias;

    // ============================================================
    // 9. DETERMINAR CAMBIOS
    // ============================================================

    const cambios = resultadoIA.filter(
      (item) => item.cambio_propuesto === true
    );

    // ============================================================
    // 10. MOSTRAR RESULTADO
    // ============================================================

    if (aiResult) {
      // ----------------------------------------------------------
      // SIN INCIDENCIAS Y SIN CAMBIOS
      // ----------------------------------------------------------

      if (incidencias.length === 0 && cambios.length === 0) {
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
      }

      // ----------------------------------------------------------
      // HAY CAMBIOS
      // ----------------------------------------------------------
      else {
        const rows = cambios
          .map((item) => {
            const aiIndex = resultadoIA.indexOf(item);

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
                  ${escapeHtml(item.tipo_sugerido || item.tipo_original)}
                </td>

                <td>
                  <strong>
                    ${escapeHtml(item.id)}
                  </strong>
                </td>

                <td>
                  ${escapeHtml(item.padre_original || 'Sin padre')}
                </td>

                <td>
                  <strong>
                    ${escapeHtml(item.padre_sugerido || 'Sin padre')}
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
                  ${escapeHtml(item.confianza)}
                </td>

              </tr>
            `;
          })
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

    // ============================================================
    // 11. CONECTAR BOTÓN APLICAR
    // ============================================================

    const btnApplyAI = document.getElementById('btn-apply-ai');

    if (btnApplyAI) {
      btnApplyAI.addEventListener('click', () => {
        const cambiosAplicados = applyAISuggestions();

        statusLine.textContent = `✓ Se aplicaron ${cambiosAplicados} cambios de la IA.`;

        statusLine.classList.add('success');

        btnApplyAI.style.display = 'none';
      });
    }

    // ============================================================
    // 12. MENSAJE FINAL
    // ============================================================

    if (incidencias.length === 0 && cambios.length === 0) {
      statusLine.textContent =
        `✓ Todo está correcto. La IA analizó ` +
        `${resultadoIA.length} registros y no encontró cambios necesarios.`;
    } else {
      statusLine.textContent =
        `IA terminó el análisis de ${resultadoIA.length} registros. ` +
        `Revisá los ${cambios.length} cambios propuestos ` +
        `antes de aplicarlos.`;
    }
  } catch (err) {
    console.error('Error analizando estructura con IA:', err);

    statusLine.textContent =
      'No se pudo analizar la estructura con IA. Revisá la consola.';
  } finally {
    btn.disabled = false;

    btn.innerHTML =
      '<i class="ti ti-sparkles" style="font-size:15px; vertical-align:-2px;" aria-hidden="true"></i>Sugerir con IA';
  }
}

function applyAISuggestions() {
  if (!RESULT?.aiSuggestion?.length) {
    return 0;
  }

  const checkboxes = document.querySelectorAll('.ai-change-checkbox:checked');

  let cambiosAplicados = 0;

  checkboxes.forEach((checkbox) => {
    const index = Number(checkbox.dataset.aiIndex);
    const suggestion = RESULT.aiSuggestion[index];

    if (!suggestion) return;

    const record = RESULT.records.find(
      (r) => normalizeKey(r.id) === normalizeKey(suggestion.id)
    );

    if (!record) return;

    // No modificar raíz
    if (record.index === 0 || record.tipo === 'Raíz') {
      return;
    }

    // Guardar cambio
    record.parentId = normalize(suggestion.padre_sugerido);

    record.level = Number(suggestion.nivel_sugerido);

    if (suggestion.tipo_sugerido) {
      record.tipo = suggestion.tipo_sugerido;
    }

    suggestion.aplicado = true;

    cambiosAplicados++;
  });

  if (cambiosAplicados === 0) {
    return 0;
  }

  // ============================================================
  // RECONSTRUIR MAPA DE HIJOS
  // ============================================================

  RESULT.childrenMap = buildHierarchyTreeMap(RESULT.records);

  // ============================================================
  // RECONSTRUIR RAÍCES
  // ============================================================

  const root = RESULT.records[0];

  RESULT.roots = [
    root,
    ...RESULT.records.filter(
      (record) =>
        record.index !== 0 &&
        normalizeKey(record.parentId) === normalizeKey(root.id)
    ),
  ];

  // ============================================================
  // REDIBUJAR
  // ============================================================
  refreshHierarchyIncidents();
  renderHierarchyTree(RESULT);

  // ============================================================
  // OCULTAR SUGERENCIAS APLICADAS
  // ============================================================

  const aiResult = document.getElementById('ai-result-jerarquia');

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

  const statusLine = document.getElementById('status-line');

  if (statusLine) {
    statusLine.textContent = `✓ Se aplicaron ${cambiosAplicados} cambios de la IA.`;

    statusLine.classList.add('success');
  }

  return cambiosAplicados;
}
/* ============================================================
   INICIO PLAN DE CUENTAS
============================================================ */

function parsePlanWorkbook(workbook) {
  const sheetName = findSheet(workbook, 'Input');

  if (!sheetName) {
    throw new Error('El archivo debe contener una hoja llamada "Input".');
  }

  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  if (!rows.length) {
    throw new Error('La hoja "Input" está vacía.');
  }

  /*
   * El archivo de entrada SIEMPRE tiene encabezados
   * en la fila 1.
   *
   * Los datos comienzan en la fila 2.
   */

  const first = rows[0];

  const columns = {
    cuentaLocal: findColumn(first, ['CUENTA LOCAL']),

    cuenta: findColumn(first, ['CTA. GRUPO', 'CTA GRUPO']),

    descripcion: findColumn(first, [
      'DESCRIPTION',
      'DESCRIPCION',
      'DESCRIPCIÓN',
    ]),

    acctype: findColumn(first, ['ACCTYPE']),

    typelim: findColumn(first, ['TYPELIM']),

    conversion: findColumn(first, ['CONVERSION']),
  };

  /*
   * Validar estructura del archivo.
   */

  if (!columns.cuentaLocal) {
    throw new Error(
      'No se encontró la columna "CUENTA LOCAL" en la hoja "Input".'
    );
  }

  if (!columns.cuenta) {
    throw new Error(
      'No se encontró la columna "CTA. GRUPO" en la hoja "Input".'
    );
  }

  if (!columns.descripcion) {
    throw new Error(
      'No se encontró la columna "DESCRIPTION" en la hoja "Input".'
    );
  }

  if (!columns.acctype) {
    throw new Error('No se encontró la columna "ACCTYPE" en la hoja "Input".');
  }

  if (!columns.typelim) {
    throw new Error('No se encontró la columna "TYPELIM" en la hoja "Input".');
  }

  if (!columns.conversion) {
    throw new Error(
      'No se encontró la columna "CONVERSION" en la hoja "Input".'
    );
  }

  /*
   * Los datos comienzan después del encabezado.
   *
   * sheet_to_json ya excluye automáticamente la fila 1.
   * Por eso originalRow = index + 2.
   */

  return rows
    .map((row, index) => ({
      originalRow: index + 2,

      cuentaLocal: normalize(row[columns.cuentaLocal]),

      cuenta: normalize(row[columns.cuenta]),

      descripcion: normalize(row[columns.descripcion]),

      acctype: normalizeAcctype(row[columns.acctype]),

      typelim: normalize(row[columns.typelim]),

      conversion: normalize(row[columns.conversion]),
    }))
    .filter(
      (row) =>
        row.cuentaLocal ||
        row.cuenta ||
        row.descripcion ||
        row.acctype ||
        row.typelim ||
        row.conversion
    );
}

/* ============================================================
   VALIDACIÓN PLAN DE CUENTAS
============================================================ */

function normalizeAcctype(value) {
  const text = normalize(value).toUpperCase();

  if (text.includes('AST')) return 'AST -- Activo';
  if (text.includes('LEQ')) return 'LEQ -- Pasivo';
  if (text.includes('INC')) return 'INC -- Ingreso';
  if (text.includes('EXP')) return 'EXP -- Gasto';

  return text;
}
function sonDuplicadosExactos(a, b) {
  return (
    normalizeAIValue(a.cuenta) === normalizeAIValue(b.cuenta) &&
    normalizeAIValue(a.descripcion) === normalizeAIValue(b.descripcion) &&
    normalizeAIValue(a.acctype) === normalizeAIValue(b.acctype) &&
    normalizeAIValue(a.typelim) === normalizeAIValue(b.typelim) &&
    normalizeAIValue(a.conversion) === normalizeAIValue(b.conversion)
  );
}

function detectarDuplicadosExactos(registros) {
  const duplicados = [];
  const grupos = new Map();

  registros.forEach((registro) => {
    const cuenta = normalizeAIValue(registro.cuenta);

    if (!cuenta) return;

    if (!grupos.has(cuenta)) {
      grupos.set(cuenta, []);
    }

    grupos.get(cuenta).push(registro);
  });

  grupos.forEach((items) => {
    if (items.length < 2) return;

    const conservar = items[0];

    items.slice(1).forEach((registro) => {
      if (sonDuplicadosExactos(conservar, registro)) {
        duplicados.push({
          cuentaLocal: registro.cuentaLocal,
          cuenta: registro.cuenta,
          accion: 'eliminar',
          motivo: 'duplicado_exacto',
          conservarCuentaLocal: conservar.cuentaLocal,
          explicacion:
            `La cuenta local ${registro.cuentaLocal} ` +
            `es exactamente igual a ${conservar.cuentaLocal} ` +
            `en cuenta, descripción, ACCTYPE, TYPELIM y CONVERSION.`,
        });
      }
    });
  });

  return duplicados;
}

function eliminarDuplicadosExactos(registros, duplicadosExactos) {
  const cuentasLocalesAEliminar = new Set(
    duplicadosExactos.map((duplicate) =>
      String(duplicate.cuentaLocal ?? '').trim()
    )
  );

  return registros.filter(
    (registro) =>
      !cuentasLocalesAEliminar.has(String(registro.cuentaLocal ?? '').trim())
  );
}

function getAcctypeCode(value) {
  const text = normalize(value).toUpperCase();

  if (text.includes('AST')) return 'AST';
  if (text.includes('LEQ')) return 'LEQ';
  if (text.includes('INC')) return 'INC';
  if (text.includes('EXP')) return 'EXP';

  return '';
}

function getMeasure(acctype) {
  const code = getAcctypeCode(acctype);

  return MEASURE_MAP[code] || null;
}

function getConversion(acctype) {
  const code = getAcctypeCode(acctype);

  return CONVERSION_MAP[code] || null;
}

function renderPlanIncidents(incidents) {
  const container = $('plan-incidencias-table');

  if (!container) {
    return;
  }

  /*
   * ============================================================
   * SIN INCIDENCIAS
   * ============================================================
   */

  if (!incidents || !incidents.length) {
    container.innerHTML = '';

    show($('plan-clean-msg'));

    return;
  }

  hide($('plan-clean-msg'));

  /*
   * ============================================================
   * TABLA
   * ============================================================
   */

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
                    ${escapeHtml(incident.id || incident.cuenta || '—')}
                  </td>

                  <td>
                    ${escapeHtml(incident.tipo || '—')}
                  </td>

                  <td>
                    ${escapeHtml(
                      incident.message || incident.explicacion || ''
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

function eliminarRegistroPlan(cuentaLocal) {
  /*
   * ============================================================
   * 1. VALIDACIÓN
   * ============================================================
   */

  if (!PLAN_RESULT) {
    console.warn('No existe PLAN_RESULT.');

    return;
  }

  if (!cuentaLocal) {
    console.warn('No se recibió cuentaLocal para eliminar.');

    return;
  }

  /*
   * ============================================================
   * 2. BUSCAR REGISTRO
   * ============================================================
   */

  const record = (PLAN_RESULT.records || []).find(
    (item) =>
      String(item.cuentaLocal ?? '').trim() === String(cuentaLocal).trim()
  );

  if (!record) {
    console.warn('No se encontró el registro para eliminar:', cuentaLocal);

    return;
  }

  /*
   * ============================================================
   * 3. CONFIRMACIÓN
   * ============================================================
   */

  const confirmar = confirm(
    `¿Quieres eliminar la cuenta local ${cuentaLocal}?\n\n` +
      `Cuenta de grupo: ${record.cuenta || '—'}\n` +
      `Descripción: ${record.descripcion || '—'}`
  );

  if (!confirmar) {
    return;
  }

  /*
   * ============================================================
   * 4. ELIMINAR REGISTRO
   * ============================================================
   */

  PLAN_RESULT.records = PLAN_RESULT.records.filter(
    (item) =>
      String(item.cuentaLocal ?? '').trim() !== String(cuentaLocal).trim()
  );

  /*
   * ============================================================
   * 6. REANALIZAR PLAN
   * ============================================================
   *
   * Esta función:
   *
   * - vuelve a ejecutar processPlan()
   * - detecta nuevos duplicados exactos
   * - actualiza PLAN_RESULT
   * - actualiza resumen
   * - actualiza incidencias
   * - actualiza botón generar
   */

  (PLAN_RESULT.records || []).forEach((record) => {
    const original = cuentasLocalesAntes.get(record.originalRow);

    const actual = String(record.cuentaLocal ?? '').trim();

    if (original !== actual) {
      console.error('ERROR: cuentaLocal modificada por la IA', {
        originalRow: record.originalRow,
        antes: original,
        despues: actual,
        record,
      });
    }
  });
  reanalizarPlanDespuesIA();

  /*
   * ============================================================
   * 7. DEBUG RESULTADO
   * ============================================================
   */
}

/* ============================================================
   SUMMARY PLAN
============================================================ */

function buildPlanSummary(result) {
  const errors = result.incidents.filter((i) => i.severity === 'Error').length;

  const warnings = result.incidents.filter(
    (i) => i.severity === 'Warning'
  ).length;

  const accounts = new Set(
    result.records.map((r) => normalizeKey(r.cuenta)).filter(Boolean)
  ).size;

  const acctype = new Set(
    result.records.map((r) => normalizeKey(r.acctype)).filter(Boolean)
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

function renderPlanSummary(summary) {
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
   RENDER INCIDENCIAS PLAN
============================================================ */

function reanalizarPlanDespuesIA() {
  /*
   * ============================================================
   * 1. VALIDACIÓN
   * ============================================================
   */

  if (!PLAN_RESULT) {
    console.warn('No existe PLAN_RESULT para reanalizar.');

    return {
      duplicadosExactos: [],
      hasErrors: false,
      errors: [],
      warnings: [],
    };
  }

  /*
   * ============================================================
   * 2. OBTENER REGISTROS ACTUALES
   * ============================================================
   *
   * Son los registros DESPUÉS de aplicar los cambios de IA.
   */

  const records = PLAN_RESULT.records || [];

  /*
   * ============================================================
   * 3. DETECTAR DUPLICADOS EXACTOS NUEVOS
   * ============================================================
   *
   * IMPORTANTE:
   *
   * Aquí NO eliminamos nada.
   *
   * Solo los detectamos para mostrarlos al usuario.
   */

  const duplicadosExactos = detectarDuplicadosExactos(records);

  if (duplicadosExactos.length) {
    console.table(duplicadosExactos);
  }

  /*
   * ============================================================
   * 4. REVALIDAR CAMPOS
   * ============================================================
   */

  const validationResult = processPlan(records);

  /*
   * ============================================================
   * 5. INCIDENCIAS DE DUPLICADOS EXACTOS
   * ============================================================
   *
   * Estos duplicados aparecieron DESPUÉS de aplicar IA.
   *
   * No se eliminan automáticamente.
   *
   * Se muestran como eliminables.
   */

  const incidentesDuplicados = duplicadosExactos.map((duplicate) => {
    const registro = records.find(
      (record) =>
        String(record.cuentaLocal ?? '').trim() ===
        String(duplicate.cuentaLocal ?? '').trim()
    );

    return {
      severity: 'Warning',

      row: registro?.originalRow ?? '',

      id: duplicate.cuenta,

      cuentaLocal: duplicate.cuentaLocal,

      tipo: 'duplicado_exacto',

      message: duplicate.explicacion,

      removable: true,
    };
  });

  /*
   * ============================================================
   * 6. CONSERVAR LAS DEMÁS INCIDENCIAS
   * ============================================================
   *
   * processPlan() ya valida:
   *
   * - cuenta faltante
   * - descripción
   * - ACCTYPE
   * - cuenta de grupo repetida con diferencias
   *
   * Eliminamos únicamente cualquier duplicado exacto
   * que pudiera haber generado como segunda barrera.
   */

  const incidentesBase = validationResult.incidents.filter(
    (incident) => incident.tipo !== 'duplicado_exacto'
  );

  /*
   * ============================================================
   * 7. ACTUALIZAR PLAN_RESULT
   * ============================================================
   */

  PLAN_RESULT = {
    ...validationResult,

    incidents: [...incidentesBase, ...incidentesDuplicados],

    aiSuggestion: PLAN_RESULT.aiSuggestion || [],

    aiIncidents: PLAN_RESULT.aiIncidents || [],

    /*
     * Duplicados actuales detectados después de IA.
     */

    aiDuplicates: duplicadosExactos,

    /*
     * Conservamos los duplicados que fueron eliminados
     * automáticamente al principio.
     */

    initialDuplicates: PLAN_RESULT.initialDuplicates || [],
  };

  /*
   * ============================================================
   * 8. CALCULAR RESULTADO
   * ============================================================
   */

  const errors = PLAN_RESULT.incidents.filter(
    (incident) => incident.severity === 'Error'
  );

  const warnings = PLAN_RESULT.incidents.filter(
    (incident) => incident.severity === 'Warning'
  );

  const hasErrors = errors.length > 0;

  /*
   * ============================================================
   * 9. ACTUALIZAR RESUMEN
   * ============================================================
   */

  const summary = buildPlanSummary(PLAN_RESULT);

  renderPlanSummary(summary);

  /*
   * ============================================================
   * 10. ACTUALIZAR INCIDENCIAS
   * ============================================================
   */

  renderPlanIncidents(PLAN_RESULT.incidents);

  /*
   * ============================================================
   * 11. ACTUALIZAR BOTÓN GENERAR
   * ============================================================
   */

  // $('btn-plan-generate').disabled = hasErrors;

  $('plan-gen-status').textContent = hasErrors
    ? 'Corrige las incidencias antes de generar el archivo.'
    : 'Validación completada. El archivo está listo para generar.';

  /*
   * ============================================================
   * 13. RESULTADO
   * ============================================================
   */

  return {
    duplicadosExactos,
    hasErrors,
    errors,
    warnings,
  };
}

/* ============================================================
   PROCESAR PLAN
============================================================ */

function processPlan(rows) {
  const incidents = [];

  /*
   * ============================================================
   * 1. CONSTRUIR REGISTROS
   * ============================================================
   */

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

  /*
   * ============================================================
   * 2. VALIDACIONES BÁSICAS
   * ============================================================
   */

  records.forEach((record) => {
    /*
     * ----------------------------------------------------------
     * CTA. GRUPO
     * ----------------------------------------------------------
     */

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

    /*
     * ----------------------------------------------------------
     * DESCRIPCIÓN
     * ----------------------------------------------------------
     */

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

    /*
     * ----------------------------------------------------------
     * ACCTYPE
     * ----------------------------------------------------------
     */

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

  /*
   * ============================================================
   * 3. CUENTAS DE GRUPO REPETIDAS
   * ============================================================
   *
   * IMPORTANTE:
   *
   * Una cuenta de grupo repetida NO es automáticamente un error.
   *
   * Ejemplo válido:
   *
   * 11100000 → Z11100
   * 11100001 → Z11100
   * 11100002 → Z11100
   *
   * Esta función NO determina aquí si son duplicados exactos.
   *
   * Esa comprobación se realiza mediante:
   *
   *     detectarDuplicadosExactos()
   *
   * antes de IA y después de aplicar IA.
   */

  const accounts = new Map();

  records.forEach((record) => {
    const key = normalizeKey(record.cuenta);

    if (!key) {
      return;
    }

    if (!accounts.has(key)) {
      accounts.set(key, []);
    }

    accounts.get(key).push(record);
  });

  /*
   * ============================================================
   * 4. ANALIZAR AGRUPACIONES
   * ============================================================
   */

  accounts.forEach((groupRecords) => {
    /*
     * Una sola cuenta de grupo:
     * no hay nada que revisar.
     */

    if (groupRecords.length < 2) {
      return;
    }

    /*
     * --------------------------------------------------------
     * COMPROBAR SI EXISTEN DIFERENCIAS
     * --------------------------------------------------------
     */

    const primerRegistro = groupRecords[0];

    const existenDiferencias = groupRecords.some(
      (record) =>
        normalizeAIValue(record.descripcion) !==
          normalizeAIValue(primerRegistro.descripcion) ||
        normalizeAIValue(record.acctype) !==
          normalizeAIValue(primerRegistro.acctype) ||
        normalizeAIValue(record.typelim) !==
          normalizeAIValue(primerRegistro.typelim) ||
        normalizeAIValue(record.conversion) !==
          normalizeAIValue(primerRegistro.conversion)
    );

    /*
     * --------------------------------------------------------
     * DUPLICADOS EXACTOS
     * --------------------------------------------------------
     *
     * NO se generan aquí.
     *
     * detectarDuplicadosExactos()
     * se encarga de ello.
     */

    if (!existenDiferencias) {
      return;
    }

    /*
     * --------------------------------------------------------
     * CUENTA DE GRUPO REPETIDA CON DIFERENCIAS
     * --------------------------------------------------------
     */

    incidents.push({
      severity: 'Warning',

      row: primerRegistro.originalRow,

      id: primerRegistro.cuenta,

      cuentaLocal: primerRegistro.cuentaLocal,

      tipo: 'cuenta_duplicada',

      message:
        `La cuenta de grupo "${primerRegistro.cuenta}" ` +
        `está asociada a ` +
        `${groupRecords.length} cuentas locales ` +
        `con diferencias entre sus registros. ` +
        `La agrupación no es necesariamente incorrecta ` +
        `y no constituye un error bloqueante.`,

      removable: false,
    });
  });

  /*
   * ============================================================
   * 5. RESULTADO
   * ============================================================
   */

  return {
    records,

    incidents,
  };
}

async function processPlanFile() {
  if (!PLAN_CURRENT_FILE) {
    alert('Selecciona primero un archivo Excel.');
    return;
  }

  const button = $('btn-plan-process');

  button.disabled = true;

  setStatus($('plan-file-status'), 'Procesando archivo...');

  try {
    /*
     * ============================================================
     * 1. LEER EXCEL
     * ============================================================
     */

    const workbook = await readExcel(PLAN_CURRENT_FILE);

    /*
     * ============================================================
     * 2. PARSEAR REGISTROS
     * ============================================================
     */

    const rows = parsePlanWorkbook(workbook);

    if (!rows.length) {
      throw new Error('No existen registros para procesar.');
    }

    /*
     * ============================================================
     * 3. VALIDACIÓN INICIAL
     * ============================================================
     */

    PLAN_RESULT = processPlan(rows);

    /*
     * ============================================================
     * 4. ELIMINAR DUPLICADOS EXACTOS AUTOMÁTICAMENTE
     * ============================================================
     *
     * La limpieza ocurre ANTES de llamar a la IA.
     */

    const duplicadosEliminados = eliminarDuplicadosExactosDePlan();

    /*
     * ============================================================
     * 5. GUARDAR DATOS LIMPIOS
     * ============================================================
     */

    PLAN_RAW_DATA = PLAN_RESULT.records;

    /*
     * ============================================================
     * 6. REVALIDAR DESPUÉS DE LA LIMPIEZA
     * ============================================================
     */

    PLAN_RESULT = processPlan(PLAN_RAW_DATA);

    /*
     * ============================================================
     * 8. RESUMEN
     * ============================================================
     */

    const summary = buildPlanSummary(PLAN_RESULT);

    renderPlanSummary(summary);

    /*
     * ============================================================
     * 9. INCIDENCIAS
     * ============================================================
     */

    renderPlanIncidents(PLAN_RESULT.incidents);

    /*
     * ============================================================
     * 10. ERRORES
     * ============================================================
     */

    const hasErrors = PLAN_RESULT.incidents.some(
      (incident) => incident.severity === 'Error'
    );

    // $('btn-plan-generate').disabled = hasErrors;

    $('plan-gen-status').textContent = hasErrors
      ? 'Corrige las incidencias antes de generar el archivo.'
      : 'Validación completada. El archivo está listo para generar.';

    /*
     * ============================================================
     * 11. MOSTRAR PASOS
     * ============================================================
     */

    show($('plan-step3'));

    show($('plan-step4'));

    /*
     * ============================================================
     * 12. MENSAJE FINAL
     * ============================================================
     */

    let mensaje = `${PLAN_RESULT.records.length} registros procesados correctamente.`;

    if (duplicadosEliminados > 0) {
      mensaje +=
        ` Se eliminaron automáticamente ` +
        `${duplicadosEliminados} ` +
        `duplicado(s) exacto(s).`;
    }

    setStatus($('plan-file-status'), mensaje, 'success');

    /*
     * ============================================================
     * 13. SCROLL
     * ============================================================
     */

    scrollToElement($('plan-step3'));
  } catch (error) {
    console.error('Error al procesar el plan:', error);

    PLAN_RESULT = null;
    PLAN_RAW_DATA = [];

    hide($('plan-step3'));

    hide($('plan-step4'));

    setStatus($('plan-file-status'), error.message, 'error');

    alert(`No fue posible procesar el archivo:\n\n${error.message}`);
  } finally {
    button.disabled = false;
  }
}

/* ============================================================
   VALIDAR PARÁMETROS PLAN
============================================================ */

function validatePlanParameters() {
  const plan = normalize($('p-plan')?.value);

  const planDesc = normalize($('p-plan-desc')?.value);

  const version = normalize($('p-version')?.value);

  const versionDesc = normalize($('p-version-desc')?.value);

  const periodo = normalize($('p-periodo')?.value);

  const idioma = normalize($('p-idioma')?.value);

  if (!plan) {
    alert('Ingresa el plan de cuentas.');

    $('p-plan')?.focus();

    return false;
  }

  if (!planDesc) {
    alert('Ingresa la descripción del plan de cuentas.');

    $('p-plan-desc')?.focus();

    return false;
  }

  if (!version) {
    alert('Ingresa la versión de consolidación.');

    $('p-version')?.focus();

    return false;
  }

  if (!versionDesc) {
    alert('Ingresa la descripción de la versión.');

    $('p-version-desc')?.focus();

    return false;
  }

  if (!periodo) {
    alert('Ingresa el ejercicio y período.');

    $('p-periodo')?.focus();

    return false;
  }

  /*
   * Formato YYYY/MMM
   *
   * Ejemplo:
   * 2026/006
   */

  if (!/^\d{4}\/\d{3}$/.test(periodo)) {
    alert(
      'El ejercicio/período debe tener el formato YYYY/MMM. Ejemplo: 2026/006.'
    );

    $('p-periodo')?.focus();

    return false;
  }

  if (!idioma) {
    alert('Selecciona un idioma.');

    $('p-idioma')?.focus();

    return false;
  }

  return true;
}

/* ============================================================
   GENERAR DATOS FIORI — PLAN DE CUENTAS
============================================================ */

function buildPlanFioriData() {
  if (!PLAN_RESULT) {
    throw new Error('No existe información procesada.');
  }

  /* ----------------------------------------------------------
     PARÁMETROS
  ---------------------------------------------------------- */

  const plan = normalize($('p-plan')?.value);
  const planDesc = normalize($('p-plan-desc')?.value);

  const version = normalize($('p-version')?.value);
  const versionDesc = normalize($('p-version-desc')?.value);

  const periodo = normalize($('p-periodo')?.value);
  const idioma = normalize($('p-idioma')?.value).toUpperCase();

  /* ----------------------------------------------------------
     DESCRIPCIÓN DEL IDIOMA
  ---------------------------------------------------------- */

  const descripcionIdioma = getLanguageDescription(idioma);

  if (!descripcionIdioma) {
    throw new Error(`El código de idioma "${idioma}" no es válido.`);
  }

  /* ----------------------------------------------------------
     AGRUPAR POR CUENTA DE GRUPO
     
     IMPORTANTE:
     
     No modificamos PLAN_RESULT.records.
     
     Solamente agrupamos los registros para construir
     la salida Fiori.
  ---------------------------------------------------------- */

  const cuentasGrupo = new Map();

  (PLAN_RESULT.records || []).forEach((record) => {
    const cuentaGrupo = normalize(record.cuenta);

    if (!cuentaGrupo) {
      return;
    }

    if (!cuentasGrupo.has(cuentaGrupo)) {
      cuentasGrupo.set(cuentaGrupo, record);
    }
  });

  /* ----------------------------------------------------------
     GENERAR REGISTROS FIORI
  ---------------------------------------------------------- */

  return Array.from(cuentasGrupo.values()).map((record) => {
    const measure = getMeasure(record.acctype);
    const conversion = getConversion(record.acctype);

    return {
      '*Plan de cuentas de consolidación (2)': `${plan} -- ${planDesc}`,

      '*Versión de consolidación (3)': `${version} -- ${versionDesc}`,

      '*Ejercicio y período contable efectivos (AAAA/PPP)': periodo,

      '*Idioma (2)': `${idioma} -- ${descripcionIdioma}`,

      '*Posición (10)': record.cuenta,

      'Descripción de posición (15)': String(
        record.descripcion || ''
      ).substring(0, 15),

      'Descripción media posición balance contable (50)': String(
        record.descripcion || ''
      ).substring(0, 50),

      'Descripción explicativa de pos.balance contable (250)': String(
        record.descripcion || ''
      ).substring(0, 250),

      '*Tipo de posición FS (10)': record.acctype,

      'Tipo de imputación (4)': measure
        ? `${measure.codigo} -- ${measure.detalle}`
        : '',

      'Bloqueado para contabilización (1)': '',

      'Es posición de consolidación (1)': '',

      'Arrastre de saldos (1)': '',

      'Título de enlace (255)': '',

      'URL enlace (1333)': '',

      'Rol de posición FS (30)': '',

      'Selección de colección de datos (30)': '',

      'Selección de conversión de moneda (30)': conversion
        ? `${conversion.codigo} -- ${conversion.detalle}`
        : '',

      'Selección de eliminación (30)': record.eliminacion || '',

      'Selección de flujo de caja (30)': '',

      'Selección de alcance (30)': '',

      'Otra selección (30)': '',

      'Destino de eliminación (10)': '',

      'Destino de participaciones de minorías (10)': '',

      'Destino de planificación (10)': '',

      'Destino de compensación (10)': '',
    };
  });
}

/* ============================================================
   DESCRIPCIÓN DEL IDIOMA
============================================================ */

function getLanguageDescription(codigo) {
  const idiomas = {
    AF: 'Afrikáans',
    AR: 'Árabe',
    BG: 'Búlgaro',
    CA: 'Catalán',
    CS: 'Checo',
    DA: 'Danés',
    DE: 'Alemán',
    EL: 'Griego',
    EN: 'Inglés',
    ES: 'Español',
    ET: 'Estonio',
    FI: 'Finlandés',
    FR: 'Francés',
    HE: 'Hebreo',
    HI: 'Hindi',
    HR: 'Croata',
    HU: 'Húngaro',
    ID: 'Indonesio',
    IS: 'Islandés',
    IT: 'Italiano',
    JA: 'Japonés',
    KK: 'Kazajo',
    KO: 'Coreano',
    LT: 'Lituano',
    LV: 'Letón',
    MS: 'Malayo',
    NL: 'Neerlandés',
    NO: 'Noruego',
    PL: 'Polaco',
    PT: 'Portugués',
    RO: 'Rumano',
    RU: 'Ruso',
    SH: 'Serbio(,latino)',
    SK: 'Eslovaco',
    SL: 'Esloveno',
    SR: 'Serbio',
    SV: 'Sueco',
    TH: 'Tailandés',
    TR: 'Turco',
    UK: 'Ucraniano',
    VI: 'Vietnamita',
    Z1: 'Reservacliente',
    ZF: 'Chinotrad.',
    ZH: 'Chino',
  };

  return idiomas[normalizeKey(codigo)] || '';
}

/* ============================================================
   GENERAR ARCHIVO FIORI — PLAN DE CUENTAS
============================================================ */

async function generatePlanFile() {
  if (!validatePlanParameters()) {
    return;
  }

  if (!PLAN_RESULT) {
    alert('Primero debes procesar y validar el archivo.');

    return;
  }

  const errors = PLAN_RESULT.incidents.filter((i) => i.severity === 'Error');

  // if (errors.length) {
  //   alert(
  //     'No se puede generar el archivo porque existen errores de validación.'
  //   );

  //   return;
  // }

  try {
    /* --------------------------------------------------------
       PARÁMETROS
    -------------------------------------------------------- */
    const BLUE_FILL = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8EA9DB' },
    };

    const plan = normalize($('p-plan')?.value);
    const planDesc = normalize($('p-plan-desc')?.value);

    const version = normalize($('p-version')?.value);
    const versionDesc = normalize($('p-version-desc')?.value);

    const periodo = normalize($('p-periodo')?.value);
    const idioma = normalize($('p-idioma')?.value).toUpperCase();

    const descripcionIdioma = getLanguageDescription(idioma);

    if (!descripcionIdioma) {
      throw new Error(`El código de idioma "${idioma}" no es válido.`);
    }

    /* --------------------------------------------------------
       CREAR WORKBOOK
    -------------------------------------------------------- */
    const workbook = new ExcelJS.Workbook();

    /* ========================================================
       HOJA POSICIÓN
    ======================================================== */
    const worksheet = workbook.addWorksheet('Posición');

    /* --------------------------------------------------------
       FILA 1
       Título
    -------------------------------------------------------- */
    worksheet.getCell('A1').value = 'Posición';

    worksheet.getCell('A1').font = {
      name: 'Aptos Narrow',
      size: 22,
      bold: true,
      color: { argb: '000000' },
    };

    /* --------------------------------------------------------
       FILA 2
    -------------------------------------------------------- */
    worksheet.getCell('A2').value = 'Valores de filtro obligatorios';

    worksheet.getCell('A2').font = {
      name: 'Aptos Narrow',
      size: 22,
      bold: true,
      color: { argb: '000000' },
    };

    /* --------------------------------------------------------
       FILA 3
       Nombre técnico
    -------------------------------------------------------- */
    worksheet.getCell('A3').value = 'FINCS_S_MD_XLSX_HD_FSI_TVD';

    worksheet.getCell('A3').font = {
      name: 'Aptos Narrow',
      size: 11,
      color: { argb: '000000' },
    };
    // Ocultar fila 3
    worksheet.getRow(3).hidden = true;

    /* --------------------------------------------------------
       FILA 4
       DESCRIPCIONES
    -------------------------------------------------------- */
    worksheet.getRow('4').values = [
      '*Plan de cuentas de consolidación (2)',
      '*Versión de consolidación (3)',
      '*Ejercicio y período contable efectivos (AAAA/PPP)',
      '*Idioma (2)',
    ];

    worksheet.getRow(4).eachCell((cell) => {
      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
        bold: true,
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8EA9DB' },
      };
    });

    /* --------------------------------------------------------
       FILA 5
       NOMBRES TÉCNICOS
    -------------------------------------------------------- */
    worksheet.getRow('5').values = [
      'CONSOLIDATIONCHARTOFACCOUNTS+CONSOLIDATIONCHARTOFACCTSTEXT',
      'CONSOLIDATIONVERSION+CONSOLIDATIONVERSIONTEXT',
      'FISCALYEARPERIOD',
      'LANGUAGE+LANGUAGENAME',
    ];

    worksheet.getRow(5).eachCell((cell) => {
      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
        bold: true,
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8EA9DB' },
      };
    });

    // Ocultar fila 5
    worksheet.getRow(5).hidden = true;

    /* --------------------------------------------------------
       FILA 6
       VALORES
    -------------------------------------------------------- */

    worksheet.getRow(6).values = [
      `${plan} -- ${planDesc}`,
      `${version} -- ${versionDesc}`,
      periodo,
      `${idioma} -- ${descripcionIdioma}`,
    ];

    /* --------------------------------------------------------
       FILA 7
    -------------------------------------------------------- */
    worksheet.getCell('A7').value = 'Datos maestros';

    worksheet.getCell('A7').font = {
      name: 'Aptos Narrow',
      size: 22,
      bold: true,
      color: { argb: '000000' },
    };

    /* --------------------------------------------------------
       FILA 8
    -------------------------------------------------------- */
    worksheet.getCell('A8').value = 'FINCS_S_MD_XLSX_FSI_TVD';

    worksheet.getCell('A8').font = {
      name: 'Aptos Narrow',
      size: 11,
      color: { argb: '000000' },
    };

    // Ocultar fila 8
    worksheet.getRow(8).hidden = true;

    /* ========================================================
       FILAS 9 Y 10 — CABECERAS
    ======================================================== */

    const headers = [
      '*Posición (10)',
      'Descripción de posición (15)',
      'Descripción media posición balance contable (50)',
      'Descripción explicativa de pos.balance contable (250)',
      '*Tipo de posición FS (10)',
      'Tipo de imputación (4)',
      'Bloqueado para contabilización (1)',
      'Es posición de consolidación (1)',
      'Arrastre de saldos (1)',
      'Título de enlace (255)',
      'URL enlace (1333)',
      'Rol de posición FS (30)',
      'Selección de colección de datos (30)',
      'Selección de conversión de moneda (30)',
      'Selección de eliminación (30)',
      'Selección de flujo de caja (30)',
      'Selección de alcance (30)',
      'Otra selección (30)',
      'Destino de eliminación (10)',
      'Destino de participaciones de minorías (10)',
      'Destino de planificación (10)',
      'Destino de compensación (10)',
    ];
    worksheet.getRow('9').values = headers;

    worksheet.getRow(9).eachCell((cell) => {
      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
        bold: true,
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8EA9DB' },
      };
    });

    const technicalHeaders = [
      'FINANCIALSTATEMENTITEM',
      'FINANCIALSTATEMENTITEMTEXT',
      'FINANCIALSTATEMENTITEMMDMTEXT',
      'FINANCIALSTATEMENTITEMLONGTEXT',
      'FINANCIALSTATEMENTITEMTYPE+FINANCIALSTATEMENTITEMTYPETEXT',
      'BREAKDOWNCATEGORY+BREAKDOWNCATEGORYTEXT',
      'FINANCIALSTATEMENTITEMISBLKD+FSITEMISBLKDTEXT',
      'ISCONSOLIDATIONITEM+ISCONSOLIDATIONITEMTEXT',
      'NETBALANCEISCARRIEDFORWARD+NETBALANCEISCARRIEDFORWARDTEXT',
      'FSITEMLINKLABEL',
      'FSITEMLINK',
      'FINANCIALSTATEMENTITEMROLE+FSITEMROLESHORTTEXT',
      'FSITEMDATACOLLECTION+FSITEMDATACOLLECTIONSHORTTEXT',
      'FSITEMCURRENCYTRANSLATION+FSITEMCRCYTRNSLTNATTRIBSHRTTXT',
      'FSITEMELIMINATION+FSITEMELIMATTRIBUTESHORTTEXT',
      'FSITEMCASHFLOW+FSITEMCASHFLOWSHORTTEXT',
      'FSITEMSCOPE+FSITEMSCOPESHORTTEXT',
      'FSITEMCUSTOMERSPECIFIC+FSITEMCUSTOMERSPECIFICSHRTTEXT',
      'ELIMINATIONTARGETFSITEM',
      'NCITARGETFSITEM',
      'PLANNINGTARGETFSITEM',
      'CNSLDTNOFFSETTINGTARGETFSITEM',
    ];

    worksheet.getRow('10').values = technicalHeaders;

    worksheet.getRow(10).eachCell((cell) => {
      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
        bold: true,
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8EA9DB' },
      };
    });

    // Ocultar fila 10
    worksheet.getRow(10).hidden = true;

    /* ========================================================
       DATOS — DESDE FILA 11
    ======================================================== */

    const data = buildPlanFioriData();

    const dataRows = data.map((record) => [
      record['*Posición (10)'],
      record['Descripción de posición (15)'],
      record['Descripción media posición balance contable (50)'],
      record['Descripción explicativa de pos.balance contable (250)'],
      record['*Tipo de posición FS (10)'],
      record['Tipo de imputación (4)'],
      record['Bloqueado para contabilización (1)'],
      record['Es posición de consolidación (1)'],
      record['Arrastre de saldos (1)'],
      record['Título de enlace (255)'],
      record['URL enlace (1333)'],
      record['Rol de posición FS (30)'],
      record['Selección de colección de datos (30)'],
      record['Selección de conversión de moneda (30)'],
      record['Selección de eliminación (30)'],
      record['Selección de flujo de caja (30)'],
      record['Selección de alcance (30)'],
      record['Otra selección (30)'],
      record['Destino de eliminación (10)'],
      record['Destino de participaciones de minorías (10)'],
      record['Destino de planificación (10)'],
      record['Destino de compensación (10)'],
    ]);

    /* ========================================================
      ESCRIBIR DATOS DESDE FILA 11
    ======================================================== */

    dataRows.forEach((rowData, index) => {
      worksheet.getRow(11 + index).values = rowData;
    });

    /* ========================================================
      ANCHO DE COLUMNAS
    ======================================================== */

    headers.forEach((header, index) => {
      const maxLength = Math.max(
        String(header ?? '').length,
        ...dataRows.map((row) => String(row[index + 1] ?? '').length)
      );

      worksheet.getColumn(index + 1).width = Math.min(maxLength + 2, 60);
    });

    /* ========================================================
       VALUEHELPDATA
    ======================================================== */

    /* ========================================================
       HOJA POSICIÓN
    ======================================================== */
    const worksheetData = workbook.addWorksheet('valuehelpdata');

    const valueHelpHeaders = [
      'CONSOLIDATIONCHARTOFACCOUNTS',
      'CONSOLIDATIONVERSION',
      'LANGUAGE',
      'FINANCIALSTATEMENTITEMTYPE',
      'BREAKDOWNCATEGORY',
      'FINANCIALSTATEMENTITEMISBLKD',
      'ISCONSOLIDATIONITEM',
      'NETBALANCEISCARRIEDFORWARD',
      'FSITEMELIMINATION',
      'FSITEMCURRENCYTRANSLATION',
      'FSITEMDATACOLLECTION',
      'FSITEMCASHFLOW',
      'FSITEMSCOPE',
      'FSITEMCUSTOMERSPECIFIC',
      'FINANCIALSTATEMENTITEMROLE',
    ];

    worksheetData.getCell('A1').value = 'valuehelpdata';

    worksheetData.getCell('A1').font = {
      name: 'Aptos Narrow',
      size: 22,
      bold: true,
      color: { argb: '000000' },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8EA9DB' },
      },
    };
    worksheetData.getRow('2').values = valueHelpHeaders;

    worksheetData.getRow(2).eachCell((cell) => {
      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
        bold: true,
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8EA9DB' },
      };
    });

    worksheetData.getCell('A3').value = `${plan} -- ${planDesc}`;

    worksheetData.getCell('B3').value = `${version} -- ${versionDesc}`;

    worksheetData.getCell('C3').value = `${idioma} -- ${descripcionIdioma}`;

    /* ========================================================
       OCULTAR VALUEHELPDATA
    ======================================================== */
    worksheetData.state = 'hidden';

    /* ========================================================
       NOMBRE ARCHIVO
    ======================================================== */

    const periodoFile = periodo.replace('/', '_');

    const filename = `Fiori_PlanCuentas_${plan}_${version}_${periodoFile}.xlsx`;

    /* ========================================================
       GENERAR ARCHIVO
    ======================================================== */

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

    document.getElementById(
      'plan-gen-status'
    ).textContent = `Archivo generado correctamente: ${filename}`;
  } catch (error) {
    console.error(error);

    alert(`No fue posible generar el archivo:\n${error.message}`);
  }
}

/* ============================================================
   INPUT PLAN
============================================================ */

function initPlanFileInput() {
  const input = $('plan-file-input');

  if (!input) return;

  input.addEventListener('change', (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    PLAN_CURRENT_FILE = file;

    PLAN_RESULT = null;

    hide($('plan-step3'));
    hide($('plan-step4'));

    $('btn-plan-process').disabled = false;

    setStatus($('plan-file-status'), `Archivo seleccionado: ${file.name}`);
  });
}

/* ============================================================
   IA PLAN
============================================================ */

async function analyzePlanWithAI() {
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
   *
   * originalRow identifica de forma única la fila.
   *
   * cuentaLocal puede repetirse y NO se utiliza como
   * identificador técnico.
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
   * 5. ESTADO — ANALIZANDO
   * ============================================================
   */

  if (btn) {
    // btn.disabled = true;

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

  statusLine.textContent = 'Analizando';

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
            La IA está revisando
            ${registros.length.toLocaleString('es-ES')}
            registros…
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
     * 7. LLAMADA A LA IA
     * ==========================================================
     */

    const response = await fetch(FLOW_URL, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        registros,
      }),
    });

    /*
     * ==========================================================
     * 8. VALIDAR HTTP
     * ==========================================================
     */

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Error HTTP ${response.status}: ${errorText}`);
    }

    /*
     * ==========================================================
     * 9. LEER RESPUESTA
     * ==========================================================
     */

    const aiResponse = await response.json();

    /*
     * ==========================================================
     * 10. VALIDAR RESPUESTA IA
     * ==========================================================
     */

    if (!aiResponse || typeof aiResponse !== 'object') {
      throw new Error('La IA no devolvió una respuesta JSON válida.');
    }

    /*
     * ==========================================================
     * 11. OBTENER RESULTADOS
     * ==========================================================
     */

    const suggestions = Array.isArray(aiResponse.registros)
      ? aiResponse.registros
      : [];

    const incidents = Array.isArray(aiResponse.incidencias)
      ? aiResponse.incidencias
      : [];

    /*
     * ==========================================================
     * 12. VALIDAR IDENTIFICADORES DEVUELTOS
     * ==========================================================
     *
     * originalRow debe corresponder a una fila que realmente
     * fue enviada a la IA.
     */

    /*
     * ==========================================================
     * 14. DETECTAR CAMBIOS REALES
     * ==========================================================
     */

    const realSuggestions = suggestions.filter((suggestion) => {
      const descripcionCambio =
        suggestion.descripcion_sugerida !== undefined &&
        normalizeAIValue(suggestion.descripcion_sugerida) !==
          normalizeAIValue(suggestion.descripcion_original);

      const acctypeCambio =
        suggestion.acctype_sugerido !== undefined &&
        normalizeAIValue(suggestion.acctype_sugerido) !==
          normalizeAIValue(suggestion.acctype_original);

      const typelimCambio =
        suggestion.typelim_sugerido !== undefined &&
        normalizeAIValue(suggestion.typelim_sugerido) !==
          normalizeAIValue(suggestion.typelim_original);

      const conversionCambio =
        suggestion.conversion_sugerida !== undefined &&
        normalizeAIValue(suggestion.conversion_sugerida) !==
          normalizeAIValue(suggestion.conversion_original);

      return (
        descripcionCambio || acctypeCambio || typelimCambio || conversionCambio
      );
    });

    /*
     * ==========================================================
     * 15. GUARDAR RESULTADOS
     * ==========================================================
     */

    PLAN_RESULT.aiSuggestion = realSuggestions;

    PLAN_RESULT.aiIncidents = incidents;

    /*
     * ==========================================================
     * 17. CONSTRUIR HTML
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
     * 18. CAMBIOS PROPUESTOS
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
           * ------------------------------------------------
           * DESCRIPCIÓN
           * ------------------------------------------------
           */

          if (
            suggestion.descripcion_sugerida !== undefined &&
            normalizeAIValue(suggestion.descripcion_sugerida) !==
              normalizeAIValue(suggestion.descripcion_original)
          ) {
            cambios.push(`
                  <div class="ai-field-change">

                    <strong>
                      Descripción
                    </strong>

                    <div class="ai-field-values">

                      <span class="ai-old-value">
                        ${escapeHtml(suggestion.descripcion_original || '—')}
                      </span>

                      <span class="ai-arrow">
                        →
                      </span>

                      <span class="ai-new-value">
                        ${escapeHtml(suggestion.descripcion_sugerida || '—')}
                      </span>

                    </div>

                  </div>
                `);
          }

          /*
           * ------------------------------------------------
           * ACCTYPE
           * ------------------------------------------------
           */

          if (
            suggestion.acctype_sugerido !== undefined &&
            normalizeAIValue(suggestion.acctype_sugerido) !==
              normalizeAIValue(suggestion.acctype_original)
          ) {
            cambios.push(`
                  <div class="ai-field-change">

                    <strong>
                      ACCTYPE
                    </strong>

                    <div class="ai-field-values">

                      <span class="ai-old-value">
                        ${escapeHtml(suggestion.acctype_original || '—')}
                      </span>

                      <span class="ai-arrow">
                        →
                      </span>

                      <span class="ai-new-value">
                        ${escapeHtml(suggestion.acctype_sugerido || '—')}
                      </span>

                    </div>

                  </div>
                `);
          }

          /*
           * ------------------------------------------------
           * TYPELIM
           * ------------------------------------------------
           */

          if (
            suggestion.typelim_sugerido !== undefined &&
            normalizeAIValue(suggestion.typelim_sugerido) !==
              normalizeAIValue(suggestion.typelim_original)
          ) {
            cambios.push(`
                  <div class="ai-field-change">

                    <strong>
                      TYPELIM
                    </strong>

                    <div class="ai-field-values">

                      <span class="ai-old-value">
                        ${escapeHtml(suggestion.typelim_original || '—')}
                      </span>

                      <span class="ai-arrow">
                        →
                      </span>

                      <span class="ai-new-value">
                        ${escapeHtml(suggestion.typelim_sugerido || '—')}
                      </span>

                    </div>

                  </div>
                `);
          }

          /*
           * ------------------------------------------------
           * CONVERSION
           * ------------------------------------------------
           */

          if (
            suggestion.conversion_sugerida !== undefined &&
            normalizeAIValue(suggestion.conversion_sugerida) !==
              normalizeAIValue(suggestion.conversion_original)
          ) {
            cambios.push(`
                  <div class="ai-field-change">

                    <strong>
                      CONVERSION
                    </strong>

                    <div class="ai-field-values">

                      <span class="ai-old-value">
                        ${escapeHtml(suggestion.conversion_original || '—')}
                      </span>

                      <span class="ai-arrow">
                        →
                      </span>

                      <span class="ai-new-value">
                        ${escapeHtml(suggestion.conversion_sugerida || '—')}
                      </span>

                    </div>

                  </div>
                `);
          }

          /*
           * ------------------------------------------------
           * FILA
           * ------------------------------------------------
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
                      ${escapeHtml(suggestion.cuenta || 'Sin cuenta')}
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
                            ${escapeHtml(suggestion.cuentaLocal)}
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
                      ${escapeHtml(String(suggestion.originalRow))}
                    </div>

                  </td>

                  <td>

                    ${cambios.join('')}

                    ${
                      suggestion.explicacion
                        ? `
                          <div class="ai-row-explanation">

                            <i class="ti ti-bulb"></i>

                            ${escapeHtml(suggestion.explicacion)}

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
     * 19. INCIDENCIAS IA
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
                      ${escapeHtml(incident.cuenta || 'Cuenta')}
                    </strong>

                    —

                    ${escapeHtml(incident.explicacion || '')}

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
     * 20. SIN CAMBIOS NI INCIDENCIAS
     * ==========================================================
     */

    if (!realSuggestions.length && !incidents.length) {
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
     * 21. BOTÓN APLICAR
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
     * 22. MOSTRAR RESULTADO
     * ==========================================================
     */

    aiResult.innerHTML = html;

    /*
     * ==========================================================
     * 23. CONECTAR BOTÓN APLICAR
     * ==========================================================
     */

    const btnApplyAI = document.getElementById('btn-apply-ai-plan');

    if (btnApplyAI) {
      btnApplyAI.addEventListener('click', async () => {
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
          const cambiosAplicados = await applyAISuggestionsPlan();

          statusLine.textContent = `✓ Se aplicaron ${cambiosAplicados} cambio(s).`;

          statusLine.classList.add('ready');

          btnApplyAI.innerHTML = `
              <i class="ti ti-check"></i>

              Cambios aplicados
            `;
        } catch (error) {
          console.error('Error aplicando cambios IA:', error);

          btnApplyAI.disabled = false;

          btnApplyAI.innerHTML = `
              <i class="ti ti-check"></i>

              Aplicar cambios seleccionados
            `;

          statusLine.textContent = 'No se pudieron aplicar los cambios.';

          statusLine.classList.remove('ready');
        }
      });
    }

    /*
     * ==========================================================
     * 24. ESTADO FINAL
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
    console.error('Error al ejecutar el análisis con IA:', error);

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

          ${escapeHtml(error.message || 'Error desconocido')}

        </div>

      </div>
    `;

    statusLine.textContent = 'Error';

    statusLine.classList.remove('ready');
  } finally {
    /*
     * ==========================================================
     * RESTAURAR BOTÓN
     * ==========================================================
     */

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

function normalizeAIValue(value) {
  return normalize(value).toUpperCase().replace(/\s+/g, ' ').trim();
}

async function applyAISuggestionsPlan() {
  /*
   * ============================================================
   * 1. VALIDACIÓN
   * ============================================================
   */

  if (!PLAN_RESULT) {
    console.warn('No existe PLAN_RESULT.');
    return 0;
  }

  const aiSuggestions = Array.isArray(PLAN_RESULT.aiSuggestion)
    ? PLAN_RESULT.aiSuggestion
    : [];

  if (!aiSuggestions.length) {
    console.warn('No existen sugerencias de IA para aplicar.');
    return 0;
  }

  /*
   * ============================================================
   * 2. CHECKBOXES SELECCIONADOS
   * ============================================================
   */

  const checkboxes = document.querySelectorAll(
    '#ai-result-plan .ai-change-checkbox:checked'
  );

  if (!checkboxes.length) {
    alert('Selecciona al menos un cambio para aplicar.');
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
    const index = Number(checkbox.dataset.aiIndex);

    const suggestion = aiSuggestions[index];

    /*
     * ----------------------------------------------------------
     * VALIDAR SUGERENCIA
     * ----------------------------------------------------------
     */

    if (!suggestion) {
      console.warn('No existe sugerencia IA para el índice:', index);

      return;
    }

    /*
     * ----------------------------------------------------------
     * IDENTIFICAR REGISTRO POR ORIGINAL ROW
     * ----------------------------------------------------------
     *
     * originalRow identifica la fila original.
     *
     * NO utilizamos cuentaLocal porque puede repetirse.
     * ----------------------------------------------------------
     */

    const originalRow = Number(suggestion.originalRow);

    if (!Number.isFinite(originalRow)) {
      console.warn(
        'La sugerencia IA no contiene un originalRow válido:',
        suggestion
      );

      return;
    }

    const record = (PLAN_RESULT.records || []).find(
      (item) => Number(item.originalRow) === originalRow
    );

    /*
     * ----------------------------------------------------------
     * VALIDAR REGISTRO
     * ----------------------------------------------------------
     */

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
     * ==========================================================
     * DESCRIPCIÓN
     * ==========================================================
     */

    if (
      suggestion.descripcion_sugerida !== undefined &&
      normalizeAIValue(suggestion.descripcion_sugerida) !==
        normalizeAIValue(record.descripcion)
    ) {
      record.descripcion = suggestion.descripcion_sugerida;

      modificado = true;
    }

    /*
     * ==========================================================
     * ACCTYPE
     * ==========================================================
     */

    if (
      suggestion.acctype_sugerido !== undefined &&
      normalizeAIValue(suggestion.acctype_sugerido) !==
        normalizeAIValue(record.acctype)
    ) {
      record.acctype = suggestion.acctype_sugerido;

      modificado = true;
    }

    /*
     * ==========================================================
     * TYPELIM
     * ==========================================================
     */

    if (
      suggestion.typelim_sugerido !== undefined &&
      normalizeAIValue(suggestion.typelim_sugerido) !==
        normalizeAIValue(record.typelim)
    ) {
      record.typelim = suggestion.typelim_sugerido;

      modificado = true;
    }

    /*
     * ==========================================================
     * CONVERSION
     * ==========================================================
     */

    if (
      suggestion.conversion_sugerida !== undefined &&
      normalizeAIValue(suggestion.conversion_sugerida) !==
        normalizeAIValue(record.conversion)
    ) {
      record.conversion = suggestion.conversion_sugerida;

      modificado = true;
    }

    /*
     * ----------------------------------------------------------
     * REGISTRAR CAMBIO
     * ----------------------------------------------------------
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
    alert('No se pudo aplicar ningún cambio seleccionado.');
    return 0;
  }

  /*
   * ============================================================
   * 6. ELIMINAR ÚNICAMENTE LAS SUGERENCIAS YA APLICADAS
   * ============================================================
   *
   * IMPORTANTE:
   *
   * Aquí NO eliminamos registros de PLAN_RESULT.records.
   *
   * Solamente eliminamos de aiSuggestion las sugerencias que
   * ya fueron aplicadas para que no vuelvan a aparecer como
   * pendientes.
   * ============================================================
   */

  indicesAplicados
    .sort((a, b) => b - a)
    .forEach((index) => {
      PLAN_RESULT.aiSuggestion.splice(index, 1);
    });

  /*
   * ============================================================
   * 7. SINCRONIZAR DATOS
   * ============================================================
   */

  PLAN_RAW_DATA = PLAN_RESULT.records;

  /*
   * ============================================================
   * 8. REVALIDAR
   * ============================================================
   */

  const validationResult = processPlan(PLAN_RESULT.records);

  /*
   * ============================================================
   * 9. CONSERVAR INFORMACIÓN IA
   * ============================================================
   */

  const aiSuggestionRestantes = PLAN_RESULT.aiSuggestion || [];

  const aiIncidents = PLAN_RESULT.aiIncidents || [];

  PLAN_RESULT = {
    ...validationResult,

    aiSuggestion: aiSuggestionRestantes,

    aiIncidents: aiIncidents,
  };

  /*
   * ============================================================
   * 10. ACTUALIZAR RESUMEN
   * ============================================================
   */

  const summary = buildPlanSummary(PLAN_RESULT);

  renderPlanSummary(summary);

  /*
   * ============================================================
   * 11. ACTUALIZAR INCIDENCIAS
   * ============================================================
   */

  renderPlanIncidents(PLAN_RESULT.incidents);

  /*
   * ============================================================
   * 12. COMPROBAR ERRORES
   * ============================================================
   */

  const errors = PLAN_RESULT.incidents.filter(
    (incident) => incident.severity === 'Error'
  );

  const warnings = PLAN_RESULT.incidents.filter(
    (incident) => incident.severity === 'Warning'
  );

  const hasErrors = errors.length > 0;

  /*
   * ============================================================
   * 13. BOTÓN GENERAR
   * ============================================================
   */

  // $('btn-plan-generate').disabled = hasErrors;

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

    $('ai-status-plan').textContent = 'Incidencias pendientes';

    $('ai-status-plan').classList.add('ready');
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

    $('ai-status-plan').textContent = 'Validación correcta';

    $('ai-status-plan').classList.add('ready');
  }

  /*
   * ============================================================
   * 15. SCROLL
   * ============================================================
   */

  scrollToElement($('plan-step3'));

  return cambiosAplicados;
}

/* ============================================================
   VALIDACIÓN EN TIEMPO REAL
============================================================ */

function initParameterValidation() {
  const hierarchyFields = ['f-id', 'f-desc', 'f-inicio', 'f-fin', 'f-coa'];

  hierarchyFields.forEach((id) => {
    const element = $(id);

    element?.addEventListener('input', () => {
      if (RESULT) {
        RESULT = null;

        hide($('step3'));
        hide($('step4'));

        $('btn-generate').disabled = false;
      }
    });
  });

  const planFields = [
    'p-plan',
    'p-plan-desc',
    'p-version',
    'p-version-desc',
    'p-periodo',
    'p-idioma',
  ];

  planFields.forEach((id) => {
    const element = $(id);

    element?.addEventListener('input', () => {
      if (PLAN_RESULT) {
        PLAN_RESULT = null;

        hide($('plan-step3'));
        hide($('plan-step4'));

       // $('btn-plan-generate').disabled = true;
      }
    });
  });
}
function eliminarDuplicadosExactosDePlan() {
  if (!PLAN_RESULT?.records?.length) {
    return 0;
  }

  const duplicados = detectarDuplicadosExactos(PLAN_RESULT.records);

  if (!duplicados.length) {
    return 0;
  }

  const cuentasAEliminar = new Set(
    duplicados.map((item) => String(item.cuentaLocal ?? '').trim())
  );

  const antes = PLAN_RESULT.records.length;

  PLAN_RESULT.records = PLAN_RESULT.records.filter(
    (record) => !cuentasAEliminar.has(String(record.cuentaLocal ?? '').trim())
  );

  const eliminados = antes - PLAN_RESULT.records.length;

  return eliminados;
}
/* ============================================================
   RESET
============================================================ */

function resetHierarchy() {
  RAW_DATA = [];
  CUENTAS_MAP = new Map();
  RESULT = null;
  CURRENT_FILE = null;

  $('file-input').value = '';

  setStatus($('file-status'), '');

  hide($('step3'));
  hide($('step4'));

 // $('btn-process').disabled = true;
  $('btn-generate').disabled = false;

  $('summary-bar').innerHTML = '';
  $('incidencias-table').innerHTML = '';
  $('ai-result-jerarquia').innerHTML = '';

  $('ai-status').textContent = 'Listo';
  $('ai-status').classList.remove('ready');
}

function resetPlan() {
  PLAN_RAW_DATA = [];
  PLAN_RESULT = null;
  PLAN_CURRENT_FILE = null;

  $('plan-file-input').value = '';

  setStatus($('plan-file-status'), '');

  hide($('plan-step3'));
  hide($('plan-step4'));

  // $('btn-plan-process').disabled = true;
  // $('btn-plan-generate').disabled = true;

  $('plan-summary-bar').innerHTML = '';
  $('plan-incidencias-table').innerHTML = '';
  $('ai-result-plan').innerHTML = '';

  $('ai-status-plan').textContent = 'Listo';
  $('ai-status-plan').classList.remove('ready');
}

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
