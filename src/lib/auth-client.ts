import { genericOAuthClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { getAuth } from "./auth";


export const authClient = createAuthClient({
    plugins: [
        genericOAuthClient(),
        inferAdditionalFields<ReturnType<typeof getAuth>>(),
    ]
});