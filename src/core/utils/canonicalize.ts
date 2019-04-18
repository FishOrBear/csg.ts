import { FuzzyCSGFactory } from "../FuzzyFactory3d";
import { FuzzyCAGFactory } from "../FuzzyFactory2d";
import { CSG } from "../CSG";
import { CAG } from "../CAG";
import { fromPolygons } from "../CSGFactories";
import { EPS } from "../constants";
import { fromSides } from "../CAGFactories";
import { Polygon } from "../math/Polygon3";

/**
 * Returns a cannoicalized version of the input csg : ie every very close
 * points get deduplicated
 * 
 * 返回删除重复点的csg,重复点将被合并
 */
export function canonicalizeCSG(csg: CSG): CSG
{
    const factory = new FuzzyCSGFactory();
    let result = CSGFromCSGFuzzyFactory(factory, csg);
    result.isCanonicalized = true;
    result.isRetesselated = csg.isRetesselated;
    result.properties = csg.properties; // keep original properties
    return result;
}

export function canonicalizeCAG(cag: CAG)
{
    let factory = new FuzzyCAGFactory();
    let result = CAGFromCAGFuzzyFactory(factory, cag);
    result.isCanonicalized = true;
    return result;
}

export function CSGFromCSGFuzzyFactory(factory: FuzzyCSGFactory, sourcecsg: CSG)
{
    let newpolygons: Polygon[] = sourcecsg.polygons.filter(poly =>
    {
        return factory.getPolygon(poly).vertices.length >= 3;
    });
    return fromPolygons(newpolygons);
}

function CAGFromCAGFuzzyFactory(factory: FuzzyCAGFactory, sourcecag: CAG)
{
    let newsides = sourcecag.sides
        .map(side => factory.getSide(side))
        // remove bad sides (mostly a user input issue)
        .filter((side) => side.length() > EPS);
    return fromSides(newsides);
};
