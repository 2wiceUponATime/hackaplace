import { supabase } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import { canvasHeight, canvasWidth, cooldown, createJSONResponse } from "@/lib/utils";
import z from "zod";

const schema = z.object({
    x: z.int().min(0).max(canvasWidth - 1),
    y: z.int().min(0).max(canvasHeight - 1),
    color: z.int().min(0).max(0xffffff),
});

export async function POST(req: Request) {
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
            .upsert(data);
    }
    const requestTime = new Date();
    const session = await getAuth().api.getSession({ headers: req.headers });
    if (!session) {
        return createJSONResponse({ message: "Not logged in" }, 401);
    }
    const lastPlaceTime = session.user.lastPlaceTime;
    if (lastPlaceTime && !session.user.unlimitedPlace) {
        const timeSincePlace = requestTime.getTime() - lastPlaceTime.getTime();
        if (timeSincePlace < cooldown) {
            const waitTime = Math.ceil((cooldown - timeSincePlace) / 1000);
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
    let json;
    try {
        json = await req.json();
    } catch (err) {
        return createJSONResponse({
            message: "Malformed or missing JSON",
        }, 400)
    }
    const result = schema.safeParse(json);
    if (!result.success) {
        return createJSONResponse({
            message: "Invalid JSON body",
            issues: result.error.issues,
        }, 400);
    }
    const data = result.data;
    await supabase
        .from("user")
        .update({
            lastPlaceTime: requestTime.toISOString(),
        })
        .eq("id", session.user.id);
    updateDatabase().catch(console.error);
    return new Response();
}