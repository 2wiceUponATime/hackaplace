"use client";

import dynamic from "next/dynamic";
import { ClientEnv } from "@/lib/utils";

const Client = dynamic(() => import("./client"), { ssr: false });

export default function ClientWrapper({ env }: { env: ClientEnv }) {
	return <Client env={env} />;
}
