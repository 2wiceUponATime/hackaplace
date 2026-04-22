import { clientEnv } from "@/lib/utils";
import Client from "./client";

export default function Home() {
    return <Client env={clientEnv} />;
}