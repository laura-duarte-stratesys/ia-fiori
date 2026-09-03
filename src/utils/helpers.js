/* ============================================================
   UTILIDADES GENERALES
============================================================ */

export const $ = (id) => document.getElementById(id);


/* ============================================================
   NORMALIZACIÓN
============================================================ */

export function normalize(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/\s+/g, ' ');
}


export function normalizeKey(value) {
  return normalize(value).toUpperCase();
}


export function isEmpty(value) {
  return normalize(value) === '';
}


/* ============================================================
   HTML
============================================================ */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* ============================================================
   ESTADO VISUAL
============================================================ */

export function setStatus(element, message, type = '') {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `status ${type}`;
}


export function show(element) {
  if (element) {
    element.style.display = '';
  }
}


export function hide(element) {
  if (element) {
    element.style.display = 'none';
  }
}


/* ============================================================
   SCROLL
============================================================ */

export function scrollToElement(element) {
  if (!element) {
    return;
  }

  setTimeout(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, 100);
}
export function normalizeAIValue(value) {
  return normalize(value).toUpperCase().replace(/\s+/g, ' ').trim();
}