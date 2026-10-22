/* =====================================================================
   portal.js · Portal de consulta para aliados (NIT + código)
   ⚠️ IMPORTANTE: en un sitio estático (GitHub Pages) esta validación es
   de conveniencia, no de seguridad: los archivos de data/ son públicos.
   Para datos reales usa el backend de Apps Script descrito en
   docs/GUIA_DESPLIEGUE.md (cada aliado recibe solo sus datos).
   ===================================================================== */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let nit = null, graf = {};
  const API = CONFIG_DEFECTO.urlApiPortal;          // modo seguro (Apps Script)
  const RED = () => (API ? { nit: "__RED__" } : {});  // promedio de red anónimo
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  async function sha256(t) {
    if (window.crypto?.subtle) {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
    }
    throw new Error("Este navegador no permite validar el acceso. Abre el portal desde https.");
  }

  function g(id, config) {
    if (graf[id]) graf[id].destroy();
    Chart.defaults.color = css("--ink-2"); Chart.defaults.borderColor = css("--chart-grid");
    graf[id] = new Chart(document.getElementById(id), config);
  }

  async function ingresar(e) {
    e.preventDefault();
    const n = $("#l-nit").value.trim().replace(/\s/g, "");
    const c = $("#l-cod").value.trim().toUpperCase();
    const err = $("#l-error");
    try {
      if (API) {
        const r = await fetch(`${API}?accion=portal&nit=${encodeURIComponent(n)}&codigo=${encodeURIComponent(c)}`).then(x => x.json());
        if (!r.ok) throw new Error(r.error || "NIT o código incorrectos.");
        Motor.cargar(r.datos);
      } else {
        const p = Motor.proveedor(n);
        if (!p || (await sha256(`${n}:${c}`)) !== p.codigo_acceso_sha256) throw new Error("NIT o código incorrectos.");
      }
      nit = n;
      try { sessionStorage.setItem("portal:nit", n); } catch {}
      err.classList.add("oculto");
      mostrar();
    } catch (x) { err.textContent = x.message; err.classList.remove("oculto"); }
  }

  function mostrar() {
    const p = Motor.proveedor(nit);
    $("#login").classList.add("oculto"); $("#tablero").classList.remove("oculto");
    $("#p-nombre").textContent = p.razon_social;
    $("#p-sub").textContent = `NIT ${p.nit} · ${p.servicio} · ${p.ciudades.join(", ")}`;
    const sems = [...Motor.semanas()].reverse();
    $("#p-semana").innerHTML = sems.map(s => `<option value="${s}">${s} · ${Reportes.rango(s)}</option>`).join("");
    $("#p-ind").innerHTML = Motor.claves().map(k => `<option value="${k}">${esc(Motor.metas().indicadores[k].nombre)}</option>`).join("");
    render();
  }

  function render() {
    const sem = $("#p-semana").value;
    const f = { nit };
    const r = Motor.resultado([sem], f);
    const cat = Motor.categoria(r.ida);
    $("#p-ida").textContent = r.ida ?? "—";
    $("#p-cat").innerHTML = `<span class="chip ${cat.color}">${esc(cat.nombre)}</span>`;
    $("#p-kpis").innerHTML = `<div class="kpi"><div class="kpi-nombre">Servicios prestados</div><div class="kpi-valor">${Motor.fmtNum(r.servicios)}</div><div class="kpi-meta"><span>${sem}</span></div></div>` +
      Motor.claves().map(k => { const m = Motor.metas().indicadores[k];
        return `<div class="kpi ${r.est[k] || ""}"><div class="kpi-nombre">${esc(m.nombre)}</div><div class="kpi-valor">${Motor.fmt(r.ind[k], k)}</div><div class="kpi-meta"><span>Meta ${Motor.fmt(m.meta, k)}</span></div></div>`; }).join("");
    const s12 = Motor.semanasHasta(sem, 12);
    g("pg-ida", { type: "line", data: { labels: s12.map(s => s.split("-")[1]), datasets: [{ data: s12.map(s => Motor.resultado([s], f).ida), borderColor: css("--chart-1"), backgroundColor: css("--chart-1") + "22", fill: true, tension: .3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } } });
    const k = $("#p-ind").value || "oportunidad";
    const m = Motor.metas().indicadores[k];
    g("pg-evol", { type: "line", data: { labels: s12, datasets: [
      { label: "Su resultado", data: Motor.serie(k, f, s12), borderColor: css("--chart-1"), backgroundColor: css("--chart-1"), tension: .25, borderWidth: 2.5 },
      { label: "Promedio red (anónimo)", data: Motor.serie(k, RED(), s12), borderColor: css("--ink-3"), borderDash: [5, 4], pointRadius: 0, tension: .25 },
      { label: "Meta", data: s12.map(() => m.meta), borderColor: css("--verde"), borderDash: [6, 4], pointRadius: 0 }] },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Motor.fmt(c.parsed.y, k)}` } } } } });
    const med = Motor.medidaSugerida(nit, sem);
    $("#p-mz-desc").textContent = `Últimos ${Motor.metas().alertas.ventana_matriz_dias} días al cierre de ${sem}`;
    $("#p-mz").innerHTML = ["critica", "grave", "leve"].map(gr => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="chip ${gr === "critica" ? "rojo" : gr === "grave" ? "amarillo" : "gris"}">${gr === "critica" ? "Críticas" : gr === "grave" ? "Graves" : "Leves"}</span><b class="num">${med.conteo[gr]}</b></div>`).join("");
    const s4 = Motor.semanasHasta(sem, 4);
    const l = Motor.incumplimientos().filter(i => i.nit === nit && s4.includes(i.semana)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    $("#p-tabla").innerHTML = l.length ? `<tr><th>Fecha</th><th>Servicio</th><th>Ciudad</th><th>Tipo</th><th>Gravedad</th><th>Estado</th></tr>` +
      l.map(i => `<tr><td>${esc(i.fecha)}</td><td>${esc(i.servicio_id)}</td><td>${esc(i.ciudad)}</td><td>${esc(i.tipo)}</td><td>${esc(i.gravedad)}</td><td>${esc(i.estado)}</td></tr>`).join("")
      : `<tr><td class="vacio">Sin novedades en las últimas 4 semanas. ¡Buen trabajo!</td></tr>`;
  }

  async function iniciar() {
    $("#f-login").addEventListener("submit", ingresar);
    $("#p-semana").addEventListener("change", render);
    $("#p-ind").addEventListener("change", render);
    $("#p-salir").addEventListener("click", () => { try { sessionStorage.removeItem("portal:nit"); } catch {} location.reload(); });
    if (API) return; // en modo seguro los datos llegan al ingresar
    try {
      const d = await Datos.cargarTodo(leerConfig());
      Motor.cargar(d);
    } catch (e) { $("#l-error").textContent = "No fue posible cargar la información: " + e.message; $("#l-error").classList.remove("oculto"); return; }
    let guardado = null; try { guardado = sessionStorage.getItem("portal:nit"); } catch {}
    if (guardado && Motor.proveedor(guardado)) { nit = guardado; mostrar(); }
  }
  iniciar();
})();
