import { CAG } from "../core/CAG";
import { fromPoints } from "../core/CAGFactories";
import { Connector } from "../core/connectors";
import { defaultResolution3D, EPS } from "../core/constants";
import { fromPolygons } from "../core/CSGFactories";
import { Matrix4x4 } from "../core/math/Matrix4";
import { OrthoNormalBasis } from "../core/math/OrthoNormalBasis";
import { Path2 } from "../core/math/Path2";
import { Polygon } from "../core/math/Polygon3";
import { Vector3D } from "../core/math/Vector3";
import { cagToPointsArray, clamp, polygonFromPoints, rightMultiply1x3VectorToArray } from "./helpers";
import { parseOptionAsBool, parseOptionAsFloat, parseOptionAsInt } from "./optionParsers";

/** extrude the CAG in a certain plane.
 * Giving just a plane is not enough, multiple different extrusions in the same plane would be possible
 * by rotating around the plane's origin. An additional right-hand vector should be specified as well,
 * and this is exactly a OrthoNormalBasis.
 * @param  {CAG} cag the cag to extrude
 * @param  {Orthonormalbasis} orthonormalbasis characterizes the plane in which to extrude
 * @param  {Float} depth thickness of the extruded shape. Extrusion is done upwards from the plane
 *  (unless symmetrical option is set, see below)
 * @param  {Object} [options] - options for construction
 * @param {Boolean} [options.symmetrical=true] - extrude symmetrically in two directions about the plane
 */
export function extrudeInOrthonormalBasis(
    cag: CAG,
    orthonormalbasis: OrthoNormalBasis,
    depth: number,
    options: any
)
{
    // first extrude in the regular Z plane:
    if (!(orthonormalbasis instanceof OrthoNormalBasis))
        throw new Error(
            "extrudeInPlane: the first parameter should be a OrthoNormalBasis"
        );
    let extruded = cag.extrude({ offset: new Vector3D(0, 0, depth) });
    if (parseOptionAsBool(options, "symmetrical", false))
        extruded = extruded.translate([0, 0, -depth / 2]);
    let matrix = orthonormalbasis.getInverseProjectionMatrix();
    extruded = extruded.transform(matrix);
    return extruded;
};

/** Extrude in a standard cartesian plane, specified by two axis identifiers. Each identifier can be
 * one of ["X","Y","Z","-X","-Y","-Z"]
 * The 2d x axis will map to the first given 3D axis, the 2d y axis will map to the second.
 * See OrthoNormalBasis.GetCartesian for details.
 * @param  {CAG} cag the cag to extrude
 * @param  {String} axis1 the first axis
 * @param  {String} axis2 the second axis
 * @param  {Float} depth thickness of the extruded shape. Extrusion is done upwards from the plane
 * @param  {Object} [options] - options for construction
 * @param {Boolean} [options.symmetrical=true] - extrude symmetrically in two directions about the plane
 */
export const extrudeInPlane = function (cag: CAG, axis1: string, axis2: string, depth: number, options: any)
{
    return extrudeInOrthonormalBasis(
        cag,
        OrthoNormalBasis.GetCartesian(axis1, axis2),
        depth,
        options
    );
};

// THIS IS AN OLD untested !!! version of rotate extrude
/** Extrude to into a 3D solid by rotating the origin around the Y axis.
 * (and turning everything into XY plane)
 * @param {Object} options - options for construction
 * @param {Number} [options.angle=360] - angle of rotation
 * @param {Number} [options.resolution=defaultResolution3D] - number of polygons per 360 degree revolution
 * @returns {CSG} new 3D solid
 */
export const rotateExtrude = function (cag: CAG, options)
{
    // FIXME options should be optional
    let alpha = parseOptionAsFloat(options, "angle", 360);
    let resolution = parseOptionAsInt(
        options,
        "resolution",
        defaultResolution3D
    );

    alpha = alpha > 360 ? alpha % 360 : alpha;
    let origin = [0, 0, 0];
    let axisV = new Vector3D(0, 1, 0);
    let normalV = [0, 0, 1];
    let polygons: Polygon[] = [];
    // planes only needed if alpha > 0
    let connS = new Connector(origin, axisV, normalV);
    if (alpha > 0 && alpha < 360)
    {
        // we need to rotate negative to satisfy wall function condition of
        // building in the direction of axis vector
        let connE = new Connector(origin, axisV.rotateZ(-alpha), normalV);
        polygons = polygons.concat(
            cag._toPlanePolygons({ toConnector: connS, flipped: true })
        );
        polygons = polygons.concat(
            cag._toPlanePolygons({ toConnector: connE })
        );
    }
    let connT1 = connS;
    let connT2: Connector;
    let step = alpha / resolution;
    for (let a = step; a <= alpha + EPS; a += step)
    {
        // FIXME Should this be angelEPS?
        connT2 = new Connector(origin, axisV.rotateZ(-a), normalV);
        polygons = polygons.concat(
            cag._toWallPolygons({ toConnector1: connT1, toConnector2: connT2 })
        );
        connT1 = connT2;
    }
    return fromPolygons(polygons).reTesselated();
};

