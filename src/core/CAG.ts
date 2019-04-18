import { cagoutlinePaths } from "../api/cagOutlinePaths";
import { center } from "../api/center";
import { overCutInsideCorners } from "../api/ops-cnc";
import { contract, expand, expandedShellOfCAG } from "../api/ops-expandContract";
import { extrudeInOrthonormalBasis, extrudeInPlane, rotateExtrude } from "../api/ops-extrusions";
import { parseOptionAs2DVector, parseOptionAsFloat, parseOptionAsInt } from "../api/optionParsers";
import { fromFakeCSG, fromPoints, fromSides } from "./CAGFactories";
import { Connector } from "./connectors";
import { defaultResolution2D, defaultResolution3D } from "./constants";
import { CSG } from "./CSG";
import { fromPolygons } from "./CSGFactories";
import { CanTransformation } from "./ITrans";
import { Matrix4x4 } from "./math/Matrix4";
import { OrthoNormalBasis } from "./math/OrthoNormalBasis";
import { Polygon } from "./math/Polygon3";
import { Side } from "./math/Side";
import { Vector2D } from "./math/Vector2";
import { Vector3D } from "./math/Vector3";
import { Vertex3D } from "./math/Vertex3";
import { hasPointInside, isCAGValid, isSelfIntersecting } from "./utils/cagValidation";
import { canonicalizeCAG } from "./utils/canonicalize";

/**
 * Class CAG
 * Holds a solid area geometry like CSG but 2D.
 * Each area consists of a number of sides.
 * Each side is a line between 2 points.
 * @constructor
 */
export class CAG extends CanTransformation
{
    sides: Side[] = [];
    isCanonicalized: boolean = false;
    constructor()
    {
        super();
    }

    union(cag: CAG[] | CAG)
    {
        let cags: any[];
        if (cag instanceof Array)
        {
            cags = cag;
        } else
        {
            cags = [cag];
        }
        let r = this._toCSGWall(-1, 1);
        r = r.union(
            cags.map((cag: CAG) =>
            {
                return cag._toCSGWall(-1, 1).reTesselated();
            })
        );
        return fromFakeCSG(r).canonicalized();
    }

    subtract(cag: CAG)
    {
        let cags: CAG[];
        if (cag instanceof Array)
            cags = cag;
        else
            cags = [cag];
        let r = this._toCSGWall(-1, 1);
        cags.map(cag => r.subtractSub(cag._toCSGWall(-1, 1), false, false));
        r = r.reTesselated();
        r = r.canonicalized();
        let rCAG = fromFakeCSG(r);
        rCAG = rCAG.canonicalized() as CAG;
        return rCAG;
    }

    intersect(cag: CAG)
    {
        let cags: CAG[];
        if (cag instanceof Array)
            cags = cag;
        else
            cags = [cag];
        let r = this._toCSGWall(-1, 1);
        cags.map(cag =>
        {
            r = r.intersectSub(cag._toCSGWall(-1, 1), false, false);
        });
        r = r.reTesselated();
        r = r.canonicalized();

        return fromFakeCSG(r).canonicalized();
    }

    transform(matrix4x4: Matrix4x4): this
    {
        let ismirror = matrix4x4.isMirroring();
        let newsides = this.sides.map(side =>
        {
            return side.transform(matrix4x4);
        });
        let result = fromSides(newsides);
        if (ismirror)
        {
            result = result.flipped();
        }
        return result as this;
    }

    flipped()
    {
        let newsides = this.sides.map(side =>
        {
            return side.flipped();
        });
        newsides.reverse();
        return fromSides(newsides);
    }

    // ALIAS !
    center(axes: any)
    {
        return center({ axes }, [this]);
    }

    // ALIAS !
    expandedShell(radius: any, resolution: any)
    {
        return expandedShellOfCAG(this, radius, resolution);
    }

    // ALIAS !
    expand(radius: any, resolution: any)
    {
        return expand(this, radius, resolution);
    }

