import { getAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { canvasHeight, canvasWidth, cooldown, createJSONResponse, verifyAsync } from "@/lib/utils";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { JsonWebTokenError, JwtPayload, verify } from "jsonwebtoken";
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
                    `Wait another ${waitTime} seconds before placing`,
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
    async function checkJWT() {
        try {
            await verifyAsync(data.token);
        } catch (err) {
            if (err instanceof JsonWebTokenError) {
                return createJSONResponse(`JWT error: ${err.message}`, 401);
            }
            throw err;
        }
    }
    const requestTime = new Date();
    const sessionPromise = checkSession();
    let json: { [key: string]: any };
    try {
        json = await req.json();
    } catch (err) {
        return createJSONResponse("Malformed or missing JSON", 400);
    }
    const result = schema.safeParse(json);
    if (!result.success) {
        return createJSONResponse({
            message: "Invalid JSON body",
            issues: result.error.issues,
        }, 400);
    }
    const data = result.data;
    const tokenPromise = checkJWT();
    const sessionError = await sessionPromise;
    if (sessionError) return sessionError;
    const tokenError = await tokenPromise;
    if (tokenError) return tokenError;
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(updateDatabase());
    return new Response();
}