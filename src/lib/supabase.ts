import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eoksebckgtuikivpafcl.supabase.co";
const supabaseAnonKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3NlYmNrZ3R1aWtpdnBhZmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMDM3MzgsImV4cCI6MjA3MDY3OTczOH0.O9WsBpUx6t79UqlOUC9JWYfR71mvNpEkpsBEzqUkwKY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
