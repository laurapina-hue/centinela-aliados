/* =====================================================================
   agente.js · Construye el contexto del agente y gestiona el chat
   Principio clave: el MOTOR calcula todas las cifras; la IA solo
   interpreta, prioriza y redacta. Así se evita que el modelo invente
   o calcule mal los datos.
   ===================================================================== */
const Agente = (() => {
  let contexto = {};
  let historial = [];

  function setContexto(c) { contexto = c; }
  function limpiar() { historial = []; }

  /** Instrucción de sistema = master prompt + archivos de contexto */
  function instruccionSistema() {
    const partes = [contexto["00_master_prompt.md"] || ""];
    Datos.ARCHIVOS_CONTEXTO.slice(1).forEach(f => {
      if (contexto[f]) partes.push(`\n\n=====  ARCHIVO DE CONTEXTO: ${f}  =====\n${contexto[f]}`);
    });
    partes.push(`\n\n=====  INSTRUCCIÓN OPERATIVA  =====
- En cada mensaje recibirás un bloque <DATOS_CALCULADOS> generado por el motor del tablero.
- Esas cifras son la ÚNICA fuente válida. No recalcules con otros supuestos ni agregues datos.
- Si te piden algo que no está en el bloque, responde que no está en la base y sugiere qué dato cargar.
- Responde en español de Colombia, con formato Markdown (tablas cuando ayuden).`);
    return partes.join("");
  }

  /** Bloque de datos calculados para la semana seleccionada */
  function bloqueDatos(semana, filtro = {}, opciones = {}) {
    const M = Motor;
    const sems = M.semanasHasta(semana, opciones.semanasHist || 8);
    const claves = M.claves();
    const met = M.metas().indicadores;
    const L = [];
    L.push(`<DATOS_CALCULADOS semana_actual="${semana}" generado="${new Date().toISOString().slice(0, 16)}">`);
    L.push(`Filtro aplicado: ${JSON.stringify(filtro)}`);
    L.push(`Semanas disponibles en la base: ${M.semanas()[0]} a ${M.semanas().slice(-1)[0]}`);

    L.push(`\n## METAS (verde = cumple meta; amarillo = entre meta y umbral; rojo = peor que umbral)`);
    L.push(`indicador|nombre|sentido|meta|umbral|peso_IDA`);
    claves.forEach(k => L.push(`${k}|${met[k].nombre}|${met[k].sentido} es mejor|${met[k].meta}|${met[k].umbral}|${met[k].peso}`));

    L.push(`\n## RED (agregado de aliados filtrados) por semana`);
    L.push(`semana|servicios|${claves.join("|")}|IDA`);
    sems.forEach(s => {
      const r = M.resultado([s], filtro);
      L.push(`${s}|${r.servicios}|${claves.map(k => num(r.ind[k], k) + "(" + (r.est[k] || "-")[0] + ")").join("|")}|${r.ida ?? "-"}`);
    });

    L.push(`\n## ALIADOS (maestro)`);
    L.push(`nit|razon_social|servicio|ciudades|frecuencia|region|lider_regional`);
    M.filtrarProvs(filtro).forEach(p => L.push(`${p.nit}|${p.razon_social}|${p.servicio}|${p.ciudades.join(", ")}|${p.frecuencia}|${p.region}|${p.lider_regional}`));

    L.push(`\n## INDICADORES POR ALIADO Y SEMANA (v = verde, a = amarillo, r = rojo)`);
    L.push(`nit|semana|servicios|${claves.join("|")}|IDA|categoria`);
    M.filtrarProvs(filtro).forEach(p => {
      sems.forEach(s => {
        const r = M.resultado([s], { nit: p.nit });
        if (!r.servicios) return;
        L.push(`${p.nit}|${s}|${r.servicios}|${claves.map(k => num(r.ind[k], k) + "(" + (r.est[k] || "-")[0] + ")").join("|")}|${r.ida ?? "-"}|${M.categoria(r.ida).nombre}`);
      });
    });

    L.push(`\n## ALERTAS DE LA SEMANA ${semana} (ordenadas por prioridad)`);
    const al = M.alertas(semana, filtro);
    if (!al.length) L.push("Sin alertas.");
    al.forEach((a, i) => L.push(`${i + 1}. [${a.severidad}] ${a.tipo} · ${a.aliado} (NIT ${a.nit}, frecuencia ${a.frecuencia}, ${a.lider}) · ${a.detalle}`));

    L.push(`\n## MATRIZ DE CALIDAD · ventana de ${M.metas().alertas.ventana_matriz_dias} días al cierre de ${semana}`);
    L.push(`nit|leves|graves|criticas|regla_aplicable|medida_sugerida_por_matriz`);
    M.filtrarProvs(filtro).forEach(p => {
      const m = M.medidaSugerida(p.nit, semana);
      L.push(`${p.nit}|${m.conteo.leve}|${m.conteo.grave}|${m.conteo.critica}|${m.regla ? m.regla.condicion : "ninguna"}|${m.regla ? m.regla.medida : "Sin medida"}`);
    });

    const ult4 = M.semanasHasta(semana, 4);
    const nits = new Set(M.filtrarProvs(filtro).map(p => p.nit));
    const incs = M.incumplimientos().filter(i => ult4.includes(i.semana) && nits.has(i.nit));
    L.push(`\n## DETALLE DE INCUMPLIMIENTOS (últimas 4 semanas: ${ult4.join(", ")})`);
    L.push(`fecha|semana|nit|servicio_id|ciudad|tipo|gravedad|estado|descripcion`);
    incs.forEach(i => L.push(`${i.fecha}|${i.semana}|${i.nit}|${i.servicio_id}|${i.ciudad}|${i.tipo}|${i.gravedad}|${i.estado}|${i.descripcion}`));
    L.push(`</DATOS_CALCULADOS>`);
    return L.join("\n");
  }

  function num(v, k) {
    if (v === null || v === undefined) return "-";
    const d = Motor.metas().indicadores[k]?.decimales ?? 1;
    return v.toFixed(d);
  }

  /** Envía una pregunta con el bloque de datos adjunto */
  async function preguntar(texto, { semana, filtro, cfg }) {
    const datos = bloqueDatos(semana, filtro);
    const msgUsuario = `${datos}\n\nCONSULTA DE LA LÍDER:\n${texto}`;
    // El historial guarda solo el texto de la consulta (sin datos) para no repetir el bloque
    const previos = historial.slice(-8);
    const mensajes = [...previos, { rol: "yo", texto: msgUsuario }];
    const r = await Gemini.generar({ apiKey: cfg.apiKey, modelo: cfg.modelo, sistema: instruccionSistema(), mensajes, temperatura: cfg.temperatura });
    historial.push({ rol: "yo", texto }, { rol: "ia", texto: r.texto });
    return r;
  }

  /** Pide un texto puntual (para enriquecer informes) sin afectar el historial del chat */
  async function redactar(instruccion, { semana, filtro, cfg }) {
    const mensajes = [{ rol: "yo", texto: `${bloqueDatos(semana, filtro)}\n\nTAREA:\n${instruccion}` }];
    const r = await Gemini.generar({ apiKey: cfg.apiKey, modelo: cfg.modelo, sistema: instruccionSistema(), mensajes, temperatura: cfg.temperatura });
    return r.texto;
  }

  const ATAJOS = [
    { t: "Resumen de la semana", p: "Dame el estatus de la semana: conclusión, semáforo de red, top 5 hallazgos priorizados y accionables con responsable y plazo." },
    { t: "Aliados críticos", p: "¿Qué aliados requieren intervención inmediata y por qué? Cruza indicadores con la matriz de calidad y propone la medida que corresponde según el escalamiento (como propuesta)." },
    { t: "Comportamientos atípicos", p: "Explica los comportamientos atípicos detectados, su posible causa operativa según los datos disponibles y qué validar con supervisión." },
    { t: "Tendencias 8 semanas", p: "Analiza la tendencia de la red en las últimas 8 semanas: qué mejora, qué empeora y qué riesgo anticipas para el ANS." },
    { t: "Propuesta de medida", p: "Redacta la propuesta de medida disciplinaria para el aliado más crítico usando la plantilla B3, como BORRADOR sujeto a debido proceso y revisión de Jurídico." },
    { t: "Mensaje para comité", p: "Prepara el mensaje clave y 5 puntos para el comité gerencial con resultados, riesgos y decisiones requeridas." },
    { t: "Iniciativas de innovación", p: "Con criterio de Gerencia Estratégica de la Innovación, ¿qué 3 iniciativas priorizarías a partir de los patrones de los datos? Indica valor esperado, esfuerzo y cómo medirlas." },
  ];

  return { setContexto, limpiar, instruccionSistema, bloqueDatos, preguntar, redactar, ATAJOS };
})();
