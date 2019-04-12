import
{
    parseOptionAs2DVector,
    parseOptionAsFloat,
    parseOptionAsInt
} from "./optionParsers";
import { defaultResolution2D } from "../core/constants";
import { Vector2D } from "../core/math/Vector2";
import { fromPoints, fromPath2, fromSides } from "../core/CAGFactories";
import { Path2 } from "../core/math/Path2";
import { Vertex2D } from "../core/math/Vertex2";
import { Side } from "../core/math/Side";

/** Construct an ellispe.
 * @param {Object} [options] - options for construction
 * @param {Vector2D} [options.center=[0,0]] - center of ellipse
 * @param {Vector2D} [options.radius=[1,1]] - radius of ellipse, width and height
 * @param {Number} [options.resolution=defaultResolution2D] - number of sides per 360 rotation
 * @returns {CAG} new CAG object
 */
export function ellipse(options)
{
    options = options || {};
    let c = parseOptionAs2DVector(options, "center", [0, 0]);
    let r = parseOptionAs2DVector(options, "radius", [1, 1]);
    r = r.abs(); // negative radii make no sense
    let res = parseOptionAsInt(options, "resolution", defaultResolution2D);

    let e2 = new Path2([[c.x, c.y + r.y]]);
    e2 = e2.appendArc([c.x, c.y - r.y], {
        xradius: r.x,
        yradius: r.y,
        xaxisrotation: 0,
        resolution: res,
        clockwise: true,
        large: false
    });
    e2 = e2.appendArc([c.x, c.y + r.y], {
        xradius: r.x,
        yradius: r.y,
        xaxisrotation: 0,
        resolution: res,
        clockwise: true,
        large: false
    });
    e2 = e2.close();
    return fromPath2(e2);
}

/** Construct a rectangle.
 * @param {Object} [options] - options for construction
 * @param {Vector2D} [options.center=[0,0]] - center of rectangle
 * @param {Vector2D} [options.radius=[1,1]] - radius of rectangle, width and height
 * @param {Vector2D} [options.corner1=[0,0]] - bottom left corner of rectangle (alternate)
 * @param {Vector2D} [options.corner2=[0,0]] - upper right corner of rectangle (alternate)
 * @returns {CAG} new CAG object
 */
export function rectangle(options)
{
    options = options || {};
    let c, r;
    if ("corner1" in options || "corner2" in options)
    {
        if ("center" in options || "radius" in options)
        {
            throw new Error(
                "rectangle: should either give a radius and center parameter, or a corner1 and corner2 parameter"
            );
        }
        let corner1 = parseOptionAs2DVector(options, "corner1", [0, 0]);
        let corner2 = parseOptionAs2DVector(options, "corner2", [1, 1]);
        c = corner1.plus(corner2).times(0.5);
        r = corner2.minus(corner1).times(0.5);
    } else
    {
        c = parseOptionAs2DVector(options, "center", [0, 0]);
        r = parseOptionAs2DVector(options, "radius", [1, 1]);
    }
    r = r.abs(); // negative radii make no sense
    let rswap = new Vector2D(r.x, -r.y);
    let points = [c.plus(r), c.plus(rswap), c.minus(r), c.minus(rswap)];
    return fromPoints(points);
}

/** Construct a rounded rectangle.
 * @param {Object} [options] - options for construction
 * @param {Vector2D} [options.center=[0,0]] - center of rounded rectangle
 * @param {Vector2D} [options.radius=[1,1]] - radius of rounded rectangle, width and height
 * @param {Vector2D} [options.corner1=[0,0]] - bottom left corner of rounded rectangle (alternate)
 * @param {Vector2D} [options.corner2=[0,0]] - upper right corner of rounded rectangle (alternate)
 * @param {Number} [options.roundradius=0.2] - round radius of corners
 * @param {Number} [options.resolution=defaultResolution2D] - number of sides per 360 rotation
 * @returns {CAG} new CAG object
 *
 * @example
 * let r = roundedRectangle({
 *   center: [0, 0],
 *   radius: [5, 10],
 *   roundradius: 2,
 *   resolution: 36,
 * });
 */
export function roundedRectangle(options)
{
    options = options || {};
    let center, radius;
    if ("corner1" in options || "corner2" in options)
    {
        if ("center" in options || "radius" in options)
        {
            throw new Error(
                "roundedRectangle: should either give a radius and center parameter, or a corner1 and corner2 parameter"
            );
        }
        let corner1 = parseOptionAs2DVector(options, "corner1", [0, 0]);
        let corner2 = parseOptionAs2DVector(options, "corner2", [1, 1]);
        center = corner1.plus(corner2).times(0.5);
        radius = corner2.minus(corner1).times(0.5);
    } else
    {
        center = parseOptionAs2DVector(options, "center", [0, 0]);
        radius = parseOptionAs2DVector(options, "radius", [1, 1]);
    }
    radius = radius.abs(); // negative radii make no sense
    let roundradius = parseOptionAsFloat(options, "roundradius", 0.2);
    let resolution = parseOptionAsInt(
        options,
        "resolution",
        defaultResolution2D
    );
    let maxroundradius = Math.min(radius.x, radius.y);
    maxroundradius -= 0.1;
    roundradius = Math.min(roundradius, maxroundradius);
    roundradius = Math.max(0, roundradius);
    radius = new Vector2D(radius.x - roundradius, radius.y - roundradius);
    let rect = rectangle({
        center: center,
        radius: radius
    });
    if (roundradius > 0)
    {
        rect = rect.expand(roundradius, resolution);
    }
    return rect;
}

/** Reconstruct a CAG from the output of toCompactBinary().
 * @param {CompactBinary} bin - see toCompactBinary()
 * @returns {CAG} new CAG object
 */
export function fromCompactBinary(bin)
{
    if (bin["class"] !== "CAG") throw new Error("Not a CAG");
    let vertices = [];
    let vertexData = bin.vertexData;
    let numvertices = vertexData.length / 2;
    let arrayindex = 0;
    for (let vertexindex = 0; vertexindex < numvertices; vertexindex++)
    {
        let x = vertexData[arrayindex++];
        let y = vertexData[arrayindex++];
        let pos = new Vector2D(x, y);
        let vertex = new Vertex2D(pos);
        vertices.push(vertex);
    }

    let sides = [];
    let numsides = bin.sideVertexIndices.length / 2;
    arrayindex = 0;
    for (let sideindex = 0; sideindex < numsides; sideindex++)
    {
        let vertexindex0 = bin.sideVertexIndices[arrayindex++];
        let vertexindex1 = bin.sideVertexIndices[arrayindex++];
        let side = new Side(vertices[vertexindex0], vertices[vertexindex1]);
        sides.push(side);
    }
    let cag = fromSides(sides);
    cag.isCanonicalized = true;
    return cag;
}