    contract(radius: any, resolution: any)
    {
        return contract(this, radius, resolution);
    }

    // see http://local.wasp.uwa.edu.au/~pbourke/geometry/polyarea/ :
    // Area of the polygon. For a counter clockwise rotating polygon the area is positive, otherwise negative
    // Note(bebbi): this looks wrong. See polygon getArea()
    get area()
    {
        let polygonArea = 0;
        this.sides.map(function (side)
        {
            polygonArea += side.vertex0.pos.cross(side.vertex1.pos);
        });
        polygonArea *= 0.5;
        return polygonArea;
    }

    // ALIAS !
    getBounds()
    {
        let minpoint: Vector2D;
        if (this.sides.length === 0)
        {
            minpoint = new Vector2D(0, 0);
        } else
        {
            minpoint = this.sides[0].vertex0.pos;
        }
        let maxpoint = minpoint;
        this.sides.map(side =>
        {
            minpoint = minpoint.min(side.vertex0.pos);
            minpoint = minpoint.min(side.vertex1.pos);
            maxpoint = maxpoint.max(side.vertex0.pos);
            maxpoint = maxpoint.max(side.vertex1.pos);
        });
        return [minpoint, maxpoint];
    }

    // ALIAS !
    isSelfIntersecting(debug: boolean)
    {
        return isSelfIntersecting(this, debug);
    }

    // extrusion: all aliases to simple functions
    extrudeInOrthonormalBasis(orthonormalbasis: OrthoNormalBasis, depth: number, options: any)
    {
        return extrudeInOrthonormalBasis(this, orthonormalbasis, depth, options);
    }

    // ALIAS !
    extrudeInPlane(axis1: string, axis2: string, depth: number, options: any)
    {
        return extrudeInPlane(this, axis1, axis2, depth, options);
    }

    extrude(
        { offsetVector, twistangle = 0, twiststeps = 1 }:
            { offsetVector: Vector3D; twistangle?: number; twiststeps?: number; }): CSG
    {
        let normalVector = new Vector3D(0, 1, 0);
        let polygons: Polygon[] = [
            // bottom and top
            ...this._toPlanePolygons({
                translation: new Vector3D(0, 0, 0),
                normalVector: normalVector,
                flipped: !(offsetVector.z < 0)
            }),
            ...this._toPlanePolygons({
                translation: offsetVector,
                normalVector: normalVector.rotateZ(twistangle),
                flipped: offsetVector.z < 0
            })
        ];
        // walls
        for (let i = 0; i < twiststeps; i++)
        {
            let c1 = new Connector(
                offsetVector.times(i / twiststeps),
                new Vector3D(0, 0, offsetVector.z),
                normalVector.rotateZ((i * twistangle) / twiststeps)
            );
            let c2 = new Connector(
                offsetVector.times((i + 1) / twiststeps),
                new Vector3D(0, 0, offsetVector.z),
                normalVector.rotateZ(((i + 1) * twistangle) / twiststeps)
            );
            polygons.push(...this._toWallPolygons({ toConnector1: c1, toConnector2: c2 }));
        }

        return fromPolygons(polygons);
    }

    // ALIAS !
    rotateExtrude(options: any)
    {
        // FIXME options should be optional
        return rotateExtrude(this, options);
    }

    // ALIAS !
    check()
    {
        return isCAGValid(this);
    }

    canonicalized(): CAG
    {
        if (this.isCanonicalized) return this;

        return canonicalizeCAG(this);
    }

    // ALIAS !
    getOutlinePaths()
    {
        return cagoutlinePaths(this);
    }

    // ALIAS !
    overCutInsideCorners(cutterradius: any)
    {
        return overCutInsideCorners(this, cutterradius);
    }

    // ALIAS !
    hasPointInside(point: any)
    {
        return hasPointInside(this, point);
    }