// FIXME: right now linear & rotate extrude take params first, while rectangular_extrude
// takes params second ! confusing and incoherent ! needs to be changed (BREAKING CHANGE !)

/** linear extrusion of the input 2d shape
 * @param {Object} [options] - options for construction
 * @param {Float} [options.height=1] - height of the extruded shape
 * @param {Integer} [options.slices=10] - number of intermediary steps/slices
 * @param {Integer} [options.twist=0] - angle (in degrees to twist the extusion by)
 * @param {Boolean} [options.center=false] - whether to center extrusion or not
 * @param {CAG} baseShape input 2d shape
 * @returns {CSG} new extruded shape
 *
 * @example
 * let revolved = linear_extrude({height: 10}, square())
 */
export function linear_extrude(params, baseShape)
{
    const defaults = {
        height: 1,
        slices: 10,
        twist: 0,
        center: false
    };
    /* convexity = 10, */
    const { height, twist, slices, center } = Object.assign(
        {},
        defaults,
        params
    );

    // if(params.convexity) convexity = params.convexity      // abandoned
    let output = baseShape.extrude({
        offset: [0, 0, height],
        twistangle: twist,
        twiststeps: slices
    });
    if (center === true)
    {
        const b = output.getBounds(); // b[0] = min, b[1] = max
        const offset = b[1].plus(b[0]).times(-0.5);
        output = output.translate(offset);
    }
    return output;
}

/** rotate extrusion / revolve of the given 2d shape
 * @param {Object} [options] - options for construction
 * @param {Integer} [options.fn=1] - resolution/number of segments of the extrusion
 * @param {Float} [options.startAngle=1] - start angle of the extrusion, in degrees
 * @param {Float} [options.angle=1] - angle of the extrusion, in degrees
 * @param {Float} [options.overflow='cap'] - what to do with points outside of bounds (+ / - x) :
 * defaults to capping those points to 0 (only supported behaviour for now)
 * @param {CAG} baseShape input 2d shape
 * @returns {CSG} new extruded shape
 *
 * @example
 * let revolved = rotate_extrude({fn: 10}, square())
 */
