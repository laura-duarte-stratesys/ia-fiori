# IA Fiori

Aplicación web para la preparación, validación y generación de estructuras utilizadas en **SAP Group Reporting**, con apoyo de inteligencia artificial para el análisis de jerarquías y planes de cuentas.

## 🚀 Proyecto

**IA Fiori** permite trabajar con dos procesos principales:

* **Jerarquías Fiori**
* **Plan de cuentas**

La aplicación permite cargar archivos Excel, validar su estructura, detectar incidencias y generar archivos preparados para su utilización en SAP Fiori.

Además, incorpora funcionalidades de IA para proponer cambios sobre las estructuras analizadas.

## ✨ Funcionalidades

### Jerarquía Fiori

* Carga de archivos Excel.
* Lectura y procesamiento de estructuras jerárquicas.
* Identificación de raíces, nodos y cuentas.
* Determinación de relaciones padre-hijo.
* Cálculo de niveles jerárquicos.
* Validación de la estructura.
* Visualización de la jerarquía en forma de árbol.
* Expansión y contracción del árbol.
* Detección y visualización de incidencias.
* Análisis mediante IA.
* Aplicación de sugerencias propuestas por la IA.
* Generación del archivo Excel para Fiori.

### Plan de cuentas

* Carga de archivos Excel.
* Validación de cuentas.
* Validación de tipos de cuenta.
* Detección de duplicados.
* Eliminación automática de duplicados exactos.
* Resumen de resultados.
* Visualización de incidencias.
* Análisis mediante IA.
* Generación del archivo Excel para Fiori.

## 🧠 Inteligencia artificial

La aplicación incorpora funcionalidades de IA orientadas al análisis de estructuras contables.

En el caso de las jerarquías, la IA puede analizar la estructura y proponer cambios relacionados con:

* Padre sugerido.
* Nivel sugerido.
* Tipo de elemento.
* Cambio propuesto.
* Confianza.
* Explicación.

Las sugerencias pueden ser revisadas y aplicadas desde la propia aplicación.

## 🏗️ Arquitectura

El proyecto está organizado por responsabilidades para facilitar el mantenimiento y evitar concentrar toda la lógica en un único archivo.

```text
src/
├── app/
│   ├── aiActions.js
│   ├── configure.js
│   └── init.js
│
├── config/
│   └── constants.js
│
├── hierarchy/
│   ├── hierarchyAI.js
│   ├── hierarchyExport.js
│   ├── hierarchyFileInput.js
│   ├── hierarchyParser.js
│   ├── hierarchyProcessor.js
│   ├── hierarchyState.js
│   ├── hierarchyTree.js
│   ├── hierarchyValidation.js
│   └── hierarchyWorkflow.js
│
├── plan/
│   ├── planAI.js
│   ├── planExport.js
│   ├── planFileInput.js
│   ├── planParser.js
│   ├── planState.js
│   ├── planValidation.js
│   └── planWorkflow.js
│
├── ui/
│   ├── modeSwitcher.js
│   ├── parameterValidation.js
│   └── reset.js
│
├── utils/
│   ├── excel.js
│   └── helpers.js
│
├── main.js
└── style.css
```

### `main.js`

`main.js` funciona como punto de entrada de la aplicación.

Su responsabilidad principal es:

1. Cargar los estilos.
2. Configurar los módulos.
3. Inicializar la aplicación.
4. Inicializar las acciones de IA.

La lógica de negocio se encuentra distribuida en módulos especializados.

### `app/`

Contiene la configuración y el arranque general de la aplicación.

* `configure.js` — configura las dependencias entre módulos.
* `init.js` — inicializa la interfaz, eventos y botones.
* `aiActions.js` — gestiona las acciones relacionadas con las sugerencias de IA.

### `hierarchy/`

Contiene toda la lógica relacionada con las jerarquías Fiori.