    // All the toXXX functions
    toString()
    {
        let result = "CAG (" + this.sides.length + " sides):\n";
        for (let s of this.sides) result += "  " + s.toString() + "\n";
        return result;
    }

    _toCSGWall(z0: number, z1: number)
    {
        let polygons = this.sides.map(side => side.toPolygon3D(z0, z1));
        return fromPolygons(polygons);
    }

    _toVector3DPairs(m: Matrix4x4)
    {
        // transform m
        let pairs = this.sides.map(side =>
        {
            let p0 = side.vertex0.pos;
            let p1 = side.vertex1.pos;
            return [new Vector3D(p0.x, p0.y, 0), new Vector3D(p1.x, p1.y, 0)];
        });
        if (typeof m !== "undefined")
            pairs = pairs.map(pair => pair.map(v => v.transform(m)));
        return pairs;
    }

    /*
     * transform a cag into the polygons of a corresponding 3d plane, positioned per options
     * Accepts a connector for plane positioning, or optionally
     * single translation, axisVector, normalVector arguments
     * (toConnector has precedence over single arguments if provided)
     */
    _toPlanePolygons(
        {
            toConnector,
            flipped = false,
            translation,
            normalVector,
            axisVector }
            :
            {
                toConnector?: Connector;
                flipped?: boolean;
                translation?: Vector3D;
                normalVector?: Vector3D;
                axisVector?: Vector3D;
            } = {}
    )
    {
        // reference connector for transformation
        let origin = new Vector3D(0, 0, 0);
        let defaultAxis = new Vector3D(0, 0, 1);
        let defaultNormal = new Vector3D(0, 1, 0);
        let thisConnector = new Connector(origin, defaultAxis, defaultNormal);

        translation = translation || origin;
        normalVector = normalVector || defaultNormal;
        axisVector = axisVector || defaultAxis;

        // will override above if options has toConnector
        toConnector = toConnector || new Connector(translation, axisVector, normalVector);
        // resulting transform
        let m = thisConnector.getTransformationTo(toConnector, false, 0);
        // create plane as a (partial non-closed) CSG in XY plane
        let bounds = this.getBounds();
        bounds[0] = bounds[0].minus(new Vector2D(1, 1));
        bounds[1] = bounds[1].plus(new Vector2D(1, 1));
        let csgshell = this._toCSGWall(-1, 1);
        let csgplane = fromPolygons([
            new Polygon([
                new Vertex3D(new Vector3D(bounds[0].x, bounds[0].y, 0)),
                new Vertex3D(new Vector3D(bounds[1].x, bounds[0].y, 0)),
                new Vertex3D(new Vector3D(bounds[1].x, bounds[1].y, 0)),
                new Vertex3D(new Vector3D(bounds[0].x, bounds[1].y, 0))
            ])
        ]);
        if (flipped)
            csgplane = csgplane.invert();
        // intersectSub -> prevent premature retesselate/canonicalize
        csgplane = csgplane.intersectSub(csgshell);
        // only keep the polygons in the z plane:
        let polys = csgplane.polygons.filter(polygon =>
        {
            return Math.abs(polygon.plane.normal.z) > 0.99;
        });
        // finally, position the plane per passed transformations
        return polys.map(poly =>
        {
            return poly.transform(m);
        });
    }

