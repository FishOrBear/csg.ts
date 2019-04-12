import { Vector3D } from "../math/Vector3";
import { CSG } from "../CSG";

/**
 * Returns an array of Vector3D, providing minimum coordinates and maximum coordinates
 * of this solid.
 * @returns {Vector3D[]}
 * @example
 * let bounds = A.getBounds()
 * let minX = bounds[0].x
 */
export const bounds = csg =>
{
  if (!csg.cachedBoundingBox)
  {
    let minpoint = new Vector3D(0, 0, 0);
    let maxpoint = new Vector3D(0, 0, 0);
    let polygons = csg.polygons;
    let numpolygons = polygons.length;
    for (let i = 0; i < numpolygons; i++)
    {
      let polygon = polygons[i];
      let bounds = polygon.boundingBox();
      if (i === 0)
      {
        minpoint = bounds[0];
        maxpoint = bounds[1];
      } else
      {
        minpoint = minpoint.min(bounds[0]);
        maxpoint = maxpoint.max(bounds[1]);
      }
    }
    // FIXME: not ideal, we are mutating the input, we need to move some of it out
    csg.cachedBoundingBox = [minpoint, maxpoint];
  }
  return csg.cachedBoundingBox;
};

export const volume = csg =>
{
  let result = csg.toTriangles().map(triPoly =>
  {
    return triPoly.getTetraFeatures(["volume"]);
  });
  return result;
};

export function area(csg: CSG)
{
  return csg.toTriangles().map(triPoly => triPoly.getArea());
}