* `hierarchyParser.js` — lectura y transformación del Excel.
* `hierarchyProcessor.js` — procesamiento de la estructura.
* `hierarchyTree.js` — construcción y visualización del árbol.
* `hierarchyValidation.js` — validaciones, incidencias y resumen.
* `hierarchyAI.js` — integración y aplicación de sugerencias de IA.
* `hierarchyExport.js` — generación del archivo de salida.
* `hierarchyWorkflow.js` — flujo principal de procesamiento.
* `hierarchyFileInput.js` — gestión de carga de archivos.
* `hierarchyState.js` — estado de la jerarquía.

### `plan/`

Contiene la lógica relacionada con el plan de cuentas.

* `planParser.js` — lectura y transformación del Excel.
* `planValidation.js` — validaciones y detección de incidencias.
* `planAI.js` — funcionalidades de IA.
* `planExport.js` — generación del archivo de salida.
* `planWorkflow.js` — flujo principal de procesamiento.
* `planFileInput.js` — gestión de archivos.
* `planState.js` — estado del plan de cuentas.

### `ui/`

Contiene funcionalidades generales de interfaz.

* `modeSwitcher.js` — cambio entre los modos de trabajo.
* `parameterValidation.js` — validación de parámetros.
* `reset.js` — reinicio de los procesos.

### `utils/`

Contiene funciones reutilizables.

* `helpers.js` — utilidades generales, normalización, HTML y estado visual.
* `excel.js` — funcionalidades relacionadas con archivos Excel.

## 📊 Flujo general

```text
                    ┌─────────────────┐
                    │   IA Fiori      │
                    └────────┬────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
        ┌─────────────────┐     ┌─────────────────┐
        │ Jerarquía Fiori │     │ Plan de cuentas │
        └────────┬────────┘     └────────┬────────┘
                 │                       │
                 ▼                       ▼
           Cargar Excel             Cargar Excel
                 │                       │
                 ▼                       ▼
             Procesar                 Procesar
                 │                       │
                 ▼                       ▼
             Validar                  Validar
                 │                       │
                 ▼                       ▼
           Analizar IA               Analizar IA
                 │                       │
                 ▼                       ▼
        Aplicar sugerencias          Resultado
                 │                       │
                 ▼                       ▼
          Generar archivo          Generar archivo
```

## 🛠️ Tecnologías

El proyecto utiliza principalmente:

* JavaScript
* HTML
* CSS
* SheetJS para el procesamiento de archivos Excel
* Módulos JavaScript ES Modules
* Integración con servicios de IA y automatización

## ▶️ Ejecutar el proyecto

El proyecto puede ejecutarse directamente desde StackBlitz.

[Abrir IA Fiori en StackBlitz](https://stackblitz.com/~/github.com/laura-duarte-stratesys/ia-fiori?utm_source=chatgpt.com)

También puede ejecutarse desde un entorno local utilizando el sistema de desarrollo configurado en el proyecto.

## 📁 Entrada de datos

Los archivos Excel utilizados por la aplicación deben respetar la estructura esperada por cada proceso.

### Jerarquía

La aplicación procesa la hoja de entrada correspondiente y utiliza los identificadores y descripciones para reconstruir la estructura jerárquica.

### Plan de cuentas

El proceso espera los campos necesarios para identificar y validar las cuentas y sus características contables.

## 🔄 Mantenimiento

La aplicación está organizada para que los cambios puedan realizarse de forma localizada.

Por ejemplo:

* Cambios en la lógica de jerarquías → `hierarchy/`
* Cambios en plan de cuentas → `plan/`
* Cambios de interfaz → `ui/`
* Funciones reutilizables → `utils/`
* Arranque y configuración → `app/`

Esto permite evolucionar cada parte del proyecto sin volver a concentrar toda la lógica en `main.js`.

## 🔗 Repositorio

El proyecto está disponible en GitHub:

`laura-duarte-stratesys/ia-fiori`

También puede abrirse directamente desde StackBlitz:

[IA Fiori — StackBlitz](https://stackblitz.com/~/github.com/laura-duarte-stratesys/ia-fiori?utm_source=chatgpt.com)

---

**IA Fiori**
Herramienta para facilitar la preparación y validación de estructuras para SAP Group Reporting.
