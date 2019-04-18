import { solidFromSlices } from "../../api/solidFromSlices";
import { CAG } from "../CAG";
import { fromPointsNoCheck } from "../CAGFactories";
import { areaEPS, getTag, _CSGDEBUG } from "../constants";
import { CSG } from "../CSG";
import { fromPolygons } from "../CSGFactories";
import { Matrix4x4 } from "./Matrix4";
import { Plane } from "./Plane";
import { Side } from "./Side";
import { Vector2D } from "./Vector2";
import { Vector3D } from "./Vector3";
import { Vertex3D } from "./Vertex3";

/** Class Polygon
 * Represents a convex polygon. The vertices used to initialize a polygon must
 *   be coplanar and form a convex loop. They do not have to be `Vertex`
 *   instances but they must behave similarly (duck typing can be used for
 *   customization).
 * <br>
 * Each convex polygon has a `shared` property, which is shared between all
 *   polygons that are clones of each other or were split from the same polygon.
 *   This can be used to define per-polygon properties (such as surface color).
 * <br>
 * The plane of the polygon is calculated from the vertex coordinates if not provided.
 *   The plane can alternatively be passed as the third argument to avoid calculations.
 *
  *表示凸多边形。 用于初始化多边形的顶点必须共面并形成凸环。
  *每个凸多边形都有一个`shared`属性，在所有属性之间共享
  *多边形是彼此克隆或从同一多边形分割的多边形。
  *这可用于定义每个多边形属性（例如表面颜色）。
 */
export class Polygon
{
    cachedBoundingSphere: any;
    cachedBoundingBox: any;
    sides: Side[];

    cachePoints2d: Vector2D[];

    constructor(public vertices: Vertex3D[], public shared = defaultShared, public plane?: Plane)
    {
        if (!plane)
            this.plane = Plane.fromVector3Ds(
                vertices[0].pos,
                vertices[1].pos,
                vertices[2].pos
            );

        if (_CSGDEBUG)
            if (!this.checkIfConvex()) throw new Error("Not convex!");
    }

    /** Check whether the polygon is convex. (it should be, otherwise we will get unexpected results)*/
    checkIfConvex(): boolean
    {
        return Polygon.verticesConvex(this.vertices, this.plane.normal);
    }

    getSignedVolume()
    {
        let signedVolume = 0;
        for (let i = 0; i < this.vertices.length - 2; i++)
        {
            signedVolume += this.vertices[0].pos.dot(
                this.vertices[i + 1].pos.cross(this.vertices[i + 2].pos)
            );
        }
        signedVolume /= 6;
        return signedVolume;
    }

    // Note: could calculate vectors only once to speed up
    // 可以只计算一次矢量来加速
    getArea()
    {
        let polygonArea = 0;
        for (let i = 0; i < this.vertices.length - 2; i++)
        {
            polygonArea += this.vertices[i + 1].pos
                .minus(this.vertices[0].pos)
                .cross(this.vertices[i + 2].pos.minus(this.vertices[i + 1].pos))
                .length();
        }
        polygonArea /= 2;
        return polygonArea;
    }


    // Extrude a polygon into the direction offsetvector
    // Returns a CSG object
    extrude(offsetvector: Vector3D): CSG
    {
        let newPolygons: Polygon[] = [];

        let polygon1: Polygon = this;
        let direction = polygon1.plane.normal.dot(offsetvector);
        if (direction > 0)
            polygon1 = polygon1.flipped();

        newPolygons.push(polygon1);
        let polygon2 = polygon1.translate(offsetvector);
        let numvertices = this.vertices.length;
        for (let i = 0; i < numvertices; i++)
        {
            let sidefacepoints: Vector3D[] = [];
            let nexti = i < numvertices - 1 ? i + 1 : 0;
            sidefacepoints.push(polygon1.vertices[i].pos);
            sidefacepoints.push(polygon2.vertices[i].pos);
            sidefacepoints.push(polygon2.vertices[nexti].pos);
            sidefacepoints.push(polygon1.vertices[nexti].pos);
            let sidefacepolygon = Polygon.createFromPoints(
                sidefacepoints,
                this.shared
            );
            newPolygons.push(sidefacepolygon);
        }
        polygon2 = polygon2.flipped();
        newPolygons.push(polygon2);
        return fromPolygons(newPolygons);
    }

    translate(offset: Vector3D)
    {
        return this.transform(Matrix4x4.translation(offset));
    }

    // returns an array with a Vector3D (center point) and a radius

    boundingSphere()
    {
        if (!this.cachedBoundingSphere)
        {
            let box = this.boundingBox();
            let middle = box[0].plus(box[1]).times(0.5);
            let radius3 = box[1].minus(middle);
            let radius = radius3.length();
            this.cachedBoundingSphere = [middle, radius];
        }
        return this.cachedBoundingSphere;
    }

    // returns an array of two Vector3Ds (minimum coordinates and maximum coordinates)

    boundingBox()
    {
        if (!this.cachedBoundingBox)
        {
            let minpoint: Vector3D;
            let maxpoint: Vector3D;
            let vertices = this.vertices;
            let numvertices = vertices.length;
            if (numvertices === 0)
                minpoint = new Vector3D(0, 0, 0);
            else
                minpoint = vertices[0].pos;
            maxpoint = minpoint;
            for (let i = 1; i < numvertices; i++)
            {
                let point = vertices[i].pos;
                minpoint = minpoint.min(point);
                maxpoint = maxpoint.max(point);
            }
            this.cachedBoundingBox = [minpoint, maxpoint];
        }
        return this.cachedBoundingBox;
    }

