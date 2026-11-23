import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@/lib/icons";
import type { Place } from "@/lib/types";
import { directionsOnMap, nearestOnMap } from "@/state/store";
import { PlaceSheet, type SheetActions } from "./map/PlaceSheet";

/** A temporary full-page view of a place (the map's place sheet, full height) with a ✕ at the top right.
 *  Used by the chat Guide's Details buttons so you can read up on a stop without leaving the chat.
 *  Nearby places open in place; Directions / Parking / Restroom hand over to the map. */
export function PlaceDetailPage({ place, onClose }: { place: Place; onClose: () => void }) {
  const [p, setP] = useState(place);
  const [tab, setTab] = useState("overview");
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: 0 });
  }, [p]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const actions: SheetActions = {
    openPlace: (q) => { setP(q); setTab("overview"); },
    startDirections: (q) => { onClose(); directionsOnMap(q.id); },
    showNearest: (q, k) => { onClose(); nearestOnMap(q.id, k); },
    // the Overview's "Route" buttons go from the nearest garage, or to the nearest restroom
    showRouteBetween: (_a, _b, label) => { onClose(); nearestOnMap(p.id, /restroom/i.test(label || "") ? "wc" : "park"); },
  };
  return (
    <div role="dialog" aria-modal="true" aria-label={p.name} className="bg-overlay absolute inset-0 z-30">
      <div ref={boxRef} tabIndex={-1} className="h-full overflow-y-auto overscroll-contain outline-none">
        {/* the ✕ sits in its own row above the photos and scrolls away with the page */}
        <div className="flex h-14 items-center justify-end px-3">
          <Button isIconOnly variant="ghost" aria-label="Close" onPress={onClose} className="size-10 rounded-full">
            <Icon name="close" size={20} />
          </Button>
        </div>
        <div key={p.id} className="pb-[max(16px,env(safe-area-inset-bottom))]">
          <PlaceSheet p={p} tab={tab} setTab={setTab} actions={actions} />
        </div>
      </div>
    </div>
  );
}
