import { getAuth } from "@/lib/auth";

export function GET(request: Request) {
    return getAuth().handler(request);
}

export const POST = GET;