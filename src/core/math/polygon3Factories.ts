import { Vector3D } from "./Vector3";
import { Polygon } from "./Polygon3";
import { Vertex3D } from "./Vertex3";

// FIXME : redundant code with Polygon3.createFromPoints , but unuseable due to circular dependencies
/** Create a polygon from the given points.
 *
 * @param {Array[]} points - list of points
 * @param {Polygon.Shared} [shared=defaultShared] - shared property to apply
 * @param {Plane} [plane] - plane of the polygon
 *
 * @example
 * const points = [
 *   [0,  0, 0],
 *   [0, 10, 0],
 *   [0, 10, 10]
 * ]
 * let polygon = CSG.Polygon.createFromPoints(points)
 */
export function fromPoints(points, shared?, plane?)
{
  let vertices = []
  points.map(p =>
  {
    let vertex = new Vertex3D(Vector3D.Create(p))
    vertices.push(vertex)
  })

  let polygon: Polygon;
  if (arguments.length < 3)
  {
    polygon = new Polygon(vertices, shared)
  } else
  {
    polygon = new Polygon(vertices, shared, plane)
  }
  return polygon
}
