import { createClient } from "@supabase/supabase-js";
import { Database } from "./supabase.types";
import { ClientEnv } from "./utils";

export function createBrowserClient(env: ClientEnv) {
    return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_KEY);
}