/** clone the given object
 * @param {Object} obj - the object to clone by
 * @returns {CSG} new CSG object , a copy of the input
 *
 * @example
 * let copy = clone(sphere())
 */
export function clone(obj)
{
    if (obj === null || typeof obj !== "object") return obj;
    const copy = obj.constructor();
    for (const attr in obj)
    {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}
