# Testing Guide: Persistir Button & Auto-Persist Functionality

## Pre-Requisites
- [ ] You're on branch `feature/auto-persistir-seguimiento`
- [ ] `npm run dev` is running
- [ ] You have access to your project's Seguimiento diario

---

## FASE 1: Manual "Persistir" Button Test (TODAY)

### Scenario A: When there ARE tasks from the previous business day

**Steps:**
1. Navigate to **Seguimiento** module
2. Click the **"Persistir"** button (bottom right area)
3. ✅ **Expected**: A modal opens showing tasks from the last business day
4. Review the tasks and make sure they are the correct ones
5. Select which tasks you want to persist (or keep all selected)
6. Click **"Persistir X tareas"** button
7. A confirmation dialog should appear
8. ✅ **Expected**: Confirmation dialog shows:
   - "Persistir tareas" title
   - Number of tasks being persisted
   - Two buttons: "Cancel" and "Persistir"
9. Click **"Persistir"** in the confirmation dialog
10. ✅ **Expected**: 
    - Modal closes
    - Toast notification: "Se persistieron X tareas"
    - Tasks now appear in today's Seguimiento list

### Scenario B: When there are NO tasks from the previous business day

**Steps:**
1. Navigate to **Seguimiento** on Monday morning (when Friday has no tasks)
2. Click the **"Persistir"** button
3. ✅ **Expected**: Toast notification: "Sin tareas previas" / "No se encontraron tareas..."
4. Modal should NOT open

### Verification Checklist
- [ ] Modal opens with correct tasks from previous day
- [ ] Tasks are selectable/deselectable
- [ ] "Persistir X tareas" button shows correct count
- [ ] Confirmation dialog appears before final persist
- [ ] Tasks are added to today's list after confirmation
- [ ] Activity log shows the persist action (check Activity module)
- [ ] No errors in browser console (F12 > Console)

---

## FASE 2: Edge Function Logs Test (THIS WEEKEND)

### Check Supabase Console Logs

1. Go to **Supabase Dashboard** > **Edge Functions**
2. Click on **persist-daily-tasks**
3. Click **Logs** tab
4. You should see entries like:

```
[persist-daily-tasks] Starting task persistence. Forced: false, Cron: false
[persist-daily-tasks] Success after 245ms: { task_count: 5, ... }
```

### Make a Manual API Call (Optional)

```bash
# From terminal, test the edge function
curl -X POST https://qlvnfbgkercwhdqhotdc.supabase.co/functions/v1/persist-daily-tasks \
  -H "Authorization: Bearer YOUR_PERSIST_TASKS_SECRET" \
  -H "Content-Type: application/json" \
  2>&1 | jq '.'
```

Expected response:
```json
{
  "success": true,
  "message": "Previous day tasks persisted successfully",
  "data": { ... },
  "duration": 245,
  "timestamp": "2026-10-22T12:34:56.789Z",
  "triggered_by": "http"
}
```

### Verification Checklist
- [ ] Edge function logs show successful execution
- [ ] Logs show "Cron: false" for manual triggers
- [ ] Duration is reasonable (< 1000ms)
- [ ] No errors in logs

---

## FASE 3: Automatic Cron Execution Test (NEXT MONDAY AT 6 AM)

### What Should Happen

**Monday, 6:00 AM (UTC)**:
1. PostgreSQL cron job triggers automatically
2. `persist_previous_day_tasks()` function executes
3. Previous Friday's non-resolved tasks are persisted to Monday
4. Activity log entry created with type `system_auto_persist`

### How to Verify

#### Option A: Monitor Logs
1. Supabase Console > Edge Functions > persist-daily-tasks > Logs
2. Look for entry around 6:00 AM UTC showing:
   ```
   [persist-daily-tasks] Cron: true
   ```

#### Option B: Check Activity Log
1. In app, go to **Activity** module
2. Filter by type `system_auto_persist`
3. Should see entry: "Automatic daily task persistence executed at 6:00 AM"

#### Option C: Check Seguimiento Diario
1. Open **Seguimiento** on Monday morning
2. Friday's unresolved tasks should already be in the list
3. No need to manually click "Persistir"

### Verification Checklist
- [ ] Logs show "triggered_by: cron" around 6 AM UTC
- [ ] Activity log has system_auto_persist entry
- [ ] Tasks from Friday are in Monday's Seguimiento automatically
- [ ] No manual action was required

---

## Debugging: Troubleshooting

### Issue: "Persistir" button doesn't open modal

**Solution:**
1. Check browser console for errors (F12 > Console)
2. Verify you're viewing a correct project
3. Verify there are tasks in the previous business day
4. Check database logs in Supabase

### Issue: Modal opens but shows wrong tasks

**Solution:**
1. Verify the date calculation for "previous business day"
2. Check if those dates have tasks in the database
3. Look at the `getPreviousBusinessDate()` function in DailiesModule.tsx

### Issue: Cron doesn't execute at 6 AM

**Potential causes:**
1. Migration wasn't applied to your Supabase database
2. pg_cron extension not enabled
3. Timezone difference (Supabase runs in UTC)
4. Database connection issues

**Fix:**
- Redeploy with: `supabase db push`
- Check Supabase Console > Database > Cron Jobs

---

## Test Results Template

Copy this and fill out:

```
Testing Date: _______________
Tester: _______________
Project: _______________

FASE 1 - Manual Persistir: ✅ / ⚠️ / ❌
Issues (if any): _______________

FASE 2 - Edge Function Logs: ✅ / ⚠️ / ❌
Issues (if any): _______________

FASE 3 - Automatic Cron (if tested): ✅ / ⚠️ / ❌
Issues (if any): _______________

Overall Status: READY FOR PRODUCTION / NEEDS FIXES / ON HOLD

Comments:
_______________
```

---

## Questions?

1. Check [AUTO_PERSIST_GUIDE.md](AUTO_PERSIST_GUIDE.md) for more context
2. Review the migration: `supabase/migrations/20261022132323_schedule_auto_persist_6am_weekdays.sql`
3. Check the edge function: `supabase/functions/persist-daily-tasks/index.ts`
