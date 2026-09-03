import {
    $,
    normalize,
    normalizeKey,
    escapeHtml,
    setStatus,
} from '../utils/helpers.js';

/* ============================================================
   DEPENDENCIAS DEL MÓDULO
============================================================ */

let hierarchyDependencies = {
    getResult: () => null,
    calculateLevels: () => {},
    refreshHierarchyIncidents: () => {},
    buildSummary: () => ({
        total: 0,
        errors: 0,
        warnings: 0,
        roots: 0,
        levels: 0,
    }),
    renderSummary: () => {},
};

/**
 * Configura las funciones que pertenecen a main.js.
 *
 * Esto permite que el módulo trabaje con RESULT y
 * con las funciones de procesamiento sin crear
 * dependencias circulares entre módulos.
 */
export function configureHierarchyTree(dependencies = {}) {
    hierarchyDependencies = {
        ...hierarchyDependencies,
        ...dependencies,
    };
}

/* ============================================================
   OBTENER RESULTADO ACTUAL
============================================================ */

function getResult() {
    return hierarchyDependencies.getResult();
}

/* ============================================================
   MAPA DE ÁRBOL
============================================================ */

export function buildHierarchyTreeMap(records) {
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

/* ============================================================
   DRAG & DROP DE JERARQUÍA
============================================================ */

export function enableHierarchyDragAndDrop(wrapper, record) {
    wrapper.draggable = true;

    wrapper.addEventListener('dragstart', (event) => {
        if (event.target.closest('.hierarchy-delete')) {
            event.preventDefault();
            return;
        }

        event.stopPropagation();

        event.dataTransfer.effectAllowed = 'move';

        event.dataTransfer.setData(
            'text/plain',
            normalizeKey(record.id)
        );

        wrapper.classList.add('hierarchy-dragging');
    });

    wrapper.addEventListener('dragend', (event) => {
        if (event.target.closest('.hierarchy-delete')) {
            event.preventDefault();
            return;
        }

        event.stopPropagation();

        wrapper.classList.remove('hierarchy-dragging');

        document
            .querySelectorAll('.hierarchy-drop-target')
            .forEach((element) => {
                element.classList.remove(
                    'hierarchy-drop-target'
                );
            });
    });

    wrapper.addEventListener('dragover', (event) => {
        if (event.target.closest('.hierarchy-delete')) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const draggedId =
            event.dataTransfer.getData('text/plain');

        if (!draggedId) {
            return;
        }

        const targetId = normalizeKey(record.id);

        /*
         * No permitimos soltarse sobre sí mismo.
         */

        if (draggedId === targetId) {
            return;
        }

        const result = getResult();

        if (!result?.records?.length) {
            return;
        }

        const targetRecord = result.records.find(
            (item) =>
                normalizeKey(item.id) === targetId
        );

        if (!targetRecord) {
            return;
        }

        const hasChildren = result.records.some(
            (item) =>
                normalizeKey(item.parentId) === targetId
        );

        /*
         * Solo se puede soltar sobre un Nodo.
         */

        if (!hasChildren) {
            return;
        }

        /*
         * Evitar introducir un nodo dentro
         * de uno de sus propios descendientes.
         */

        if (
            isHierarchyDescendant(
                draggedId,
                targetId,
                result.records
            )
        ) {
            return;
        }

        event.dataTransfer.dropEffect = 'move';

        wrapper.classList.add(
            'hierarchy-drop-target'
        );
    });

    wrapper.addEventListener('dragleave', (event) => {
        event.stopPropagation();

        /*
         * Solo quitamos el efecto si realmente
         * salimos del elemento.
         */

        if (!wrapper.contains(event.relatedTarget)) {
            wrapper.classList.remove(
                'hierarchy-drop-target'
            );
        }
    });

    wrapper.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();

        wrapper.classList.remove(
            'hierarchy-drop-target'
        );

        const draggedId =
            event.dataTransfer.getData('text/plain');

        if (!draggedId) {
            return;
        }

        moveHierarchyRecord(
            draggedId,
            normalizeKey(record.id)
        );
    });
}

/* ============================================================
   COMPROBAR SI targetId ES DESCENDIENTE DE draggedId
============================================================ */

