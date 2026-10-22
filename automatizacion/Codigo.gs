/* =====================================================================
   Centinela de Aliados · Automatización en Google Apps Script
   ---------------------------------------------------------------------
   Qué hace:
     1. tareaDiaria()  (activador diario 7:00 a. m.)
        - Todos los días: correo de ALERTAS CRÍTICAS al equipo si existen.
        - Lunes: REPORTE SEMANAL de la semana cerrada al equipo.
        - Primer día hábil del mes: INFORME MENSUAL a cada aliado.
     2. doGet()  API segura para el portal de aliados: cada aliado,
        con su NIT y código, recibe SOLO sus datos (+ promedio de red).

   Requisitos (ver automatizacion/README.md):
     - Hoja de cálculo con pestañas: indicadores, incumplimientos,
       proveedores, metas (JSON en A1) y opcionalmente contexto.
     - Copiar a este proyecto los archivos del repositorio:
         js/motor.js    → Motor.gs
         js/reportes.js → Reportes.gs
         js/agente.js   → Agente.gs
     - Propiedades del script (Configuración del proyecto → Propiedades):
         HOJA_ID            ID de la hoja de cálculo
         CORREOS_EQUIPO     correos separados por coma
         GEMINI_API_KEY     (opcional) para la lectura del agente
         GEMINI_MODELO      (opcional) por defecto gemini-2.5-flash
         URL_SITIO          (opcional) URL de GitHub Pages para leer contexto/
         MODO_PRUEBA        "true" = todos los correos van solo a ti
   ===================================================================== */

// Stub para que Agente.gs funcione fuera del navegador
var Datos = {
  ARCHIVOS_CONTEXTO: ["00_master_prompt.md", "01_negocio_ecosistema.md", "02_indicadores_kpi.md",
    "03_ans_contratos.md", "04_matriz_calidad.md", "05_entregables.md", "06_gemelo_digital.md"],
};

function prop_(k, def) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return v === null || v === "" ? def : v;
}

/* ---------------- lectura de datos ---------------- */
function leerPestana_(ss, nombre) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) throw new Error("No existe la pestaña «" + nombre + "»");
  var v = sh.getDataRange().getDisplayValues();
  var cab = v.shift().map(function (h) { return String(h).trim().toLowerCase(); });
  return v.filter(function (f) { return f.some(function (x) { return x !== ""; }); })
    .map(function (f) { var o = {}; cab.forEach(function (h, i) { o[h] = String(f[i]).trim(); }); return o; });
}

function cargarDatos_() {
  var ss = SpreadsheetApp.openById(prop_("HOJA_ID"));
  var provs = leerPestana_(ss, "proveedores").map(function (p) {
    p.ciudades = String(p.ciudades || "").split(",").map(function (c) { return c.trim(); }).filter(String);
    return p;
  });
  var metas = JSON.parse(ss.getSheetByName("metas").getRange("A1").getValue());
  var datos = {
    filas: leerPestana_(ss, "indicadores").map(normalizarSemana_),
    incs: leerPestana_(ss, "incumplimientos").map(normalizarSemana_),
    provs: provs,
    metas: metas,
  };
  Motor.cargar(datos);
  return datos;
}

// Acepta semanas escritas como "2026-S42" o fechas; deja el formato del motor
function normalizarSemana_(o) {
  if (!o.semana && o.fecha) o.semana = semanaISO_(new Date(o.fecha + "T12:00:00Z"));
  return o;
}

// Semana ISO 8601 (lunes a domingo) → "2026-S42"
function semanaISO_(d) {
  var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  var dia = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dia + 3);
  var anio = t.getUTCFullYear();
  var primerJueves = new Date(Date.UTC(anio, 0, 4));
  var sem = 1 + Math.round(((t - primerJueves) / 864e5 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7);
  return anio + "-S" + sem;
}

