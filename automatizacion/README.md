# Automatización con Google Apps Script

Envía correos automáticos y publica la API segura del portal de aliados, reutilizando el mismo
motor de cálculo del tablero (las cifras de los correos y del tablero siempre coinciden).

## Instalación (una sola vez)

1. Abre la hoja de cálculo (ver `docs/GUIA_DESPLIEGUE.md`, paso 3.1) → **Extensiones → Apps Script**.
2. Crea estos archivos en el editor (botón **+ → Script**) y pega el contenido correspondiente:
   | Archivo en Apps Script | Contenido a pegar |
   |---|---|
   | `Codigo.gs` | `automatizacion/Codigo.gs` |
   | `Motor.gs` | `js/motor.js` |
   | `Reportes.gs` | `js/reportes.js` |
   | `Agente.gs` | `js/agente.js` |
3. **Configuración del proyecto (⚙️) → Propiedades del script → Agregar**:
   | Propiedad | Valor |
   |---|---|
   | `HOJA_ID` | ID de la hoja (está en la URL: `/d/<ID>/edit`) |
   | `CORREOS_EQUIPO` | `lider1@empresa.com,supervisor1@empresa.com` |
   | `MODO_PRUEBA` | `true` (todos los correos te llegan solo a ti). Cámbialo a `false` al validar. |
   | `GEMINI_API_KEY` | (opcional) tu API key para la "lectura del agente" en los correos |
   | `GEMINI_MODELO` | (opcional) `gemini-2.5-flash` |
   | `URL_SITIO` | (opcional) URL de GitHub Pages, para leer `contexto/` |
4. Selecciona la función `enviarReporteSemanal` → **Ejecutar** → acepta los permisos.
   Revisa el correo de prueba.
5. Ejecuta `configurarActivadores` una vez: crea la tarea diaria de las 7:00 a. m.

## Qué envía `tareaDiaria`
| Cuándo | Qué | A quién |
|---|---|---|
| Todos los días | Alertas críticas (novedades críticas de ayer + rachas en rojo) | Equipo |
| Lunes | Reporte semanal de la última semana cargada | Equipo |
| Primer día hábil del mes | Informe mensual de cada aliado activo (copia a su líder regional) | Cada aliado |

> Festivos de Colombia: la función `esPrimerDiaHabil_` solo excluye fines de semana. Si el
> primer día hábil cae después de un festivo, ejecuta `enviarInformesMensuales` manualmente
> o agrega los festivos al código.

## API segura del portal
1. **Implementar → Nueva implementación → Tipo: Aplicación web**.
2. Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier usuario**.
3. Copia la URL que termina en `/exec` y pégala en `urlApiPortal` de `js/config.js`.

La API valida NIT + código en el servidor y devuelve solo las filas del aliado y un agregado
anónimo de la red. Nunca expone códigos ni datos de otros aliados.

## Límites a tener en cuenta
- Gmail en cuentas de Workspace: hasta ~1.500 destinatarios/día; cuentas personales ~100/día.
- Gemini capa gratuita: límites por minuto y por día. El script espera 4,5 s entre aliados.
- Antes de pasar `MODO_PRUEBA` a `false`, valida el contenido de los informes con tu equipo y,
  si aplica, con Jurídico.