export function isHierarchyDescendant(
    draggedId,
    targetId,
    records
) {
    let currentId = targetId;

    const visited = new Set();

    while (currentId) {
        const currentKey =
            normalizeKey(currentId);

        if (visited.has(currentKey)) {
            return true;
        }

        visited.add(currentKey);

        if (
            currentKey ===
            normalizeKey(draggedId)
        ) {
            return true;
        }

        const currentRecord = records.find(
            (record) =>
                normalizeKey(record.id) ===
                currentKey
        );

        if (!currentRecord) {
            return false;
        }

        currentId = currentRecord.parentId;
    }

    return false;
}

/* ============================================================
   MOVER REGISTRO
============================================================ */

export function moveHierarchyRecord(
    draggedId,
    targetId
) {
    const result = getResult();

    if (!result?.records?.length) {
        return;
    }

    const draggedRecord = result.records.find(
        (record) =>
            normalizeKey(record.id) ===
            normalizeKey(draggedId)
    );

    const targetRecord = result.records.find(
        (record) =>
            normalizeKey(record.id) ===
            normalizeKey(targetId)
    );

    if (!draggedRecord || !targetRecord) {
        return;
    }

    /*
     * No permitir moverse sobre sí mismo.
     */

    if (
        normalizeKey(draggedRecord.id) ===
        normalizeKey(targetRecord.id)
    ) {
        return;
    }

    /*
     * Solo los nodos pueden recibir hijos.
     */

    const targetHasChildren =
        result.records.some(
            (record) =>
                normalizeKey(record.parentId) ===
                normalizeKey(targetRecord.id)
        );

    if (!targetHasChildren) {
        alert(
            'Solo puedes mover elementos dentro de un Nodo.'
        );

        return;
    }

    /*
     * Evitar ciclos.
     */

    if (
        isHierarchyDescendant(
            draggedRecord.id,
            targetRecord.id,
            result.records
        )
    ) {
        alert(
            'No puedes mover un elemento dentro de uno de sus propios descendientes.'
        );

        return;
    }

    /*
     * Actualizamos el padre.
     */

    draggedRecord.parentId =
        targetRecord.id;

    /*
     * Recalculamos niveles.
     */

    const hierarchyId =
        normalize($('f-id')?.value);

    hierarchyDependencies.calculateLevels(
        result.records,
        hierarchyId
    );

    /*
     * Volvemos a dibujar el árbol.
     */

    renderHierarchyTree(result, true);

    /*
     * Actualizamos incidencias.
     */

    if (
        typeof hierarchyDependencies
            .refreshHierarchyIncidents ===
        'function'
    ) {
        hierarchyDependencies
            .refreshHierarchyIncidents();
    }
}

/* ============================================================
   ELIMINAR ELEMENTO DE LA JERARQUÍA
============================================================ */

export function deleteHierarchyRecord(recordId) {
  
    const result = getResult();

    if (!result?.records?.length) {
        return;
    }

    const record = result.records.find(
        (item) =>
            normalizeKey(item.id) ===
            normalizeKey(recordId)
    );

    if (!record) {
        console.warn(
            'No se encontró el registro:',
            recordId
        );

        return;
    }

    /* ========================================================
       PROTEGER LA RAÍZ
    ======================================================== */

    const hierarchyId =
        normalize($('f-id')?.value);

    if (
        normalizeKey(record.id) ===
        normalizeKey(hierarchyId)
    ) {
        return;
    }

    /* ========================================================
       COMPROBAR SI TIENE HIJOS
    ======================================================== */

    const children = result.records.filter(
        (item) =>
            normalizeKey(item.parentId) ===
            normalizeKey(record.id)
    );

    const hasChildren =
        children.length > 0;

    /* ========================================================
       ABRIR MODAL
    ======================================================== */

    showHierarchyConfirmModal({
        title: 'Eliminar elemento',

        message: `¿Seguro que quieres eliminar "${
            record.descripcion || record.id
        }"?`,

        hasChildren,

        onConfirm: () => {
          

            /* ====================================================
               OBTENER TODA LA RAMA
            ==================================================== */

            const idsToDelete =
                new Set([
                    normalizeKey(record.id),
                ]);

            let changed = true;

            while (changed) {
                changed = false;

                result.records.forEach((item) => {
                    const itemParent =
                        normalizeKey(
                            item.parentId
                        );

                    const itemId =
                        normalizeKey(item.id);

                    if (
                        itemParent &&
                        idsToDelete.has(
                            itemParent
                        ) &&
                        !idsToDelete.has(
                            itemId
                        )
                    ) {
                        idsToDelete.add(
                            itemId
                        );

                        changed = true;
                    }
                });
            }

           

            /* ====================================================
               ELIMINAR REGISTROS
            ==================================================== */

            result.records =
                result.records.filter(
                    (item) =>
                        !idsToDelete.has(
                            normalizeKey(
                                item.id
                            )
                        )
                );

         

            /* ====================================================
               RECALCULAR NIVELES
            ==================================================== */

            hierarchyDependencies.calculateLevels(
                result.records,
                hierarchyId
            );

            /* ====================================================
               ACTUALIZAR INCIDENCIAS
            ==================================================== */

            if (
                typeof hierarchyDependencies
                    .refreshHierarchyIncidents ===
                'function'
            ) {
                hierarchyDependencies
                    .refreshHierarchyIncidents();
            }

            /* ====================================================
               ACTUALIZAR RESUMEN
            ==================================================== */

            const summary =
                hierarchyDependencies.buildSummary(
                    result.records,
                    result.incidents,
                    hierarchyId
                );

            hierarchyDependencies.renderSummary(
                $('summary-bar'),
                summary
            );

            /* ====================================================
               REDIBUJAR
            ==================================================== */

            renderHierarchyTree(
                result,
                true
            );


        },
    });
}

