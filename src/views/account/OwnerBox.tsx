import { Button, Card, Chip } from "@heroui/react";
import { liveWait } from "@/lib/waits";
import { ago } from "@/lib/format";
import { postWait, useApp } from "@/state/store";
import type { Place } from "@/lib/types";

/** "Own this restaurant?" card: business owners post the current wait for visitors. */
export function OwnerBox({ p }: { p: Place }) {
  const live = useApp((s) => s.live);
  const db = useApp((s) => s.db);
  const canPost = useApp((s) => s.canPost);
  const lw = liveWait(p, live);
  return (
    <Card variant="secondary" className="mt-3.5 gap-2.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <b className="text-foreground text-sm font-semibold">Own this restaurant?</b>
        {lw && <Chip size="sm" variant="soft" color="success">~{lw.minutes} min · {ago(lw.at)}</Chip>}
      </div>
      <span className="text-muted text-[13px]">Post your current wait so visitors can plan.</span>
      <div className="flex flex-wrap gap-1.5">
        {[0, 10, 20, 30, 45, 60].map((m) => (
          <Button
            key={m}
            size="sm"
            variant={lw?.minutes === m ? "primary" : "tertiary"}
            className="rounded-full"
            onPress={() => postWait(p.id, m)}
          >
            {m === 0 ? "No wait" : m === 60 ? "60+ min" : m + " min"}
          </Button>
        ))}
        {lw && (
          <Button size="sm" variant="danger-soft" className="rounded-full" onPress={() => postWait(p.id, null)}>
            Clear
          </Button>
        )}
      </div>
      {(canPost === false || !db) && <small className="text-muted text-xs">Owner tools aren't live yet.</small>}
    </Card>
  );
}
