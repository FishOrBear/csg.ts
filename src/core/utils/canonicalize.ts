import { FuzzyCSGFactory } from "../FuzzyFactory3d";
import { FuzzyCAGFactory } from "../FuzzyFactory2d";
import { CSG } from "../CSG";
import { CAG } from "../CAG";
import { fromPolygons } from "../CSGFactories";
import { EPS } from "../constants";
import { fromSides } from "../CAGFactories";

/**
   * Returns a cannoicalized version of the input csg : ie every very close
   * points get deduplicated
   * @returns {CSG}
   * @example
   * let rawCSG = someCSGMakingFunction()
   * let canonicalizedCSG = canonicalize(rawCSG)
   */
export const canonicalizeCSG = function (csg: CSG)
{
  const factory = new FuzzyCSGFactory()
  let result = CSGFromCSGFuzzyFactory(factory, csg)
  result.isCanonicalized = true
  result.isRetesselated = csg.isRetesselated
  result.properties = csg.properties // keep original properties
  return result
}

export function canonicalizeCAG(cag: CAG)
{
  let factory = new FuzzyCAGFactory()
  let result = CAGFromCAGFuzzyFactory(factory, cag)
  result.isCanonicalized = true
  return result
}

export function CSGFromCSGFuzzyFactory(factory, sourcecsg)
{
  let _this = factory
  let newpolygons = []
  sourcecsg.polygons.forEach(function (polygon)
  {
    let newpolygon = _this.getPolygon(polygon)
    // see getPolygon above: we may get a polygon with no vertices, discard it:
    if (newpolygon.vertices.length >= 3)
    {
      newpolygons.push(newpolygon)
    }
  })
  return fromPolygons(newpolygons);
}

const CAGFromCAGFuzzyFactory = function (factory: FuzzyCAGFactory, sourcecag: CAG)
{
  let newsides = sourcecag.sides
    .map(side => factory.getSide(side))
    // remove bad sides (mostly a user input issue)
    .filter(function (side)
    {
      return side.length() > EPS
    })
  return fromSides(newsides);
}