export function rotate_extrude(params, baseShape)
{
    // note, we should perhaps alias this to revolve() as well
    const defaults = {
        fn: 32,
        startAngle: 0,
        angle: 360,
        overflow: "cap"
    };
    params = Object.assign({}, defaults, params);
    let { fn, startAngle, angle, overflow } = params;
    if (overflow !== "cap")
    {
        throw new Error("only capping of overflowing points is supported !");
    }

    if (arguments.length < 2)
    {
        // FIXME: what the hell ??? just put params second !
        baseShape = params;
    }
    // are we dealing with a positive or negative angle (for normals flipping)
    const flipped = angle > 0;
    // limit actual angle between 0 & 360, regardless of direction
    const totalAngle = flipped
        ? clamp(startAngle + angle, 0, 360)
        : clamp(startAngle + angle, -360, 0);
    // adapt to the totalAngle : 1 extra segment per 45 degs if not 360 deg extrusion
    // needs to be at least one and higher then the input resolution
    const segments = Math.max(Math.floor(Math.abs(totalAngle) / 45), 1, fn);
    // maximum distance per axis between two points before considering them to be the same
    const overlapTolerance = 0.00001;
    // convert baseshape to just an array of points, easier to deal with
    let shapePoints = cagToPointsArray(baseShape);

    // determine if the rotate_extrude can be computed in the first place
    // ie all the points have to be either x > 0 or x < 0

    // generic solution to always have a valid solid, even if points go beyond x/ -x
    // 1. split points up between all those on the 'left' side of the axis (x<0) & those on the 'righ' (x>0)
    // 2. for each set of points do the extrusion operation IN OPOSITE DIRECTIONS
    // 3. union the two resulting solids

    // 1. alt : OR : just cap of points at the axis ?

    // console.log('shapePoints BEFORE', shapePoints, baseShape.sides)

    const pointsWithNegativeX = shapePoints.filter(x => x[0] < 0);
    const pointsWithPositiveX = shapePoints.filter(x => x[0] >= 0);
    const arePointsWithNegAndPosX =
        pointsWithNegativeX.length > 0 && pointsWithPositiveX.length > 0;

    if (arePointsWithNegAndPosX && overflow === "cap")
    {
        if (pointsWithNegativeX.length > pointsWithPositiveX.length)
        {
            shapePoints = shapePoints.map(function (point)
            {
                return [Math.min(point[0], 0), point[1]];
            });
        } else if (pointsWithPositiveX.length >= pointsWithNegativeX.length)
        {
            shapePoints = shapePoints.map(function (point)
            {
                return [Math.max(point[0], 0), point[1]];
            });
        }
    }

    // console.log('negXs', pointsWithNegativeX, 'pointsWithPositiveX', pointsWithPositiveX, 'arePointsWithNegAndPosX', arePointsWithNegAndPosX)
    //  console.log('shapePoints AFTER', shapePoints, baseShape.sides)

    let polygons = [];

    // for each of the intermediary steps in the extrusion
    for (let i = 1; i < segments + 1; i++)
    {
        // for each side of the 2d shape
        for (let j = 0; j < shapePoints.length - 1; j++)
        {
            // 2 points of a side
            const curPoint = shapePoints[j];
            const nextPoint = shapePoints[j + 1];

            // compute matrix for current and next segment angle
            let prevMatrix = Matrix4x4.rotationZ(
                ((i - 1) / segments) * angle + startAngle
            );
            let curMatrix = Matrix4x4.rotationZ(
                (i / segments) * angle + startAngle
            );

            const pointA = rightMultiply1x3VectorToArray(prevMatrix, [
                curPoint[0],
                0,
                curPoint[1]
            ]);
            const pointAP = rightMultiply1x3VectorToArray(curMatrix, [
                curPoint[0],
                0,
                curPoint[1]
            ]);
            const pointB = rightMultiply1x3VectorToArray(prevMatrix, [
                nextPoint[0],
                0,
                nextPoint[1]
            ]);
            const pointBP = rightMultiply1x3VectorToArray(curMatrix, [
                nextPoint[0],
                0,
                nextPoint[1]
            ]);

            // console.log(`point ${j} edge connecting ${j} to ${j + 1}`)
            let overlappingPoints = false;
            if (
                Math.abs(pointA[0] - pointAP[0]) < overlapTolerance &&
                Math.abs(pointB[1] - pointBP[1]) < overlapTolerance
            )
                // console.log('identical / overlapping points (from current angle and next one), what now ?')
                overlappingPoints = true;

            // we do not generate a single quad because:
            // 1. it does not allow eliminating unneeded triangles in case of overlapping points
            // 2. the current cleanup routines of csg.js create degenerate shapes from those quads
            // let polyPoints = [pointA, pointB, pointBP, pointAP]
            // polygons.push(polygonFromPoints(polyPoints))

            if (flipped)
            {
                // CW
                polygons.push(polygonFromPoints([pointA, pointB, pointBP]));
                if (!overlappingPoints)
                {
                    polygons.push(
                        polygonFromPoints([pointBP, pointAP, pointA])
                    );
                }
            } else
            {
                // CCW
                if (!overlappingPoints)
                {
                    polygons.push(
                        polygonFromPoints([pointA, pointAP, pointBP])
                    );
                }
                polygons.push(polygonFromPoints([pointBP, pointB, pointA]));
            }
        }
        // if we do not do a full extrusion, we want caps at both ends (closed volume)
        if (Math.abs(angle) < 360)
        {
            // we need to recreate the side with capped points where applicable
            const sideShape = fromPoints(shapePoints);
            const endMatrix = Matrix4x4.rotationX(90).multiply(
                Matrix4x4.rotationZ(-startAngle)
            );
            const endCap = sideShape
                ._toPlanePolygons({ flipped: flipped })
                .map(x => x.transform(endMatrix));

            const startMatrix = Matrix4x4.rotationX(90).multiply(
                Matrix4x4.rotationZ(-angle - startAngle)
            );
            const startCap = sideShape
                ._toPlanePolygons({ flipped: !flipped })
                .map(x => x.transform(startMatrix));
            polygons = polygons.concat(endCap).concat(startCap);
        }
    }
    return fromPolygons(polygons)
        .reTesselated()
        .canonicalized();
}

/** rectangular extrusion of the given array of points
 * @param {Array} basePoints array of points (nested) to extrude from
 * layed out like [ [0,0], [10,0], [5,10], [0,10] ]
 * @param {Object} [options] - options for construction
 * @param {Float} [options.h=1] - height of the extruded shape
 * @param {Float} [options.w=10] - width of the extruded shape
 * @param {Integer} [options.fn=1] - resolution/number of segments of the extrusion
 * @param {Boolean} [options.closed=false] - whether to close the input path for the extrusion or not
 * @param {Boolean} [options.round=true] - whether to round the extrusion or not
 * @returns {CSG} new extruded shape
 *
 * @example
 * let revolved = rectangular_extrude({height: 10}, square())
 */
export function rectangular_extrude(basePoints, params)
{
    const defaults = {
        w: 1,
        h: 1,
        fn: 8,
        closed: false,
        round: true
    };
    const { w, h, fn, closed, round } = Object.assign({}, defaults, params);
    return new Path2(basePoints, closed).rectangularExtrude(w, h, fn, round);
}
