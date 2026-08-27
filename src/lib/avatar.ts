import { Style, Avatar } from "@dicebear/core";
import lineFaceDefinition from "@dicebear/styles/line-face.json";

// Local, dependency-based DiceBear "Line Face" avatars (no network / no
// third-party HTTP call). Deterministic per seed, so the same nickname always
// maps to the same face.

// Build the Style once at module load, then reuse for every avatar.
const lineFace = new Style(lineFaceDefinition);

// Memoize by seed so repeated renders (e.g. streaming token updates) don't
// re-run SVG generation.
const cache = new Map<string, string>();

/**
 * Return an SVG data URI for a Line Face avatar seeded from the given name.
 * Falls back to "guest" when no name is provided.
 */
export function avatarUrl(seed: string | null | undefined): string {
    const s = (seed || "guest").trim() || "guest";
    const cached = cache.get(s);
    if (cached) return cached;

    const uri = new Avatar(lineFace, { seed: s }).toDataUri();
    cache.set(s, uri);
    return uri;
}
