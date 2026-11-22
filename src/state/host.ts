import { useEffect } from "react";
import { getHost } from "@/lib/claude";
import { getState, setState, type Account, type LiveWait } from "./store";

/* On first load, connect to the optional host runtime (see lib/claude.ts):
   - shared "waits" collection for live wait times posted by business owners
   - the signed-in user, to sync the account to the cloud instead of this device */
let started = false;
export function useHostBootstrap() {
  useEffect(() => {
    if (started) return;
    started = true;
    (async () => {
      const db = await getHost("db");
      if (db) {
        setState({ db });
        try {
          db.collection("waits").onSnapshot(
            (qs: { docs: { id: string; exists: boolean; data: () => LiveWait }[] }) => {
              const L: Record<string, LiveWait> = {};
              qs.docs.forEach((d) => { if (d.exists) L[d.id] = d.data(); });
              setState({ live: L });
            },
            () => {},
          );
        } catch {
          /* ignore */
        }
      }
      const user = await getHost("user");
      let canPost: boolean | null = null;
      try { canPost = user ? await user.can("data.write") : false; } catch { canPost = null; }
      let meInfo = null;
      try { meInfo = user ? await user.me() : null; } catch { meInfo = null; }
      setState({ canPost, meInfo });
      if (db && meInfo && meInfo.id) {
        setState({ acctMode: "cloud" });
        const doc = db.doc("data/users/" + meInfo.id + "/profile");
        try {
          const d = await doc.get();
          if (d.exists) {
            const data = d.data() as Partial<Account>;
            setState((s) => ({ acct: { ...s.acct, ...data }, saved: data.saved || s.saved }));
          } else if (getState().acct.type) {
            const s = getState();
            await doc.set({ ...s.acct, saved: s.saved });
          }
        } catch {
          setState({ acctMode: "device" });
        }
        try {
          const n = await db.doc("newsletter/" + meInfo.id).get();
          setState((s) => ({ acct: { ...s.acct, newsletter: n.exists ? n.data() : null } }));
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);
}
