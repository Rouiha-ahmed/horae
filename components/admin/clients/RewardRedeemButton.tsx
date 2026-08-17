"use client";

import { useActionState, useMemo } from "react";
import { redeemRewardAction, type CustomerActionState } from "@/app/admin/clients/actions";

const initial: CustomerActionState = { success: false };

export default function RewardRedeemButton({ userId, rewardId, disabled }: { userId: string; rewardId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(redeemRewardAction, initial);
  const key = useMemo(() => `admin:${userId}:${rewardId}:${crypto.randomUUID()}`, [userId, rewardId]);
  return <form action={action} className="mt-3"><input type="hidden" name="userId" value={userId} /><input type="hidden" name="rewardId" value={rewardId} /><input type="hidden" name="idempotencyKey" value={key} /><button disabled={disabled || pending} className="h-8 w-full rounded-xl border border-blue-100 bg-white text-[10px] font-semibold text-blue-600 disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Émission…" : disabled ? "Points insuffisants" : "Émettre"}</button>{state.error ? <p className="mt-1 text-[9px] text-rose-600">{state.error}</p> : null}{state.success ? <p className="mt-1 text-[9px] text-emerald-600">Émise</p> : null}</form>;
}
