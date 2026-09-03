import {
  normalize,
  normalizeKey,
} from '../utils/helpers.js';

/* ============================================================
   IDENTIFICACIÓN DE ESTRUCTURA
============================================================ */

export function isStructuralId(id, records, currentIndex) {
  const value = normalize(id);

  if (!value) return false;

  const key = normalizeKey(value);

  for (let i = 0; i < records.length; i++) {
    if (i === currentIndex) continue;

    const otherId = normalizeKey(records[i]?.id);

    if (!otherId || otherId === key) continue;

    if (
      otherId.startsWith(key) &&
      otherId.length > key.length
    ) {
      return true;
    }
  }

  if (value.includes('.')) return true;

  if (
    value.includes('-') &&
    value.split('-').length > 1
  ) {
    return true;
  }

  if (/^\d+$/.test(value) && value.length <= 4) {
    return true;
  }

  return false;
}

/* ============================================================
   CÁLCULO DE NIVELES
============================================================ */

export function calculateLevels(records, hierarchyId) {
  const byId = new Map();

  records.forEach((r) => {
    byId.set(normalizeKey(r.id), r);
  });

  function getLevel(record, visited = new Set()) {
    const key = normalizeKey(record.id);

    if (visited.has(key)) return 0;

    visited.add(key);

    if (!record.parentId) return 0;

    if (
      normalizeKey(record.parentId) ===
      normalizeKey(hierarchyId)
    ) {
      return 1;
    }

    const parent = byId.get(
      normalizeKey(record.parentId)
    );

    if (!parent) return 0;

    return getLevel(parent, visited) + 1;
  }

  records.forEach((r) => {
    r.level = getLevel(r);
  });

  return records;
}

/* ============================================================
   CLASIFICACIÓN DE NODOS
============================================================ */

export function classifyNode(record, childrenMap, records) {
  const id = normalizeKey(record.id);

  const children = childrenMap.get(id) || [];

  if (children.length > 0) {
    return 'Nodo';
  }

  const index = records.indexOf(record);

  if (
    isStructuralId(
      record.id,
      records,
      index
    )
  ) {
    return 'Nodo';
  }

  return 'Posición de cuenta de explotación de consolidación';
}

/* ============================================================
   PROCESAMIENTO PRINCIPAL DE JERARQUÍA
============================================================ */

export function processHierarchy(rows, cuentasMap, hierarchyId, hierarchyDesc) {
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