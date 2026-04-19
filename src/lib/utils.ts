export const canvasWidth = 500;
export const canvasHeight = 500;
export const cooldown = 60 * 1000;

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