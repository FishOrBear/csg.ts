import { CSG } from "./CSG";
import { Plane } from "./math/Plane";
import { Polygon, Shared } from "./math/Polygon3";
import { Vector3D } from "./math/Vector3";
import { Vertex3D } from "./math/Vertex3";

/** Construct a CSG solid from a list of `Polygon` instances.
 * @param {Polygon[]} polygons - list of polygons
 * @returns {CSG} new CSG object
 */
export function fromPolygons(polygons: Polygon[])
{
    let csg = new CSG();
    csg.polygons = polygons;
    csg.isCanonicalized = false;
    csg.isRetesselated = false;
    return csg;
}

/** Construct a CSG solid from a list of pre-generated slices.
 * See Polygon.prototype.solidFromSlices() for details.
 * @param {Object} options - options passed to solidFromSlices()
 * @returns {CSG} new CSG object
 */
export function fromSlices(options)
{
    return Polygon.createFromPoints([
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0]
    ]).solidFromSlices(options);
}

/** Reconstruct a CSG solid from an object with identical property names.
 * @param {Object} obj - anonymous object, typically from JSON
 * @returns {CSG} new CSG object
 */
export function fromObject(obj)
{
    let polygons = obj.polygons.map(p =>
    {
        return Polygon.fromObject(p);
    });
    let csg = fromPolygons(polygons);
    csg.isCanonicalized = obj.isCanonicalized;
    csg.isRetesselated = obj.isRetesselated;
    return csg;
}

/** Reconstruct a CSG from the output of toCompactBinary().
 * @param {CompactBinary} bin - see toCompactBinary().
 * @returns {CSG} new CSG object
 */
export function fromCompactBinary(bin)
{
    if (bin["class"] !== "CSG") throw new Error("Not a CSG");
    let planes = [];
    let planeData = bin.planeData;
    let numplanes = planeData.length / 4;
    let arrayindex = 0;
    let x;
    let y;
    let z;
    let w;
    let normal;
    let plane;
    for (let planeindex = 0; planeindex < numplanes; planeindex++)
    {
        x = planeData[arrayindex++];
        y = planeData[arrayindex++];
        z = planeData[arrayindex++];
        w = planeData[arrayindex++];
        normal = new Vector3D(x, y, z);
        plane = new Plane(normal, w);
        planes.push(plane);
    }

    let vertices = [];
    const vertexData = bin.vertexData;
    const numvertices = vertexData.length / 3;
    let pos;
    let vertex;
    arrayindex = 0;
    for (let vertexindex = 0; vertexindex < numvertices; vertexindex++)
    {
        x = vertexData[arrayindex++];
        y = vertexData[arrayindex++];
        z = vertexData[arrayindex++];
        pos = new Vector3D(x, y, z);
        vertex = new Vertex3D(pos);
        vertices.push(vertex);
    }

    let shareds = bin.shared.map(shared =>
    {
        return Shared.fromObject(shared);
    });

    let polygons = [];
    let numpolygons = bin.numPolygons;
    let numVerticesPerPolygon = bin.numVerticesPerPolygon;
    let polygonVertices = bin.polygonVertices;
    let polygonPlaneIndexes = bin.polygonPlaneIndexes;
    let polygonSharedIndexes = bin.polygonSharedIndexes;
    let numpolygonvertices;
    let polygonvertices;
    let shared;
    let polygon; // already defined plane,
    arrayindex = 0;
    for (let polygonindex = 0; polygonindex < numpolygons; polygonindex++)
    {
        numpolygonvertices = numVerticesPerPolygon[polygonindex];
        polygonvertices = [];
        for (let i = 0; i < numpolygonvertices; i++)
        {
            polygonvertices.push(vertices[polygonVertices[arrayindex++]]);
        }
        plane = planes[polygonPlaneIndexes[polygonindex]];
        shared = shareds[polygonSharedIndexes[polygonindex]];
        polygon = new Polygon(polygonvertices, shared, plane);
        polygons.push(polygon);
    }
    let csg = fromPolygons(polygons);
    csg.isCanonicalized = true;
    csg.isRetesselated = true;
    return csg;
}
