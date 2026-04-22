import { createJSONResponse, signAsync, tokenExpirationSec, validateTurnstile } from "@/lib/utils";
import { sign } from "jsonwebtoken";
import z from "zod";

const schema = z.object({
    turnstileToken: z.string().nonempty()
});

export async function POST(req: Request) {
    const requestTimeSec = Math.floor(Date.now() / 1000);
    const token = signAsync({
        exp: requestTimeSec + tokenExpirationSec,
    });
    let json: { [key: string]: any };
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
    const data = result.data;
    const ip =
        req.headers.get("CF-Connecting-IP") ??
        req.headers.get("X-Forwarded-For") ??
        "unknown";
    const turnstileResult = await validateTurnstile(data.turnstileToken, ip);
    if (!turnstileResult.success) return createJSONResponse({
        message: "Turnstile validation failed" + (turnstileResult["error-codes"]
            ? ": " + turnstileResult["error-codes"]!.join(",")
            : ""
        ),
    }, 422);
    return createJSONResponse({
        token: await token,
    });
}