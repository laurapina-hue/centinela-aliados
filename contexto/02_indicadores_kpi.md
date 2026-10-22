# 02 · Indicadores, metas, semáforo y detección de atípicos

> Las metas numéricas viven en `data/metas.json` (fuente única de verdad que usa el tablero).
> Los valores de ejemplo deben reemplazarse por las metas oficiales de la compañía.

## 1. Datos base (columnas de `data/indicadores_semanales.csv`)
Se guardan **conteos**, no porcentajes, para que los totales por red, ciudad o mes sean exactos.

| Columna | Significado |
|---|---|
| `semana` | Semana ISO, formato `2026-S41` |
| `nit` | NIT del aliado (llave con `proveedores.json`) |
| `servicios` | Servicios prestados en la semana |
| `llegadas_a_tiempo` | Servicios con llegada dentro del tiempo ANS |
| `minutos_llegada_total` | Suma de minutos de llegada (para el promedio) |
| `encuestas` | Encuestas de satisfacción respondidas |
| `insatisfechos` | Encuestas con calificación de insatisfacción |
| `reclamaciones` | Reclamaciones formales radicadas |
| `casos_responsabilidad` | Casos con responsabilidad atribuida al aliado (daños, pérdidas) |
| `cancelaciones_aliado` | Servicios cancelados por causa del aliado |
| `asignaciones_ofrecidas` | Servicios ofrecidos al aliado |
| `asignaciones_rechazadas` | Servicios rechazados por el aliado |

## 2. Indicadores calculados
| Clave | Indicador | Fórmula | Mejor si |
|---|---|---|---|
| `oportunidad` | Oportunidad de llegada (%) | llegadas_a_tiempo / servicios × 100 | ↑ mayor |
| `tiempo_llegada` | Tiempo promedio de llegada (min) | minutos_llegada_total / servicios | ↓ menor |
| `satisfaccion` | Satisfacción (%) | (encuestas − insatisfechos) / encuestas × 100 | ↑ mayor |
| `insatisfechos` | Tasa de insatisfechos (%) | insatisfechos / encuestas × 100 | ↓ menor |
| `reclamaciones` | Reclamaciones por cada 1.000 servicios | reclamaciones / servicios × 1.000 | ↓ menor |
| `responsabilidad` | Responsabilidad del aliado (%) | casos_responsabilidad / servicios × 100 | ↓ menor |
| `cancelaciones` | Cancelaciones atribuibles (%) | cancelaciones_aliado / servicios × 100 | ↓ menor |
| `rechazo` | Rechazo de asignación (%) | asignaciones_rechazadas / asignaciones_ofrecidas × 100 | ↓ menor |
| `incumplimientos` | Incumplimientos de matriz por cada 100 servicios | registros en matriz / servicios × 100 | ↓ menor |

## 3. Semáforo
Cada indicador tiene en `metas.json` una **meta** (verde) y un **umbral de alerta** (amarillo):

- Indicadores "mayor es mejor": 🟢 valor ≥ meta · 🟡 umbral ≤ valor < meta · 🔴 valor < umbral
- Indicadores "menor es mejor": 🟢 valor ≤ meta · 🟡 meta < valor ≤ umbral · 🔴 valor > umbral

## 4. Índice de desempeño del aliado (IDA, 0–100)
Cada indicador puntúa 100 (verde), 60 (amarillo) o 0 (rojo); el IDA es el promedio ponderado con
los pesos de `metas.json`. Las categorías de desempeño se toman de `metas.json → categorias`
(alineadas a las categorías del ANS de Autos; **[COMPLETAR con las categorías oficiales]**).

## 5. Reglas de alerta
| Tipo | Regla | Severidad |
|---|---|---|
| Incumplimiento de meta | Indicador en rojo en la última semana | Alta |
| Racha | 3 o más semanas consecutivas en rojo | Crítica |
| Deterioro | 3 semanas consecutivas empeorando | Media |
| Atípico | Valor a más de 2 desviaciones estándar del promedio de las 8 semanas previas del mismo aliado (mínimo 4 semanas de histórico) | Media/Alta |
| Matriz crítica | Incumplimiento de gravedad **crítica** registrado en la semana | Crítica |
| Volumen | Variación de servicios > 40 % vs. promedio de 8 semanas (posible problema de disponibilidad o de registro) | Informativa |

## 6. Volumen mínimo
Si un aliado tiene menos de `volumen_minimo` servicios (ver `metas.json`) en la semana, sus
porcentajes se muestran pero **no generan alerta de semáforo**, solo una nota de "volumen bajo".