    flipped()
    {
        let newvertices = this.vertices.map(v => v.flipped());
        newvertices.reverse();
        let newplane = this.plane.flipped();
        return new Polygon(newvertices, this.shared, newplane);
    }

    // Affine transformation of polygon. Returns a new Polygon

    transform(matrix4x4)
    {
        let newvertices = this.vertices.map(v => v.transform(matrix4x4));
        let newplane = this.plane.transform(matrix4x4);
        if (matrix4x4.isMirroring())
        {
            // need to reverse the vertex order
            // in order to preserve the inside/outside orientation:
            newvertices.reverse();
        }
        return new Polygon(newvertices, this.shared, newplane);
    }

    toString()
    {
        let result = "Polygon plane: " + this.plane.toString() + "\n";
        for (let v of this.vertices) result += "  " + v.toString() + "\n";
        return result;
    }

    // project the 3D polygon onto a plane

    projectToOrthoNormalBasis(orthobasis)
    {
        let points2d = this.vertices.map(vertex => orthobasis.to2D(vertex.pos));

        let result = fromPointsNoCheck(points2d);
        let area = result.area;
        if (Math.abs(area) < areaEPS)
        {
            // the polygon was perpendicular to the orthnormal plane. The resulting 2D polygon would be degenerate
            // return an empty area instead:
            result = new CAG();
        }
        else if (area < 0)
        {
            result = result.flipped();
        }
        return result;
    }

    // ALIAS ONLY!!
    solidFromSlices(options)
    {
        return solidFromSlices(this, options);
    }

    static createFromPoints(points: Vector3D[], shared?: Shared, plane?: Plane): Polygon
    {
        let vertices = points.map(p => new Vertex3D(p));
        if (arguments.length < 3)
            return new Polygon(vertices, shared);
        else
            return new Polygon(vertices, shared, plane);
    }

    // create from an untyped object with identical property names:
    static fromObject(obj)
    {
        let vertices = obj.vertices.map(v =>
        {
            return Vertex3D.fromObject(v);
        });
        let shared = Shared.fromObject(obj.shared);
        let plane = Plane.fromObject(obj.plane);
        return new Polygon(vertices, shared, plane);
    }

    static verticesConvex(vertices: Vertex3D[], planenormal: Vector3D)
    {
        let count = vertices.length;
        if (count < 3) return false;

        let prevPrevPos = vertices[count - 2].pos;
        let prevPos = vertices[count - 1].pos;
        for (let i = 0; i < count; i++)
        {
            let pos = vertices[i].pos;
            if (!Polygon.isConvexPoint(prevPrevPos, prevPos, pos, planenormal))
                return false;

            prevPrevPos = prevPos;
            prevPos = pos;
        }
        return true;
    }

    // 计算3点是否凸角
    static isConvexPoint(prevpoint: Vector3D, point: Vector3D, nextpoint: Vector3D, normal: Vector3D)
    {
        let crossproduct = point.minus(prevpoint).cross(nextpoint.minus(point));
        let crossdotnormal = crossproduct.dot(normal);
        return crossdotnormal >= 0;
    }
}

/** Class Polygon.Shared
 * Holds the shared properties for each polygon (Currently only color).
 * @constructor
 * @param {Array[]} color - array containing RGBA values, or null
 *
 * @example
 *   let shared = new CSG.Polygon.Shared([0, 0, 0, 1])
 */
export class Shared
{
    tag: number;
    constructor(public color: number[])
    {
        if (color && color.length !== 4)
        {
            throw new Error("Expecting 4 element array");
        }
    }

    getTag()
    {
        let result = this.tag;
        if (!result)
        {
            result = getTag();
            this.tag = result;
        }
        return result;
    }
    // get a string uniquely identifying this object
    getHash()
    {
        if (!this.color) return "null";
        return this.color.join("/");
    }

    /** Create Polygon.Shared from color values.
     * @param {number} r - value of RED component
     * @param {number} g - value of GREEN component
     * @param {number} b - value of BLUE component
     * @param {number} [a] - value of ALPHA component
     * @param {Array[]} [color] - OR array containing RGB values (optional Alpha)
     *
     * @example
     * let s1 = Polygon.Shared.fromColor(0,0,0)
     * let s2 = Polygon.Shared.fromColor([0,0,0,1])
     */
    static fromColor(args)
    {
        let color;
        if (arguments.length === 1)
        {
            color = arguments[0].slice(); // make deep copy
        }
        else
        {
            color = [];
            for (let i = 0; i < arguments.length; i++)
            {
                color.push(arguments[i]);
            }
        }
        if (color.length === 3)
        {
            color.push(1);
        }
        else if (color.length !== 4)
        {
            throw new Error(
                "setColor expects either an array with 3 or 4 elements, or 3 or 4 parameters."
            );
        }
        return new Shared(color);
    }

    static fromObject(obj)
    {
        return new Shared(obj.color);
    }
}

export const defaultShared = new Shared(null);