/* ============================================================
   CREAR NODO VISUAL
============================================================ */

export function createHierarchyTreeNode(
    record,
    childrenMap,
    expanded = true,
    path = new Set()
) {
    const recordKey =
        normalizeKey(record.id);

    /* ========================================================
       PROTECCIÓN CONTRA CICLOS
    ======================================================== */

    if (
        recordKey &&
        path.has(recordKey)
    ) {
        console.error(
            '🚨 Ciclo detectado durante el render:',
            {
                id: record.id,
                parentId: record.parentId,
            }
        );

        const cycleNode =
            document.createElement('div');

        cycleNode.className =
            'hierarchy-node hierarchy-node-error';

        cycleNode.innerHTML = `
      <div class="hierarchy-node-row hierarchy-node-error">
        <span class="hierarchy-toggle">⚠️</span>
        <span class="hierarchy-icon">🔄</span>
        <span class="hierarchy-id">
          ${escapeHtml(record.id)}
        </span>
        <span class="hierarchy-description">
          Ciclo detectado en la jerarquía
        </span>
        <span class="hierarchy-type">Error</span>
      </div>
    `;

        return cycleNode;
    }

    /* ========================================================
       PATH DE LA RAMA ACTUAL
    ======================================================== */

    const currentPath =
        new Set(path);

    if (recordKey) {
        currentPath.add(recordKey);
    }

    /* ========================================================
       HIJOS
    ======================================================== */

    const children =
        childrenMap.get(recordKey) || [];

    const hasChildren =
        children.length > 0;

    /* ========================================================
       WRAPPER PRINCIPAL
    ======================================================== */

    const wrapper =
        document.createElement('div');

    wrapper.className =
        'hierarchy-node';

    wrapper.dataset.id =
        record.id;

    /* ========================================================
       FILA
    ======================================================== */

    const nodeRow =
        document.createElement('div');

    nodeRow.className =
        'hierarchy-node-row';

    /*
     * Solo la fila se puede arrastrar.
     */

    enableHierarchyDragAndDrop(
        nodeRow,
        record
    );

    /* ========================================================
       BOTÓN EXPANDIR / CONTRAER
    ======================================================== */

    const toggle =
        document.createElement('button');

    toggle.type = 'button';

    toggle.className =
        'hierarchy-toggle';

    if (hasChildren) {
        toggle.textContent =
            expanded ? '▼' : '▶';

        toggle.title =
            expanded
                ? 'Contraer'
                : 'Expandir';
    } else {
        toggle.textContent = '•';

        toggle.classList.add('leaf');

        toggle.disabled = true;
    }

    /* ========================================================
       ICONO
    ======================================================== */

    const icon =
        document.createElement('span');

    icon.className =
        'hierarchy-icon';

    icon.textContent =
        hasChildren
            ? '📁'
            : '📄';

    /* ========================================================
       ID
    ======================================================== */

    const id =
        document.createElement('span');

    id.className =
        'hierarchy-id';

    id.textContent =
        record.id;

    /* ========================================================
       DESCRIPCIÓN
    ======================================================== */

    const description =
        document.createElement('span');

    description.className =
        'hierarchy-description';

    description.textContent =
        record.descripcion;

    /* ========================================================
       TIPO
    ======================================================== */

    const type =
        document.createElement('span');

    type.className =
        'hierarchy-type';

    type.textContent =
        hasChildren
            ? 'Nodo'
            : 'Posición de cuenta de explotación de consolidación';

    /* ========================================================
       BOTÓN ELIMINAR
    ======================================================== */

    const deleteButton =
        document.createElement('button');

    deleteButton.type = 'button';

    deleteButton.className =
        'hierarchy-delete';

    deleteButton.textContent =
        '🗑️';

    deleteButton.title =
        'Eliminar';

    deleteButton.draggable =
        false;

    deleteButton.addEventListener(
        'mousedown',
        (event) => {
            event.stopPropagation();
        }
    );

    deleteButton.addEventListener(
        'dragstart',
        (event) => {
            event.preventDefault();
            event.stopPropagation();
        }
    );

    deleteButton.addEventListener(
        'click',
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            deleteHierarchyRecord(
                record.id
            );
        }
    );

    /* ========================================================
       ERROR
    ======================================================== */

    if (record.valid === false) {
        nodeRow.classList.add(
            'hierarchy-node-error'
        );
    }

    /* ========================================================
       ARMAR FILA
    ======================================================== */

    nodeRow.appendChild(toggle);
    nodeRow.appendChild(icon);
    nodeRow.appendChild(id);
    nodeRow.appendChild(description);
    nodeRow.appendChild(type);
    nodeRow.appendChild(deleteButton);

    wrapper.appendChild(nodeRow);

    /* ========================================================
       CONTENEDOR DE HIJOS
    ======================================================== */

    if (hasChildren) {
        const childrenContainer =
            document.createElement('div');

        childrenContainer.className =
            'hierarchy-children';

        if (!expanded) {
            childrenContainer.style.display =
                'none';
        }

        children.forEach((child) => {
            const childNode =
                createHierarchyTreeNode(
                    child,
                    childrenMap,
                    expanded,
                    currentPath
                );

            childrenContainer.appendChild(
                childNode
            );
        });

        wrapper.appendChild(
            childrenContainer
        );

        /* ====================================================
           EXPANDIR / CONTRAER
        ==================================================== */

        toggle.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                const isVisible =
                    childrenContainer.style.display !==
                    'none';

                childrenContainer.style.display =
                    isVisible
                        ? 'none'
                        : '';

                toggle.textContent =
                    isVisible
                        ? '▶'
                        : '▼';

                toggle.title =
                    isVisible
                        ? 'Expandir'
                        : 'Contraer';
            }
        );
    }

    return wrapper;
}

