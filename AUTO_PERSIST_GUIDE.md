# Auto-Persistir Seguimiento Diario

## Descripción

Este cambio automatiza la persistencia de tareas en el "Seguimiento" diario. Las tareas del día anterior se persistirán automáticamente todos los días a las **6:00 AM**, de **lunes a viernes**.

## Cambios Implementados

### 1. Migración de Base de Datos
**Archivo**: `supabase/migrations/20261022132323_schedule_auto_persist_6am_weekdays.sql`

- ✅ Crea función `cron_persist_daily_tasks()` que ejecuta la persistencia
- ✅ Configura pg_cron para ejecutar automáticamente a las 6:00 AM en días laborales
- ✅ Registra la acción en el activity log

### 2. Edge Function Mejorada
**Archivo**: `supabase/functions/persist-daily-tasks/index.ts`

- ✅ Mejor logging para debugging
- ✅ Soporta trigger desde cron scheduler
- ✅ Parámetro `force=true` para testing
- ✅ Registra duración de ejecución

### 3. Configuración Deno
**Archivo**: `supabase/functions/persist-daily-tasks/deno.json`

- ✅ Importes necesarios para la función

## Cómo Verificar que Funciona

### 1. Verificación Manual (Recomendado)

Prueba el botón "Persistir" en la interfaz:

```bash
# 1. Ejecuta el servidor
npm run dev

# 2. En tu navegador, ve a la sección "Seguimiento"
# 3. Haz click en el botón "Persistir"
# 4. Selecciona las tareas que deseas persistir
# 5. Haz click en "Persistir X tareas"
# 6. Confirma en el modal
```

### 2. Verificación de la Edge Function (Via HTTP)

```bash
# Llama la función manualmente (requiere tu PERSIST_TASKS_SECRET)
curl -X POST https://qlvnfbgkercwhdqhotdc.supabase.co/functions/v1/persist-daily-tasks \
  -H "Authorization: Bearer YOUR_PERSIST_TASKS_SECRET" \
  -H "Content-Type: application/json"
```

### 3. Verificación de Logs

En Supabase Console:
- Ve a **Edge Functions** > **persist-daily-tasks**
- Abre la sección **Logs**
- Busca líneas que comiencen con `[persist-daily-tasks]`

Podrás ver:
- Cuándo se ejecutó
- Si fue desde HTTP o desde Cron
- Cuántas tareas se persistieron
- Duración de la ejecución

### 4. Verificación de Actividad (Activity Log)

En la app, en el módulo de **Activity Log**:
- Busca eventos con tipo `system_auto_persist`
- Verá cuando se ejecutó automáticamente

## Cronograma de Ejecución

**Expresión Cron**: `0 6 * * 1-5`

| Campo | Valor | Significado |
|-------|-------|-------------|
| Minuto | 0 | En el minuto 00 |
| Hora | 6 | A las 6 AM (06:00) |
| Día del mes | * | Cualquier día |
| Mes | * | Cualquier mes |
| Día de la semana | 1-5 | Lunes a viernes |

**Zona horaria**: UTC (por defecto en Supabase). Ajusta según tu zona.

## Testing Progresivo

### Fase 1: Verificar que el botón funciona (HOY)
```
✓ El botón "Persistir" carga tareas correctamente
✓ Modal aparece con las tareas del día anterior
✓ Se pueden seleccionar/deseleccionar tareas
✓ Las tareas se insertan en el día actual
```

### Fase 2: Verificar logs de la función (ESTE FIN DE SEMANA)
```
✓ Edge Function logs muestran que se llama correctamente
✓ No hay errores en la base de datos
✓ Activity log registra las acciones
```

### Fase 3: Esperar el próximo lunes a las 6 AM
```
✓ Cron job se ejecuta automáticamente
✓ Logs muestran "triggered_by: cron"
✓ Tareas persisten sin intervención manual
```

## Rollback

Si necesitas desactivar el cron job:

```sql
-- Conecta a tu base de datos Supabase
SELECT cron.unschedule('auto-persist-daily-tasks-6am-weekdays');
```

## Troubleshooting

**Problema**: Las tareas no se persisten automáticamente
- ✓ Verifica que la migración se ejecutó correctamente
- ✓ Checa los logs de la edge function
- ✓ Confirma que pg_cron está habilitado en tu Supabase

**Problema**: El cron se ejecuta pero no hace nada
- ✓ Verifica que existan tareas en el día anterior
- ✓ Checa la configuración del `persist_previous_day_tasks()` RPC
- ✓ Revisa los logs de Supabase para errores

**Problema**: Quiero probar a una hora diferente
- ✓ Actualiza el cron schedule en la migración
- ✓ O llama manualmente a la edge function durante desarrollo

## Próximos Pasos

Después de merge a main:
- [ ] Monitorear logs durante 1-2 semanas
- [ ] Ajustar la hora si es necesario (ej: 5:30 AM vs 6:00 AM)
- [ ] Considerar notificación al usuario cuando se persista automáticamente
