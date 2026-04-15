"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, fetchUserMe } from "@/lib/auth";
import { Tier } from "@/lib/tiers";
import OnboardingChat from "@/components/OnboardingChat";

export default function OnboardingPage() {
  const router = useRouter();
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/");
      return;
    }
    fetchUserMe().then((me) => {
      if (!me) { router.push("/"); return; }
      setTier(me.tier as Tier);
    });
  }, [router]);

  if (!tier) return null;

  return <OnboardingChat tier={tier} />;
}