function cargarContexto_() {
  var ctx = {};
  var url = prop_("URL_SITIO", "");
  var ss = SpreadsheetApp.openById(prop_("HOJA_ID"));
  var hoja = ss.getSheetByName("contexto");
  Datos.ARCHIVOS_CONTEXTO.forEach(function (f) {
    if (hoja) {
      var fila = hoja.getDataRange().getValues().filter(function (r) { return r[0] === f; })[0];
      if (fila) { ctx[f] = String(fila[1]); return; }
    }
    if (url) {
      try { ctx[f] = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/contexto/" + f, { muteHttpExceptions: true }).getContentText(); }
      catch (e) { ctx[f] = ""; }
    }
  });
  Agente.setContexto(ctx);
}

/* ---------------- Gemini (opcional) ---------------- */
function gemini_(instruccion, semana, filtro) {
  var key = prop_("GEMINI_API_KEY", "");
  if (!key) return "";
  cargarContexto_();
  var modelo = prop_("GEMINI_MODELO", "gemini-2.5-flash");
  var cuerpo = {
    systemInstruction: { parts: [{ text: Agente.instruccionSistema() }] },
    contents: [{ role: "user", parts: [{ text: Agente.bloqueDatos(semana, filtro || {}) + "\n\nTAREA:\n" + instruccion }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  };
  var r = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent", {
    method: "post", contentType: "application/json", headers: { "x-goog-api-key": key },
    payload: JSON.stringify(cuerpo), muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) { console.warn("Gemini: " + r.getContentText()); return ""; }
  var j = JSON.parse(r.getContentText());
  try { return j.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join(""); } catch (e) { return ""; }
}

// Markdown muy simple → HTML para correo (negritas, viñetas, párrafos)
function mdHtml_(t) {
  if (!t) return "";
  var html = t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .split(/\n{2,}/).map(function (b) {
      if (/^\s*[-*] /m.test(b)) return "<ul>" + b.split("\n").filter(String).map(function (l) { return "<li>" + l.replace(/^\s*[-*] /, "") + "</li>"; }).join("") + "</ul>";
      return "<p>" + b.replace(/\n/g, "<br>") + "</p>";
    }).join("");
  return '<div style="border:1px solid #e1e6e2;border-left:5px solid #0b5a3c;border-radius:8px;padding:12px 16px;margin:16px 0;background:#f7faf8;font-size:14px"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7771">Lectura del agente</div>' + html + "</div>";
}

/* ---------------- envíos ---------------- */
function destinatarios_(lista) {
  if (prop_("MODO_PRUEBA", "true") === "true") return Session.getActiveUser().getEmail();
  return lista;
}

function enviarReporteSemanal() {
  cargarDatos_();
  var sems = Motor.semanas();
  var semana = sems[sems.length - 1];
  var rep = Reportes.semanal(semana, {});
  var lectura = gemini_("Redacta la LECTURA DEL AGENTE para el reporte semanal del equipo: 1 párrafo de conclusión y 3 a 5 viñetas con hallazgos y accionables (responsable y plazo). Máximo 180 palabras.", semana, {});
  var html = rep.html.replace('<div id="bloque-ia"></div>', mdHtml_(lectura));
  GmailApp.sendEmail(destinatarios_(prop_("CORREOS_EQUIPO")), rep.asunto, rep.texto, { htmlBody: html, name: "Centinela de Aliados" });
}

function enviarInformesMensuales() {
  cargarDatos_();
  var meses = Reportes.meses();
  var hoy = new Date();
  var anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15);
  var clave = Utilities.formatDate(anterior, "America/Bogota", "yyyy-MM");
  if (!meses[clave]) { console.warn("No hay semanas para " + clave); return; }
  Motor.proveedores().filter(function (p) { return (p.estado || "activo") === "activo" && p.correo_aliado; }).forEach(function (p) {
    var rep = Reportes.mensualAliado(p.nit, clave);
    var ultimaSem = meses[clave][meses[clave].length - 1];
    var lectura = gemini_("Redacta un párrafo cordial (máx. 120 palabras) para el aliado " + p.razon_social + " sobre su desempeño del mes, reconociendo fortalezas y señalando con respeto las brechas. No menciones otros aliados.", ultimaSem, { nit: p.nit });
    var html = rep.html.replace('<div id="bloque-ia"></div>', mdHtml_(lectura));
    GmailApp.sendEmail(destinatarios_(p.correo_aliado), rep.asunto, rep.texto, { htmlBody: html, cc: prop_("MODO_PRUEBA", "true") === "true" ? "" : (p.correo_lider || ""), name: "Relacionamiento de Aliados" });
    Utilities.sleep(4500); // respeta el límite por minuto de la capa gratuita de Gemini
  });
}

function enviarAlertasCriticas() {
  cargarDatos_();
  var sems = Motor.semanas();
  var semana = sems[sems.length - 1];
  var ayer = Utilities.formatDate(new Date(Date.now() - 864e5), "America/Bogota", "yyyy-MM-dd");
  var nuevas = Motor.incumplimientos().filter(function (i) { return i.gravedad === "critica" && i.fecha === ayer; });
  var criticas = Motor.alertas(semana, {}).filter(function (a) { return a.severidad === "Crítica"; });
  if (!nuevas.length && !criticas.length) return;
  var filas = nuevas.map(function (i) { var p = Motor.proveedor(i.nit) || {}; return "<li><b>" + (p.razon_social || i.nit) + "</b> · " + i.tipo + " · " + i.servicio_id + " (" + i.ciudad + ")</li>"; }).join("");
  var filas2 = criticas.map(function (a) { return "<li><b>" + a.aliado + "</b> · " + a.tipo + ": " + a.detalle + "</li>"; }).join("");
  var html = '<div style="font-family:Arial,sans-serif;max-width:700px"><h2 style="color:#c63d3d">Alertas críticas · ' + ayer + "</h2>" +
    (filas ? "<h3>Novedades críticas registradas ayer</h3><ul>" + filas + "</ul>" : "") +
    (filas2 ? "<h3>Alertas críticas vigentes (" + semana + ")</h3><ul>" + filas2 + "</ul>" : "") +
    '<p style="font-size:12px;color:#6b7771">Centinela de Aliados · Las medidas son propuestas sujetas a debido proceso.</p></div>';
  GmailApp.sendEmail(destinatarios_(prop_("CORREOS_EQUIPO")), "🔴 Alertas críticas red de aliados · " + ayer, "Ver versión HTML", { htmlBody: html, name: "Centinela de Aliados" });
}

function esPrimerDiaHabil_(d) {
  for (var i = 1; i <= d.getDate(); i++) {
    var x = new Date(d.getFullYear(), d.getMonth(), i);
    var dia = x.getDay();
    if (dia !== 0 && dia !== 6) return i === d.getDate(); // TODO: agregar festivos de Colombia si se requiere
  }
  return false;
}

/** Activador diario: decide qué enviar */
function tareaDiaria() {
  var hoy = new Date();
  enviarAlertasCriticas();
  if (hoy.getDay() === 1) enviarReporteSemanal();
  if (esPrimerDiaHabil_(hoy)) enviarInformesMensuales();
}

/** Ejecuta UNA vez para crear el activador diario (7:00 a. m.) */
function configurarActivadores() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "tareaDiaria") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("tareaDiaria").timeBased().everyDays(1).atHour(7).inTimezone("America/Bogota").create();
}

