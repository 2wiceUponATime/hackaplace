import { clientEnv } from "@/lib/utils";
import Client from "./client";

export default async function Home() {
    return <Client env={clientEnv} />;
}