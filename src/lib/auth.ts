import { betterAuth } from "better-auth";
import { Pool } from "@neondatabase/serverless";
import { genericOAuth } from "better-auth/plugins";

export function getAuth() {
  return betterAuth({
    database: new Pool({
      connectionString: process.env.BETTER_AUTH_DB_URL,
    }),
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [
      genericOAuth({
        config: [{
          providerId: "hack-club",
          clientId: process.env.HACK_CLUB_CLIENT_ID,
          clientSecret: process.env.HACK_CLUB_CLIENT_SECRET,
          discoveryUrl: "https://auth.hackclub.com/.well-known/openid-configuration",
          scopes: ["openid", "email", "profile"],
        }]
      }),
    ],
    user: {
      additionalFields: {
        lastPlaceTime: {
          type: "date",
          required: false,
          input: false,
        },
        unlimitedPlace: {
          type: "boolean",
          required: true,
          input: false,
          defaultValue: () => false,
        }
      }
    }
  });
}