/* ============================================================
   RENDERIZAR TODA LA JERARQUÍA
============================================================ */

export function renderHierarchyTree(
    result,
    expanded = true
) {
    const container =
        $('hierarchy-tree');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (
        !result ||
        !result.records ||
        !result.records.length
    ) {
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

    const treeMap =
        buildHierarchyTreeMap(
            result.records
        );

    /*
     * Las raíces son los registros
     * cuyo padre es la raíz principal.
     */

    const hierarchyId =
        normalize($('f-id')?.value);

    const roots =
        result.records.filter(
            (record) =>
                normalizeKey(
                    record.parentId
                ) ===
                normalizeKey(
                    hierarchyId
                )
        );

    /*
     * Ordenamos igual que Excel.
     */

    roots.sort((a, b) => {
        return (
            a.originalRow -
            b.originalRow
        );
    });

    /*
     * Creamos cada raíz.
     */

    roots.forEach((root) => {
        const node =
            createHierarchyTreeNode(
                root,
                treeMap,
                expanded
            );

        container.appendChild(node);
    });

    /*
     * Por seguridad:
     *
     * si no existen raíces, mostramos mensaje.
     */

    if (!roots.length) {
        container.innerHTML = `
      <div class="hierarchy-empty hierarchy-empty-error">
        ⚠️ No se encontró ninguna raíz en la jerarquía.
      </div>
    `;
    }
}

/* ============================================================
   MODAL DE CONFIRMACIÓN
============================================================ */

let hierarchyModalCallback = null;

/**
 * Abre el modal de confirmación.
 */
export function showHierarchyConfirmModal({
    title = 'Eliminar elemento',
    message = '¿Seguro que quieres eliminar este elemento?',
    hasChildren = false,
    onConfirm = null,
}) {
    const overlay =
        document.getElementById(
            'hierarchy-modal-overlay'
        );

    const titleElement =
        document.getElementById(
            'hierarchy-modal-title'
        );

    const messageElement =
        document.getElementById(
            'hierarchy-modal-message'
        );

    const warningElement =
        document.getElementById(
            'hierarchy-modal-warning'
        );

    if (!overlay) {
        console.error(
            'No se encontró #hierarchy-modal-overlay'
        );

        return;
    }

    titleElement.textContent =
        title;

    messageElement.textContent =
        message;

    warningElement.style.display =
        hasChildren
            ? 'block'
            : 'none';

    hierarchyModalCallback =
        onConfirm;

    overlay.classList.add('show');

    document.body.classList.add(
        'hierarchy-modal-open'
    );

    setTimeout(() => {
        const confirmButton =
            document.getElementById(
                'hierarchy-modal-confirm'
            );

        confirmButton?.focus();
    }, 50);
}

/* ============================================================
   CERRAR MODAL
============================================================ */

export function closeHierarchyConfirmModal() {
    const overlay =
        document.getElementById(
            'hierarchy-modal-overlay'
        );

    if (!overlay) return;

    overlay.classList.remove('show');

    document.body.classList.remove(
        'hierarchy-modal-open'
    );

    hierarchyModalCallback = null;
}

/* ============================================================
   EVENTOS DEL MODAL
============================================================ */

document.addEventListener(
    'DOMContentLoaded',
    () => {
        const overlay =
            document.getElementById(
                'hierarchy-modal-overlay'
            );

        const cancelButton =
            document.getElementById(
                'hierarchy-modal-cancel'
            );

        const confirmButton =
            document.getElementById(
                'hierarchy-modal-confirm'
            );

        if (!overlay) return;

        /* Cancelar */

        cancelButton?.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                closeHierarchyConfirmModal();
            }
        );

        /* Confirmar */

        confirmButton?.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                const callback =
                    hierarchyModalCallback;

                closeHierarchyConfirmModal();

                if (
                    typeof callback ===
                    'function'
                ) {
                    callback();
                }
            }
        );

        /* Cerrar haciendo click fuera */

        overlay.addEventListener(
            'click',
            (event) => {
                if (
                    event.target !== overlay
                ) {
                    return;
                }

                closeHierarchyConfirmModal();
            }
        );

        /* ESC */

        document.addEventListener(
            'keydown',
            (event) => {
                if (
                    event.key !==
                    'Escape'
                ) {
                    return;
                }

                if (
                    !overlay.classList.contains(
                        'show'
                    )
                ) {
                    return;
                }

                closeHierarchyConfirmModal();
            }
        );
    }
);

/* ============================================================
   EXPANDIR TODA LA JERARQUÍA
============================================================ */

export function expandHierarchyTree() {
    const container =
        $('hierarchy-tree');

    if (!container) {
        return;
    }

    container
        .querySelectorAll(
            '.hierarchy-children'
        )
        .forEach((element) => {
            element.style.display = '';
        });

    container
        .querySelectorAll(
            '.hierarchy-toggle:not(.leaf)'
        )
        .forEach((button) => {
            button.textContent = '▼';
            button.title = 'Contraer';
        });
}

/* ============================================================
   CONTRAER TODA LA JERARQUÍA
============================================================ */

export function collapseHierarchyTree() {
    const container =
        $('hierarchy-tree');

    if (!container) {
        return;
    }

    container
        .querySelectorAll(
            '.hierarchy-children'
        )
        .forEach((element) => {
            element.style.display =
                'none';
        });

    container
        .querySelectorAll(
            '.hierarchy-toggle:not(.leaf)'
        )
        .forEach((button) => {
            button.textContent = '▶';
            button.title = 'Expandir';
        });
}

/* ============================================================
   FIN VISTA PREVIA DE JERARQUÍA
============================================================ */