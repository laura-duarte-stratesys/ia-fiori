import {
    $,
    setStatus,
    hide,
  } from '../utils/helpers.js';
  
  let fileInputConfig = {
    setCurrentFile: null,
    setResult: null,
  };
  
  /* ============================================================
     CONFIGURACIÓN
  ============================================================ */
  
  export function configureHierarchyFileInput(config = {}) {
    fileInputConfig = {
      ...fileInputConfig,
      ...config,
    };
  }
  
  /* ============================================================
     INPUT ARCHIVO JERARQUÍA
  ============================================================ */
  
  export function initHierarchyFileInput() {
    const input = $('file-input');
  
    if (!input) return;
  
    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
  
      if (!file) return;
  
      fileInputConfig.setCurrentFile?.(file);
  
      fileInputConfig.setResult?.(null);
  
      hide($('step3'));
      hide($('step4'));
  
      $('btn-process').disabled = false;
  
      setStatus(
        $('file-status'),
        `Archivo seleccionado: ${file.name}`
      );
    });
  }
  
  /* ============================================================
     DRAG & DROP
  ============================================================ */
  
  export function initDropzone(inputId) {
    const input = $(inputId);
  
    if (!input) return;
  
    const label =
      document.querySelector(
        `label[for="${inputId}"]`
      );
  
    if (!label) return;
  
    ['dragenter', 'dragover'].forEach(
      (eventName) => {
        label.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();
  
            label.style.borderColor =
              'var(--blue)';
          }
        );
      }
    );
  
    ['dragleave', 'drop'].forEach(
      (eventName) => {
        label.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();
  
            label.style.borderColor = '';
          }
        );
      }
    );
  
    label.addEventListener(
      'drop',
      (event) => {
        const file =
          event.dataTransfer.files?.[0];
  
        if (!file) return;
  
        const dataTransfer =
          new DataTransfer();
  
        dataTransfer.items.add(file);
  
        input.files =
          dataTransfer.files;
  
        input.dispatchEvent(
          new Event('change')
        );
      }
    );
  }