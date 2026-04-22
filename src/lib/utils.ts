export const canvasWidth = 500;
export const canvasHeight = 500;
export const cooldown = 60 * 1000;
export const tokenExpirationSec = 300;

export const isCloudflare = navigator.userAgent == "Cloudflare-Workers";
export const clientEnv = Object.fromEntries(
    Object.entries(process.env).filter(entry => entry[0].startsWith("NEXT_PUBLIC_"))
) as ClientEnv;

export type ClientEnv = {
  [K in keyof NodeJS.ProcessEnv as K extends `NEXT_PUBLIC_${string}` ? K : never]: NodeJS.ProcessEnv[K];
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

export function createJSONResponse(data: { [key: string]: any }, status?: number): Response;
export function createJSONResponse(data: { [key: string]: any }, init: ResponseInit): Response;
export function createJSONResponse(message: string, status?: number): Response;
export function createJSONResponse(message: string, init: ResponseInit): Response;
export function createJSONResponse(data: { [key: string]: any } | string, init: ResponseInit | number = 200) {
    if (typeof init == "number") {
        init = { status: init };
    }
    if (typeof data == "string") {
      data = { message: data };
    }
    init.headers ??= {};
    if (init.headers instanceof Headers) {
      init.headers.set("Content-Type", "application/json");
    } else if (init.headers instanceof Array) {
      init.headers.push(["Content-Type", "application/json"]);
    } else {
      init.headers["Content-Type"] = "application/json";
    }
    return new Response(JSON.stringify(data), init);
}

export type Point = { x: number, y: number }

export function getDistance(p1: Point, p2: Point) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function getCenter(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

export interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname: string;
  'error-codes'?: TurnstileErrorCode[];
  action?: string;
  cdata?: string;
  'metadata.ephemeral_id'?: string;
}

export type TurnstileErrorCode = 
  | 'missing-input-secret'
  | 'invalid-input-secret'
  | 'missing-input-response'
  | 'invalid-input-response'
  | 'bad-request'
  | 'timeout-or-duplicate'
  | 'internal-error';

export async function validateTurnstile(token: string, remoteip: string) {
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip,
        }),
      },
    );

    const result = await response.json() as TurnstileResponse;
    return result;
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return { success: false, "error-codes": ["internal-error"] } as TurnstileResponse;
  }
}