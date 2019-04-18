import { FuzzyCSGFactory } from "../FuzzyFactory3d";
import { reTesselateCoplanarPolygons } from "../math/reTesselateCoplanarPolygons";
import { fromPolygons } from "../CSGFactories";
import { CSG } from "../CSG";
import { Polygon } from "../math/Polygon3";

export function reTesselate(csg: CSG): CSG
{
    if (csg.isRetesselated) return csg;

    let polygonsPerPlane: { [key: number]: Polygon[] } = {};
    let isCanonicalized = csg.isCanonicalized;
    let fuzzyfactory = new FuzzyCSGFactory();

    for (let polygon of csg.polygons)
    {
        let plane = polygon.plane;
        let shared = polygon.shared;
        if (!isCanonicalized)
        {
            // in order to identify polygons having the same plane, we need to canonicalize the planes
            // We don't have to do a full canonizalization (including vertices), to save time only do the planes and the shared data:
            plane = fuzzyfactory.getPlane(plane);
            shared = fuzzyfactory.getPolygonShared(shared);
        }
        let tag = plane.getTag() + "/" + shared.getTag();
        if (!(tag in polygonsPerPlane)) polygonsPerPlane[tag] = [polygon];
        else polygonsPerPlane[tag].push(polygon);
    }

    let destpolygons: Polygon[] = [];
    for (let planetag in polygonsPerPlane)
    {
        let sourcepolygons = polygonsPerPlane[planetag];
        if (sourcepolygons.length < 2)
            destpolygons.push(...sourcepolygons);
        else
            reTesselateCoplanarPolygons(sourcepolygons, destpolygons);
    }
    let resultCSG = fromPolygons(destpolygons);
    resultCSG.isRetesselated = true;
    // result = result.canonicalized();
    resultCSG.properties = csg.properties; // keep original properties
    return resultCSG;
};
