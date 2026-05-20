import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  // Verify the request is authorized (using a shared secret or service role)
  const authHeader = req.headers.get("Authorization")
  const expectedSecret = Deno.env.get("PERSIST_TASKS_SECRET")
  
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    // Create Supabase client using service role key for elevated permissions
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    )

    // Execute the persist_previous_day_tasks function
    const { data, error } = await supabase.rpc("persist_previous_day_tasks", { p_force: false })

    if (error) {
      console.error("Error persisting tasks:", error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          details: error
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    console.log("Tasks persisted successfully:", data)
    return new Response(
      JSON.stringify({
        success: true,
        message: "Previous day tasks persisted successfully",
        data: data
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
  } catch (error) {
    console.error("Unexpected error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
