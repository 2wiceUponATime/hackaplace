import { createClient } from "@supabase/supabase-js";
import { Database } from "./supabase.types";
import { Env } from "./utils";

export function createServerClient(env: Env) {
    return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
}