/* ---------------- API del portal de aliados ---------------- */
function doGet(e) {
  var p = e.parameter || {};
  var salida = function (obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); };
  try {
    if (p.accion !== "portal") return salida({ ok: false, error: "Acción no válida" });
    var datos = cargarDatos_();
    var nit = String(p.nit || "").trim();
    var cod = String(p.codigo || "").trim().toUpperCase();
    var prov = Motor.proveedor(nit);
    var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, nit + ":" + cod, Utilities.Charset.UTF_8)
      .map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
    if (!prov || hash !== prov.codigo_acceso_sha256) { Utilities.sleep(1500); return salida({ ok: false, error: "NIT o código incorrectos." }); }

    // Solo filas del aliado + una fila agregada de la red por semana (anónima)
    var campos = ["servicios", "llegadas_a_tiempo", "minutos_llegada_total", "encuestas", "insatisfechos", "reclamaciones",
      "casos_responsabilidad", "cancelaciones_aliado", "asignaciones_ofrecidas", "asignaciones_rechazadas"];
    var red = {};
    datos.filas.forEach(function (f) {
      var r = red[f.semana] || (red[f.semana] = { semana: f.semana, nit: "__RED__" });
      campos.forEach(function (c) { r[c] = (Number(r[c]) || 0) + (Number(f[c]) || 0); });
    });
    var provSeguro = JSON.parse(JSON.stringify(prov)); delete provSeguro.codigo_acceso_sha256;
    return salida({ ok: true, datos: {
      filas: datos.filas.filter(function (f) { return f.nit === nit; }).concat(Object.keys(red).map(function (k) { return red[k]; })),
      incs: datos.incs.filter(function (i) { return i.nit === nit; }),
      provs: [provSeguro, { nit: "__RED__", razon_social: "Red", ciudades: [], region: "", servicio: "", frecuencia: "" }],
      metas: datos.metas,
    } });
  } catch (err) {
    return salida({ ok: false, error: "Servicio no disponible" });
  }
}

/** Utilidad: genera el hash para un nuevo código de aliado (ver registros) */
function generarHashCodigo() {
  var nit = "900111001-1", codigo = "ABC123"; // ← cambia y ejecuta
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, nit + ":" + codigo, Utilities.Charset.UTF_8)
    .map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
  console.log(nit + " → " + h);
}
