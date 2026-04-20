export const canvasWidth = 500;
export const canvasHeight = 500;
export const cooldown = 60 * 1000;

export const isCloudflare = navigator.userAgent == "Cloudflare-Workers";
export const env = isCloudflare ? (await import("cloudflare:workers")).env : process.env;
export const clientEnv = Object.fromEntries(
    Object.entries(env).filter(entry => entry[0].startsWith("NEXT_PUBLIC_"))
) as ClientEnv;

export type Env = Cloudflare.Env | NodeJS.ProcessEnv
export type ClientEnv = {
  [K in keyof Env as K extends `NEXT_PUBLIC_${string}` ? K : never]: Env[K];
};

export function clamp(x: number, min: number, max: number) {
    return Math.max(min, Math.min(max, x));
}

export function numberToColor(x: number) {
    return "#" + x.toString(16).padStart(6, "0");
}

export function colorToNumber(x: string) {
    return parseInt(x.slice(1), 16);
}

export function createJSONResponse(data: any, status?: number): Response;
export function createJSONResponse(data: any, init: ResponseInit): Response;
export function createJSONResponse(data: any, init: ResponseInit | number = 200) {
    if (typeof init == "number") {
        init = { status: init }
    }
    return new Response(JSON.stringify(data), init);
}