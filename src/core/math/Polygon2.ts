import { fromPoints } from "../CAGFactories";
import { CAG } from "../CAG";

/*
2D polygons are now supported through the CAG class.
With many improvements (see documentation):
  - shapes do no longer have to be convex
  - union/intersect/subtract is supported
  - expand / contract are supported

But we'll keep CSG.Polygon2D as a stub for backwards compatibility
*/
export class Polygon2D extends CAG
{
  constructor(points: any[])
  {
    super();
    const cag = fromPoints(points)
    this.sides = cag.sides
  }
}
