import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXFsZHZsa2tlZGNneXhjYW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3Mjc2MzAsImV4cCI6MjA0MjMwNzYzMH0.b-XoG8tE"; // typical local dev anon key. But actually I should use service role key to delete all, or just run a sql command via supabase cli.
