import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

/**
 * Healthcheck Edge Function
 * Purpose: Provide a public, deterministic 200 OK endpoint to integration test the DB and Edge Function regional connectivity.
 * Used by: UptimeRobot, Datadog Uptime, etc.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Perform a lightweight database ping (checking standard configuration table, or auth if RLS allows)
    // Here we run a rapid generic DB function just to ensure the pooler is alive and responsive.
    const { error: dbError } = await supabase.from('user_settings').select('id').limit(1);

    if (dbError) {
      console.error("Healthcheck DB Ping failed:", dbError);
      return jsonResponse(req, {
        status: "unhealthy",
        component: "database",
        message: "Database unavailable",
      }, 503);
    }

    // Success payload
    return jsonResponse(req, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      components: {
        database: "connected",
        edge_functions: "online"
      }
    }, 200);

  } catch (error) {
    console.error("Healthcheck severe failure:", error);
    return jsonResponse(req, {
      status: "unhealthy",
      message: "Internal Server Error",
    }, 500);
  }
});
