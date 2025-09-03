import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eoksebckgtuikivpafcl.supabase.co";
const supabaseAnonKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3NlYmNrZ3R1aWtpdnBhZmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMDM3MzgsImV4cCI6MjA3MDY3OTczOH0.O9WsBpUx6t79UqlOUC9JWYfR71mvNpEkpsBEzqUkwKY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      // Note: CORS is ultimately enforced by the server's response headers.
      // These request headers are added for completeness, but servers must
      // still be configured to allow the origin.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "X-Client-Info": "qr-table-ordering"
    }
  }
});
