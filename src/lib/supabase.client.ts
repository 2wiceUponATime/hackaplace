import { createClient } from "@supabase/supabase-js";
import { Database } from "./supabase.types";

export function createBrowserClient() {
    return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);
}