import { createClient } from "@supabase/supabase-js";
import { Database } from "./supabase.types";

export function createServerClient() {
    return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
}