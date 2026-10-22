# 01 · Estructura del negocio y ecosistema de aliados

> ⚠️ Completa o ajusta los apartados marcados con **[COMPLETAR]** con la información oficial del área.
> El agente solo sabe lo que está escrito aquí y en `data/`.

## 1. La compañía
- **Servicios Bolívar S.A.**, parte del **Grupo Bolívar** (Seguros Bolívar, Banco Davivienda, entre otras).
- El área de **Relacionamiento de Aliados / Proveedores** administra la red nacional de aliados que
  prestan las asistencias a los asegurados.
- Alcance de este agente: **línea Autos** (asistencia vehicular). Puede ampliarse a Hogar y a
  asistencias jurídicas reemplazando los datos y metas.

## 2. Cadena de valor de una asistencia
```
Asegurado ─► Call center / Área de asignación ─► Aliado asignado ─► Prestación en sitio ─► Cierre
   ▲                    │                              │                   │
   │                    ▼                              ▼                   ▼
   └──── Encuesta de satisfacción ◄── Supervisor gestiona novedades ◄── Seguimiento ANS / matriz de calidad
```
1. El asegurado solicita la asistencia.
2. El área de asignación ofrece el servicio a un aliado según zona, tipo de servicio y disponibilidad.
3. El aliado acepta (o rechaza) y se desplaza; se mide la **oportunidad de llegada** frente al ANS.
4. Se presta el servicio; si hay daño, mala atención o falla atribuible al aliado se registra
   **responsabilidad**, **reclamación** o un **incumplimiento** en la matriz de calidad.
5. Se encuesta al asegurado (**satisfechos / insatisfechos**).

## 3. Tipos de servicio (línea Autos)
| Servicio | Descripción |
|---|---|
| Grúa | Traslado del vehículo por varada o accidente |
| Carro taller | Atención mecánica en sitio (batería, llanta, combustible) |
| Cerrajería | Apertura de vehículo |
| Conductor elegido | Conducción del vehículo del asegurado (Ruta Bolívar) |
| Transporte | Traslado de personas |
| [COMPLETAR] | Otros servicios del portafolio |

## 4. Clasificación de aliados
- **Por frecuencia:** **alta** (los que más servicios prestan), **media**, **baja**. La prioridad de
  intervención se pondera por frecuencia: un incumplimiento en un aliado de frecuencia alta afecta
  a más asegurados.
- **Por región / ciudad:** cada aliado tiene un **líder regional** responsable.
- **Ciclo de vida del aliado:** vinculación → operación → seguimiento → (plan de mejora /
  suspensión) → desvinculación.

## 5. Estructura del equipo
| Rol | Responsabilidad | Uso del agente |
|---|---|---|
| Líder nacional de relacionamiento | Estrategia, ingresos/salidas/suspensiones de aliados, proyectos, comités | Tablero diario, informes gerenciales, propuestas de medidas |
| Líderes regionales | Relación diaria con aliados, reuniones de seguimiento | Reporte semanal, alertas, expediente por aliado |
| Supervisores | Puente con call center / asignación; novedades, disponibilidad, casos complejos | Alertas de novedades y atípicos |
| Aliados | Prestación del servicio | Portal con su propio desempeño, informe mensual |

## 6. Alianzas vigentes
La lista oficial de aliados está en `data/proveedores.json` (NIT, razón social, servicio, ciudades,
frecuencia, líder regional, correo). **El agente no debe mencionar aliados que no estén en ese archivo.**

## 7. Clientes y cuentas colectivas
- La líder apoya los comités de seguimiento de **cuentas colectivas** con clientes relevantes.
- [COMPLETAR] Si se quiere analizar por cuenta, agregar la columna `cuenta` a los datos de indicadores.

## 8. Calendario operativo
- **Semana operativa:** lunes a domingo (ISO). Se identifica como `S<número>` del año.
- **Reporte interno:** lunes antes de las 9:00 a. m. (semana cerrada anterior).
- **Informe a aliados:** primer día hábil de cada mes (mes cerrado anterior).
- **Comité gerencial:** [COMPLETAR periodicidad].
