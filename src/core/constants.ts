export const _CSGDEBUG = false;

/** Number of polygons per 360 degree revolution for 2D objects.
 * @default
 */
export const defaultResolution2D = 32; // FIXME this seems excessive
/** Number of polygons per 360 degree revolution for 3D objects.
 * @default
 */
export const defaultResolution3D = 12;

/** Epsilon used during determination of near zero distances.
 * @default
 */
export const EPS = 1e-5;

/** Epsilon used during determination of near zero areas.
 * @default
 */
export const angleEPS = 0.1;

/** Epsilon used during determination of near zero areas.
 *  This is the minimal area of a minimal polygon.
 * @default
 */
export const areaEPS = 0.5 * EPS * EPS * Math.sin(angleEPS);

export const all = 0;
export const top = 1;
export const bottom = 2;
export const left = 3;
export const right = 4;
export const front = 5;
export const back = 6;
// Tag factory: we can request a unique tag through CSG.getTag()
export let staticTag = 1;
export const getTag = () => staticTag++;
