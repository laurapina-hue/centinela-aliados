# Centinela de Aliados

**Agente de IA y tablero de indicadores para la red de aliados de asistencia Autos.**
Relacionamiento de Proveedores · Servicios Bolívar S.A.

Centinela elimina la revisión manual de indicadores en bases distintas: consolida en un solo
tablero los indicadores de cada aliado y los incumplimientos tipificados en la matriz de calidad,
los compara contra la meta (semáforo), detecta novedades y comportamientos atípicos, propone
accionables y genera los entregables del área. Un agente con Gemini (capa gratuita) interpreta
los datos con el criterio de la líder.

> ⚠️ Los datos de `data/` son **ficticios** (aliados "Demo S.A.S."). Reemplázalos por la base real
> antes de usarlo y revisa la sección de seguridad.

---

## Qué resuelve

| Dolor | Solución |
|---|---|
| Indicadores en bases distintas, sin resultado final por aliado | Motor que calcula 9 indicadores, semáforo e **Índice de Desempeño del Aliado (IDA)** |
| Matriz de calidad desconectada de los indicadores | Los incumplimientos alimentan el indicador "matriz x 100 servicios" y la **medida sugerida** por escalamiento de 90 días |
| Novedades detectadas tarde | **Alertas** por meta, rachas, deterioro, atípicos (2σ vs. histórico propio), novedades críticas y variación de volumen |
| Envío manual de reportes | Reporte **semanal** al equipo y **mensual** a cada aliado (manual desde el tablero o automático con Apps Script) |
| Aliados sin visibilidad de su desempeño | **Portal de aliados** con NIT + código |
| Informes para gerencia | **Presentación de comité** de 7 diapositivas, expediente y propuesta de medida |

## Arquitectura

```
          ┌───────────── data/ (CSV/JSON) o Google Sheets ─────────────┐
          │                                                            │
          ▼                                                            ▼
   js/motor.js  ── cálculo determinístico ──►  index.html (tablero interno)
   (indicadores, semáforo, IDA,                  ├─ Resumen · Evolución · Aliados · Matriz
    alertas, atípicos, escalamiento)             ├─ Reportes (HTML para correo / PDF)
          │                                      └─ Agente IA ──► js/agente.js ──► Gemini API
          │                                                        ▲
          │                                       contexto/*.md (master prompt + conocimiento)
          ├──► portal.html (cada aliado ve solo lo suyo)
          └──► automatizacion/Codigo.gs (Apps Script: correos automáticos + API segura del portal)
```

**Principio de diseño:** el motor calcula todas las cifras; la IA **solo interpreta, prioriza y
redacta** a partir de un bloque de datos ya calculado. Así se cumple la regla "cero invención".

## Estructura del repositorio

```
├── index.html                  Tablero interno + agente
├── portal.html                 Portal de consulta para aliados
├── css/styles.css
├── js/
│   ├── config.js               Configuración por defecto (modelo, fuentes, API del portal)
│   ├── datos.js                Carga de CSV/JSON/contexto (repositorio, archivo o URL)
│   ├── motor.js                Indicadores, semáforo, IDA, alertas, matriz
│   ├── gemini.js               Cliente de la API de Gemini
│   ├── agente.js               Contexto del agente, chat y atajos
│   ├── reportes.js             Entregables (semanal, mensual, expediente, presentación, CSV)
│   ├── app.js / portal.js      Interfaces
│   ├── embebido.js             Copia generada de data/ y contexto/ (abrir sin servidor)
│   └── vendor/                 Chart.js, marked, DOMPurify (locales, sin CDN)
├── contexto/                   ← CONOCIMIENTO DEL AGENTE (edítalo aquí)
│   ├── 00_master_prompt.md     Instrucción de sistema refactorizada
│   ├── 01_negocio_ecosistema.md
│   ├── 02_indicadores_kpi.md
│   ├── 03_ans_contratos.md     ← completar con el ANS oficial
│   ├── 04_matriz_calidad.md    ← completar con la matriz oficial
│   ├── 05_entregables.md
│   └── 06_gemelo_digital.md
├── data/
│   ├── indicadores_semanales.csv
│   ├── incumplimientos.csv
│   ├── proveedores.json
│   └── metas.json              Metas, umbrales, pesos, categorías y escalamiento
├── automatizacion/             Apps Script: correos automáticos y API segura del portal
├── herramientas/generar-embebido.js
├── docs/                       Guía de despliegue y códigos de la demo
└── .github/workflows/          Regenera js/embebido.js al cambiar datos o contexto
```

## Inicio rápido

1. **Probar en tu computador:** descarga el repositorio y abre `index.html` con doble clic.
   Funciona sin instalar nada (usa la copia embebida).
2. **Conectar la IA:** crea una API key gratuita en [Google AI Studio](https://aistudio.google.com/apikey),
   pégala en **Configuración** y pulsa **Probar conexión**.
3. **Publicar en GitHub Pages:** sigue [`docs/GUIA_DESPLIEGUE.md`](docs/GUIA_DESPLIEGUE.md).
4. **Portal de aliados (demo):** abre `portal.html` con un NIT y código de
   [`docs/CODIGOS_DEMO.md`](docs/CODIGOS_DEMO.md).

## Ajustar a la operación real

| Qué | Dónde |
|---|---|
| Metas, umbrales, pesos del IDA, categorías ANS, reglas de escalamiento | `data/metas.json` |
| Conocimiento del agente (ANS, contratos, matriz, negocio) | `contexto/*.md` (busca `[COMPLETAR]`) |
| Aliados (NIT, servicio, ciudades, frecuencia, líder, correos) | `data/proveedores.json` o pestaña `proveedores` en Sheets |
| Datos semanales y matriz | `data/*.csv` o Google Sheets (columnas en `contexto/02` y `04`) |
| Modelo de Gemini | Configuración → Modelo (o `js/config.js`) |

## Seguridad y privacidad (leer antes de usar datos reales)

- **Repositorio privado:** con datos reales, el repositorio debe ser privado. Ten en cuenta que
  GitHub Pages desde repositorios privados requiere un plan de pago de GitHub; la alternativa es
  servir el tablero desde Google Apps Script o un sitio interno.
- **Portal:** en modo demo la validación NIT + código ocurre en el navegador y `data/` es público:
  **no es seguro para datos reales.** Para producción usa la API de Apps Script
  (`automatizacion/`), donde cada aliado recibe únicamente sus datos.
- **API key:** nunca la escribas en el código. Se guarda solo en el navegador de quien la usa.
- **Capa gratuita de Gemini:** Google puede usar el contenido enviado para mejorar sus productos.
  No envíes datos personales de asegurados; para información sensible usa la capa de pago
  o datos anonimizados, y valida el uso con Seguridad de la Información.
- Las medidas disciplinarias que propone el sistema son **propuestas** sujetas a debido proceso
  y revisión de Jurídico.
