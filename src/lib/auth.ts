import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { genericOAuth } from "better-auth/plugins";

const dialect = new Pool({
  connectionString: process.env.BETTER_AUTH_DB_URL,
});

export const auth = betterAuth({
  database: dialect,
  baseURL: "http://localhost:3000/",
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
