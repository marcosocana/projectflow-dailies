import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  const startTime = Date.now()
  const authHeader = req.headers.get("Authorization")
  const expectedSecret = Deno.env.get("PERSIST_TASKS_SECRET")
  const isAuthorized = authHeader === `Bearer ${expectedSecret}`
  
  // Allow calls from:
  // 1. Authorized HTTP requests (with Bearer token)
  // 2. Cron scheduler (no auth needed, runs internally)
  const isCronTrigger = req.headers.get("x-cron-trigger") === "true"
  
  if (!isAuthorized && !isCronTrigger) {
    console.warn("Unauthorized request to persist-daily-tasks")
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    // Create Supabase client using service role key for elevated permissions
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration")
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get query parameter to determine if forced
    const url = new URL(req.url)
    const force = url.searchParams.get("force") === "true"

    console.log(`[persist-daily-tasks] Starting task persistence. Forced: ${force}, Cron: ${isCronTrigger}`)

    // Execute the persist_previous_day_tasks function
    const { data, error } = await supabase.rpc("persist_previous_day_tasks", { 
      p_force: force 
    })

    const duration = Date.now() - startTime

    if (error) {
      console.error(`[persist-daily-tasks] Error after ${duration}ms:`, error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          details: error,
          duration,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    console.log(`[persist-daily-tasks] Success after ${duration}ms:`, data)
    return new Response(
      JSON.stringify({
        success: true,
        message: "Previous day tasks persisted successfully",
        data: data,
        duration,
        timestamp: new Date().toISOString(),
        triggered_by: isCronTrigger ? "cron" : "http"
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[persist-daily-tasks] Unexpected error after ${duration}ms:`, error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
