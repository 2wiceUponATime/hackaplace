"use server";

import { clientEnv } from "@/lib/utils";
import ClientWrapper from "./client-wrapper";

export default async function Home() {
    return <ClientWrapper env={clientEnv} />;
}