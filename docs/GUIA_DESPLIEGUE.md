# Guía de despliegue paso a paso

Tres niveles. Puedes quedarte en el que necesites.

| Nivel | Qué obtienes | Tiempo |
|---|---|---|
| 1. Local | Tablero y agente en tu computador | 5 min |
| 2. GitHub Pages | Tablero publicado con URL, datos desde `data/` | 15 min |
| 3. Google Workspace | Datos en tiempo real desde Sheets, correos automáticos y portal seguro | 45 min |

---

## Nivel 1 · Local

1. Descarga y descomprime el repositorio.
2. Abre `index.html` con doble clic (Chrome o Edge).
3. Ve a **Configuración**, pega tu API key de Gemini y pulsa **Probar conexión**.

Para usar tus propios datos sin publicarlos: **Configuración → Fuentes de datos → cargar archivos**
(se usan solo durante la sesión).

## Nivel 2 · GitHub Pages

1. Crea una cuenta en [github.com](https://github.com) y un repositorio nuevo, por ejemplo
   `centinela-aliados` (privado si vas a subir datos reales; ver README).
2. Pulsa **Add file → Upload files** y arrastra **todo el contenido** de la carpeta
   (incluida la carpeta oculta `.github`). Pulsa **Commit changes**.
   - Alternativa con Git:
     ```bash
     git init && git add . && git commit -m "Centinela de Aliados v1"
     git branch -M main
     git remote add origin https://github.com/<tu-usuario>/centinela-aliados.git
     git push -u origin main
     ```
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   rama `main`, carpeta `/ (root)` → **Save**.
4. En 1–2 minutos tendrás la URL `https://<tu-usuario>.github.io/centinela-aliados/`.
5. En **Settings → Actions → General → Workflow permissions** marca **Read and write permissions**
   para que la acción regenere `js/embebido.js` cuando cambies datos o contexto.

**Actualizar datos o conocimiento:** edita los archivos de `data/` o `contexto/` directamente en
GitHub (ícono del lápiz) y guarda. El sitio se actualiza en minutos.

## Nivel 3 · Google Workspace (tiempo real + correos automáticos + portal seguro)

### 3.1 Hoja de cálculo
Crea una hoja de Google con estas pestañas (la primera fila son los encabezados, en minúscula):

| Pestaña | Columnas |
|---|---|
| `indicadores` | semana, fecha_inicio, nit, servicios, llegadas_a_tiempo, minutos_llegada_total, encuestas, insatisfechos, reclamaciones, casos_responsabilidad, cancelaciones_aliado, asignaciones_ofrecidas, asignaciones_rechazadas |
| `incumplimientos` | fecha, semana, nit, servicio_id, ciudad, tipo, gravedad, descripcion, estado, medida |
| `proveedores` | nit, razon_social, servicio, ciudades, frecuencia, region, lider_regional, correo_aliado, correo_lider, estado, codigo_acceso_sha256 |
| `metas` | Celda **A1**: el contenido completo de `data/metas.json` |
| `contexto` (opcional) | A: nombre del archivo (ej. `03_ans_contratos.md`) · B: contenido |

> La matriz de calidad que diligencian los supervisores a diario puede ser esta misma pestaña
> `incumplimientos` (o alimentarla con un formulario de Google). Si no escriben la semana,
> el script la calcula a partir de la fecha.

### 3.2 Apps Script
Sigue [`automatizacion/README.md`](../automatizacion/README.md). Obtendrás:
- Correo diario de **alertas críticas**, **reporte semanal** los lunes y **informe mensual** a cada
  aliado el primer día hábil del mes.
- La URL de la **API segura del portal**.

### 3.3 Conectar el tablero y el portal
- **Tablero en tiempo real:** en **Configuración → Fuentes de datos** pega una URL CSV de cada
  pestaña (Archivo → Compartir → Publicar en la web → CSV) y elige la actualización automática.
  ⚠️ Una hoja publicada en la web es accesible para quien tenga el enlace; úsalo solo si la
  política de la compañía lo permite.
- **Portal seguro:** en `js/config.js` pega en `urlApiPortal` la URL de la aplicación web de
  Apps Script y sube el cambio. Desde ese momento el portal ya no lee `data/`: cada aliado
  recibe solo sus datos después de validar NIT + código en el servidor. Retira entonces los datos
  reales de `data/` en el repositorio.

## Crear o cambiar el código de un aliado
1. Define un código (ej. 6 caracteres alfanuméricos en mayúscula).
2. En Apps Script, abre `generarHashCodigo`, cambia NIT y código, ejecuta y copia el hash del registro.
3. Pégalo en la columna `codigo_acceso_sha256` del aliado. Entrega el código al aliado por un canal seguro.

## Solución de problemas
| Síntoma | Causa probable |
|---|---|
| "El modelo configurado no existe" | Google renombró modelos: usa **Detectar modelos** en Configuración |
| "Se alcanzó el límite de la capa gratuita" | Demasiadas consultas por minuto/día; espera o reduce consultas |
| El tablero abre pero sin estilos de letra | Sin internet para Google Fonts; usa la fuente del sistema, no afecta datos |
| No conecta con Gemini desde la red corporativa | El firewall bloquea `generativelanguage.googleapis.com`; solicita la excepción a TI |
