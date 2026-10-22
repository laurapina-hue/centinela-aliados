/* =====================================================================
   gemini.js · Cliente mínimo de la API de Gemini (Google AI Studio)
   - La API key la ingresa cada usuaria en Configuración; nunca se
     guarda en el repositorio.
   - Endpoint: generateContent (v1beta), compatible con la capa gratuita.
   ===================================================================== */
const Gemini = (() => {
  const BASE = "https://generativelanguage.googleapis.com/v1beta";

  async function generar({ apiKey, modelo, sistema, mensajes, temperatura = 0.2, maxTokens = 4096 }) {
    if (!apiKey) throw new Error("Falta la API key de Gemini. Ingrésala en Configuración.");
    const cuerpo = {
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensajes.map(m => ({ role: m.rol === "ia" ? "model" : "user", parts: [{ text: m.texto }] })),
      generationConfig: { temperature: temperatura, maxOutputTokens: maxTokens },
    };
    let r;
    try {
      r = await fetch(`${BASE}/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(cuerpo),
      });
    } catch (e) {
      throw new Error("No hay conexión con la API de Gemini (revisa internet o el firewall corporativo).");
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(traducirError(r.status, j));
    const cand = j.candidates && j.candidates[0];
    if (!cand) throw new Error("Gemini no devolvió respuesta" + (j.promptFeedback ? ` (${j.promptFeedback.blockReason || "bloqueada"})` : "."));
    const texto = (cand.content?.parts || []).map(p => p.text || "").join("");
    if (!texto) throw new Error("Respuesta vacía (motivo: " + (cand.finishReason || "desconocido") + ").");
    return { texto, uso: j.usageMetadata || null, fin: cand.finishReason };
  }

  function traducirError(status, j) {
    const msg = j?.error?.message || "";
    if (status === 400 && /API key/i.test(msg)) return "La API key no es válida. Verifícala en Google AI Studio.";
    if (status === 403) return "La API key no tiene permiso para este modelo o el servicio no está habilitado.";
    if (status === 404) return "El modelo configurado no existe o no está disponible. Usa «Detectar modelos» en Configuración.";
    if (status === 429) return "Se alcanzó el límite de la capa gratuita (por minuto o por día). Espera un momento e intenta de nuevo.";
    if (status >= 500) return "Gemini está temporalmente no disponible. Intenta en unos minutos.";
    return `Error ${status}: ${msg || "solicitud rechazada"}`;
  }

  /** Lista los modelos disponibles para la key que soportan generateContent */
  async function listarModelos(apiKey) {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(traducirError(r.status, j));
    return (j.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => m.name.replace("models/", ""))
      .filter(n => /gemini/i.test(n) && !/embedding|image|tts|audio|live/i.test(n));
  }

  return { generar, listarModelos };
})();
