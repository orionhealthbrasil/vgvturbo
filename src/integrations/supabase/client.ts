// Custom client pointing to external Supabase instance
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://atnjikvdbvyvyabsxctj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0bmppa3ZkYnZ5dnlhYnN4Y3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTYxNjUsImV4cCI6MjEwMTMzMjE2NX0.9Vv61kqxm2ZKCxsy8AahQvw79Rx7rg65K0PIBUxw80w";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
