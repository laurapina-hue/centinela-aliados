# 04 · Matriz de calidad: tipificación, gravedad y medidas

> Los registros diarios viven en `data/incumplimientos.csv`. Cada fila es una novedad tipificada.
> **[COMPLETAR]** con la tipificación y las medidas oficiales de la matriz vigente.

## 1. Columnas del registro
| Columna | Significado |
|---|---|
| `fecha` | Fecha de la novedad (AAAA-MM-DD) |
| `semana` | Semana ISO (`2026-S41`) |
| `nit` | NIT del aliado |
| `servicio_id` | Número de expediente / servicio |
| `ciudad` | Ciudad de la novedad |
| `tipo` | Tipificación (ver tabla 2) |
| `gravedad` | `leve`, `grave` o `critica` |
| `descripcion` | Breve descripción del hecho |
| `estado` | `abierto`, `en_descargos`, `cerrado` |
| `medida` | Medida aplicada o propuesta |

## 2. Tipificación de referencia
| Tipo | Gravedad por defecto | Indicador relacionado |
|---|---|---|
| Llegada tarde | leve / grave según tramo | Oportunidad, tiempo de llegada |
| No presentación | grave | Cancelaciones, oportunidad |
| Rechazo injustificado de asignación | leve | Rechazo |
| Mala atención al asegurado | grave | Insatisfechos, reclamaciones |
| Daño al vehículo | crítica | Responsabilidad, reclamaciones |
| Cobro indebido al asegurado | crítica | Reclamaciones |
| Incumplimiento documental (pólizas, GPS) | grave | — |
| Falsedad en la información del servicio | crítica | — |

## 3. Escalamiento (seguimiento 90 días escalable)
| Reincidencia en 90 días | Medida propuesta |
|---|---|
| 1 leve | Llamado verbal (registro en bitácora) |
| 2–3 leves o 1 grave | Llamado de atención escrito |
| 4+ leves, 2 graves o IDA "En observación" 2 semanas | Plan de mejora con compromisos y fechas |
| 1 crítica, 3 graves o IDA "Crítico" 3 semanas | Propuesta de suspensión temporal (requiere Jurídico) |
| Reincidencia tras suspensión | Propuesta de terminación (requiere Jurídico) |

La clasificación por **frecuencia** (alta/media/baja) modula la prioridad, no la medida: el
debido proceso aplica igual para todos.

## 4. Lo que el agente hace con la matriz
- Cuenta incumplimientos por aliado, tipo y gravedad en la ventana de 90 días.
- Propone la medida que corresponde según la tabla 3, **siempre como propuesta**.
- Cruza la tipificación con los indicadores (ej.: llegadas tarde ↔ oportunidad).
