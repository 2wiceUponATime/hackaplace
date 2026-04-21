import { getAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { canvasHeight, canvasWidth, cooldown, createJSONResponse, validateTurnstile } from "@/lib/utils";
import z from "zod";

const schema = z.object({
    x: z.int().min(0).max(canvasWidth - 1),
    y: z.int().min(0).max(canvasHeight - 1),
    color: z.int().min(0).max(0xffffff),
    token: z.string().nonempty()
});

export async function POST(req: Request) {
    const supabase = createServerClient();
    async function updateDatabase() {
        if (data.color == 0xffffff) {
            await supabase
                .from("pixel")
                .delete()
                .match({
                    x: data.x,
                    y: data.y,
                });
            return;
        }
        await supabase
            .from("pixel")
            .upsert({
                x: data.x,
                y: data.y,
                color: data.color,
            });
    }
    async function checkSession() {
        const session = await getAuth().api.getSession({ headers: req.headers });
        if (!session) {
            return createJSONResponse({ message: "Not logged in" }, 401);
        }
        const lastPlaceTime = session.user.lastPlaceTime;
        const updatePromise = supabase
            .from("user")
            .update({
                lastPlaceTime: requestTime.toISOString(),
            })
            .eq("id", session.user.id);
        if (lastPlaceTime && !session.user.unlimitedPlace) {
            const timeSincePlace = requestTime.getTime() - lastPlaceTime.getTime();
            if (timeSincePlace < cooldown) {
                const waitTime = Math.ceil((cooldown - timeSincePlace) / 1000);
                await updatePromise;
                return createJSONResponse(
                    {
                        message: `Wait another ${waitTime} seconds before placing`,
                    },
                    {
                        status: 429,
                        headers: {
                            "Content-Type": "application/json",
                            "Retry-After": waitTime.toString(),
                        },
                    }
                );
            }
        }
        await updatePromise;
    }
    const requestTime = new Date();
    const sessionPromise = checkSession();
    let json;
    try {
        json = await req.json();
    } catch (err) {
        return createJSONResponse({
            message: "Malformed or missing JSON",
        }, 400);
    }
    const result = schema.safeParse(json);
    if (!result.success) {
        return createJSONResponse({
            message: "Invalid JSON body",
            issues: result.error.issues,
        }, 400);
    }
    const ip =
        req.headers.get("CF-Connecting-IP") ??
        req.headers.get("X-Forwarded-For") ??
        "unknown";
    const data = result.data;
    const turnstilePromise = validateTurnstile(data.token, ip);
    const sessionError = await sessionPromise;
    if (sessionError) return sessionError;
    const turnstileResult = await turnstilePromise;
    if (!turnstileResult.success) return createJSONResponse({
        message: "Turnstile validation failed" + (turnstileResult["error-codes"]
            ? ": " + turnstileResult["error-codes"]!.join(",")
            : ""
        ),
    }, 422);
    updateDatabase().catch(console.error);
    return new Response();
}