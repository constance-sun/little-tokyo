/* Satellite imagery under the vector map.
   Map coordinates are metres from an origin at 34.0495° N, 118.2400° W, x east / y south,
   using a plain equirectangular projection (fitted against OSM building nodes: 3 cm median error).
   Tiles are Esri World Imagery (Web Mercator XYZ), drawn as SVG <image>s placed in map metres,
   so they pan and zoom with the rest of the world group. */

export const ORIGIN = { lat: 34.0495, lon: -118.24 };
const MY = 110574; // metres per degree latitude
const MX = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180); // metres per degree longitude here

export const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
export const IMAGERY_CREDIT = "Imagery © Esri, Maxar, Earthstar Geographics";
export const IMAGERY_LINK = "https://www.esri.com/en-us/arcgis/products/arcgis-online/overview";

const BASE_Z = 17; // always loaded over the whole map, so there's never a blank patch
const MAX_Z = 20; // z21 is a "Map data not yet available" placeholder here

const xOf = (lon: number) => (lon - ORIGIN.lon) * MX;
const yOf = (lat: number) => (ORIGIN.lat - lat) * MY;
const lonOf = (x: number) => ORIGIN.lon + x / MX;
const latOf = (y: number) => ORIGIN.lat - y / MY;
const tileLon = (tx: number, z: number) => (tx / 2 ** z) * 360 - 180;
const tileLat = (ty: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / 2 ** z))) * 180) / Math.PI;
const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

const NS = "http://www.w3.org/2000/svg";

export class Imagery {
  g: SVGGElement;
  private levels = new Map<number, SVGGElement>();
  private have = new Set<string>();
  constructor(
    parent: SVGGElement,
    private bounds: [number, number, number, number],
  ) {
    this.g = document.createElementNS(NS, "g") as SVGGElement;
    this.g.setAttribute("class", "g-imagery");
    parent.append(this.g);
  }

  /** Load tiles for the visible rect (map metres) at a zoom matching `pxPerM` screen pixels per metre. */
  update(view: [number, number, number, number], pxPerM: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mPerPx = 1 / (pxPerM * dpr);
    const want = Math.ceil(Math.log2((156543.03 * Math.cos((ORIGIN.lat * Math.PI) / 180)) / mPerPx));
    const z = Math.max(BASE_Z, Math.min(MAX_Z, want));
    this.cover(this.bounds, BASE_Z);
    if (z > BASE_Z) this.cover(view, z);
  }

  private level(z: number) {
    let g = this.levels.get(z);
    if (!g) {
      g = document.createElementNS(NS, "g") as SVGGElement;
      // keep finer levels on top of coarser ones
      const after = [...this.levels.keys()].filter((k) => k > z).sort((a, b) => a - b)[0];
      this.g.insertBefore(g, after != null ? this.levels.get(after)! : null);
      this.levels.set(z, g);
    }
    return g;
  }

  private cover([x0, y0, x1, y1]: [number, number, number, number], z: number) {
    const [bx0, by0, bx1, by1] = this.bounds;
    x0 = Math.max(x0, bx0); y0 = Math.max(y0, by0); x1 = Math.min(x1, bx1); y1 = Math.min(y1, by1);
    if (x1 <= x0 || y1 <= y0) return;
    const tx0 = tileX(lonOf(x0), z), tx1 = tileX(lonOf(x1), z);
    const ty0 = tileY(latOf(y0), z), ty1 = tileY(latOf(y1), z);
    const g = this.level(z);
    for (let tx = tx0; tx <= tx1; tx++)
      for (let ty = ty0; ty <= ty1; ty++) {
        const key = `${z}/${tx}/${ty}`;
        if (this.have.has(key)) continue;
        this.have.add(key);
        const left = xOf(tileLon(tx, z)), right = xOf(tileLon(tx + 1, z));
        const top = yOf(tileLat(ty, z)), bottom = yOf(tileLat(ty + 1, z));
        const im = document.createElementNS(NS, "image");
        // a hair of overlap hides seams between neighbouring tiles
        const pad = (right - left) * 0.004;
        im.setAttribute("x", (left - pad).toFixed(2));
        im.setAttribute("y", (top - pad).toFixed(2));
        im.setAttribute("width", (right - left + 2 * pad).toFixed(2));
        im.setAttribute("height", (bottom - top + 2 * pad).toFixed(2));
        im.setAttribute("preserveAspectRatio", "none");
        im.setAttribute("href", TILE_URL(z, tx, ty));
        g.append(im);
      }
  }
}
