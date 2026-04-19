import { genericOAuthClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";


export const authClient = createAuthClient({
    plugins: [
        genericOAuthClient(),
        inferAdditionalFields<typeof auth>(),
    ]
});