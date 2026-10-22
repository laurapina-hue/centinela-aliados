# 05 · Catálogo de entregables y plantillas

El agente debe saber producir los siguientes entregables. Las plantillas usan `{{variables}}`.

## A. OPERATIVOS

### A1. Bitácora de novedades (registro diario)
`Fecha | Aliado | Ciudad | Servicio | Tipo de novedad | Gravedad | Acción inmediata | Responsable | Estado`

### A2. Alerta por incumplimiento
```
🔴 ALERTA · {{aliado}} (NIT {{nit}}) · {{ciudad}}
Indicador: {{indicador}} · Semana {{semana}}
Resultado: {{valor}} · Meta: {{meta}} · Brecha: {{brecha}}
Contexto: {{tendencia_y_matriz}}
Acción sugerida: {{accionable}} · Responsable: {{lider_regional}} · Plazo: {{plazo}}
```

### A3. Comunicación a aliado (informe mensual de desempeño)
Asunto: `Resultados de desempeño {{mes}} · {{aliado}}`
1. Saludo y propósito (reconocer el trabajo conjunto).
2. Resultados del mes por indicador vs. meta (solo del aliado; opcional: promedio de red anónimo).
3. Fortalezas (indicadores en verde).
4. Oportunidades de mejora (indicadores en amarillo/rojo) con ejemplos de la matriz.
5. Compromisos solicitados y fecha de seguimiento.
6. Cierre cordial y canal de contacto (líder regional).

## B. DE CONTROL

### B1. Expediente por aliado
Datos maestros · IDA y categoría actual · evolución 12 semanas · incumplimientos 90 días por tipo y
gravedad · medidas aplicadas · compromisos abiertos · próxima revisión.

### B2. Informe de desempeño
Periodo · resumen ejecutivo · ranking de aliados por IDA · indicadores de red vs. meta · aliados
críticos · comparativo por ciudad y servicio.

### B3. Propuesta de medida disciplinaria
```
PROPUESTA — SUJETA A DEBIDO PROCESO Y REVISIÓN DE JURÍDICO
Aliado: {{aliado}} · NIT {{nit}} · Frecuencia: {{frecuencia}}
Hechos (90 días): {{lista_incumplimientos_con_fecha_y_servicio}}
Indicadores afectados: {{indicadores}}
Regla de escalamiento aplicable: {{regla_matriz}}
Medida propuesta: {{medida}}
Antecedentes de medidas previas: {{antecedentes}}
Recomendación de comunicación: {{tono_y_canal}}
```

## C. GERENCIALES

### C1. Reporte semanal al equipo (lunes)
1. Titular de la semana (una frase).
2. Semáforo de red (indicadores de red vs. meta y variación vs. semana anterior).
3. Top 5 alertas priorizadas.
4. Aliados con mejor y peor IDA.
5. Accionables de la semana con responsable.

### C2. Informe / presentación para comité o gerencia
Diapositivas: (1) Mensaje clave · (2) Resultados de red vs. meta · (3) Evolución 12 semanas ·
(4) Mapa de aliados por categoría · (5) Riesgos y casos críticos · (6) Plan de acción y
decisiones requeridas · (7) Próximos pasos e iniciativas de innovación.

## D. FORMALES (siempre BORRADOR para revisión de Jurídico cuando aplique)
- **Comunicado** a aliados (cambios operativos, recordatorios contractuales).
- **Acta** de reunión o comité: fecha, asistentes, temas, compromisos (responsable/fecha).
- **Borrador** de llamado de atención, suspensión o terminación.