    /*
     * given 2 connectors, this returns all polygons of a "wall" between 2
     * copies of this cag, positioned in 3d space as "bottom" and
     * "top" plane per connectors toConnector1, and toConnector2, respectively
     */
    _toWallPolygons(options: {
        toConnector1: Connector;
        toConnector2: Connector;
        cag?: CAG;
        flipped?: boolean;
        translation?: number[];
        axisVector?: Vector3D;
        normalVector?: Vector3D;
    }): Polygon[]
    {
        // normals are going to be correct as long as toConn2.point - toConn1.point
        // points into cag normal direction (check in caller)
        // arguments: options.toConnector1, options.toConnector2, options.cag
        //     walls go from toConnector1 to toConnector2
        //     optionally, target cag to point to - cag needs to have same number of sides as this!
        let origin = new Vector3D(0, 0, 0);
        let defaultAxis = new Vector3D(0, 0, 1);
        let defaultNormal = new Vector3D(0, 1, 0);
        let thisConnector = new Connector(origin, defaultAxis, defaultNormal);
        // arguments:
        let toConnector1 = options.toConnector1;
        let toConnector2 = options.toConnector2;

        // target cag is same as this unless specified
        let toCag = options.cag || this;
        let m1 = thisConnector.getTransformationTo(toConnector1, false, 0);
        let m2 = thisConnector.getTransformationTo(toConnector2, false, 0);
        let vps1 = this._toVector3DPairs(m1);
        let vps2 = toCag._toVector3DPairs(m2);

        let polygons: Polygon[] = [];
        vps1.forEach((vp1, i) =>
        {
            polygons.push(
                new Polygon([
                    new Vertex3D(vps2[i][1]),
                    new Vertex3D(vps2[i][0]),
                    new Vertex3D(vp1[0])
                ])
            );
            polygons.push(
                new Polygon([
                    new Vertex3D(vps2[i][1]),
                    new Vertex3D(vp1[0]),
                    new Vertex3D(vp1[1])
                ])
            );
        });
        return polygons;
    }

    /**
     * Convert to a list of points.
     * @return list of points in 2D space
     */
    toPoints(): Vector2D[]
    {
        let points = this.sides.map(side => side.vertex0.pos);
        // due to the logic of fromPoints()
        // move the first point to the last
        if (points.length > 0)
            points.push(points.shift());
        return points;
    }

    /** Convert to compact binary form.
     * See fromCompactBinary.
     * @return {CompactBinary}
     */
    toCompactBinary()
    {
        let cag = this.canonicalized();
        let numsides = cag.sides.length;
        let vertexmap = {};
        let vertices = [];
        let numvertices = 0;
        let sideVertexIndices = new Uint32Array(2 * numsides);
        let sidevertexindicesindex = 0;
        cag.sides.map(side =>
        {
            [side.vertex0, side.vertex1].map(v =>
            {
                let vertextag = v.getTag();
                let vertexindex: number;
                if (!(vertextag in vertexmap))
                {
                    vertexindex = numvertices++;
                    vertexmap[vertextag] = vertexindex;
                    vertices.push(v);
                } else
                {
                    vertexindex = vertexmap[vertextag];
                }
                sideVertexIndices[sidevertexindicesindex++] = vertexindex;
            });
        });
        let vertexData = new Float64Array(numvertices * 2);
        let verticesArrayIndex = 0;
        vertices.map(v =>
        {
            let pos = v.pos;
            vertexData[verticesArrayIndex++] = pos._x;
            vertexData[verticesArrayIndex++] = pos._y;
        });
        let result = {
            class: "CAG",
            sideVertexIndices,
            vertexData
        };
        return result;
    }

    /** Construct a circle.
     * @param {Object} [options] - options for construction
     * @param {Vector2D} [options.center=[0,0]] - center of circle
     * @param {Number} [options.radius=1] - radius of circle
     * @param {Number} [options.resolution=defaultResolution2D] - number of sides per 360 rotation
     * @returns {CAG} new CAG object
     */
    static circle(options: { center?: any[]; radius?: any; resolution?: any; })
    {
        options = options || {};
        let center = parseOptionAs2DVector(options, "center", [0, 0]);
        let radius = parseOptionAsFloat(options, "radius", 1);
        let resolution = parseOptionAsInt(
            options,
            "resolution",
            defaultResolution2D
        );
        let points = [];
        for (let i = 0; i < resolution; i++)
        {
            let radians = (2 * Math.PI * i) / resolution;
            let point = Vector2D.fromAngleRadians(radians)
                .times(radius)
                .plus(center);
            points.push(point);
        }
        return fromPoints(points);
    }
}
