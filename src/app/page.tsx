"use client";

import dynamic from "next/dynamic";

const SignFlowApp = dynamic(() => import("@/components/SignFlowApp"), {
  ssr: false,
  loading: () => (
    <main className="flex h-dvh w-screen items-center justify-center bg-black text-white">
      <p className="text-sm tracking-wide text-white/60">Loading ASL alphabet…</p>
    </main>
  ),
});

export default function Home() {
  return <SignFlowApp />;
}
