import { center } from "../api/center";
import { getTransformationAndInverseTransformationToFlatLying, getTransformationToFlatLying, lieFlat } from "../api/ops-cnc";
import { cutByPlane, sectionCut } from "../api/ops-cuts";
import { contract, expand, expandedShellOfCCSG } from "../api/ops-expandContract";
import { fromPolygons } from "./CSGFactories";
import { CanTransformation } from "./ITrans";
import { Matrix4x4 } from "./math/Matrix4";
import { OrthoNormalBasis } from "./math/OrthoNormalBasis";
import { Plane } from "./math/Plane";
import { Polygon, Shared } from "./math/Polygon3";
import { Properties } from "./Properties";
import { Tree } from "./trees";
import { canonicalizeCSG } from "./utils/canonicalize";
import { bounds } from "./utils/csgMeasurements";
import { projectToOrthoNormalBasis } from "./utils/csgProjections";
import { fixTJunctions } from "./utils/fixTJunctions";
import { reTesselate } from "./utils/retesellate";

/** Class CSG
 * Holds a binary space partition tree representing a 3D solid. Two solids can
 * be combined using the `union()`, `subtract()`, and `intersect()` methods.
 * @constructor
 */
export class CSG extends CanTransformation
{
    properties = new Properties();
    isCanonicalized: boolean = false;
    isRetesselated: boolean = false;
    constructor(public polygons: Polygon[] = [])
    {
        super();
    }

    get area()
    {
        return this.toTriangles()
            .map(t => t.getArea())
            .reduce((a, b) => a + b, 0);
    }

    /**
     * Return a new CSG solid representing the space in either this solid or
     * in the given solids. Neither this solid nor the given solids are modified.
     * @param {CSG[]} csg - list of CSG objects
     * @returns {CSG} new CSG object
     * @example
     * let C = A.union(B)
     * @example
     * +-------+            +-------+
     * |       |            |       |
     * |   A   |            |       |
     * |    +--+----+   =   |       +----+
     * +----+--+    |       +----+       |
     *      |   B   |            |       |
     *      |       |            |       |
     *      +-------+            +-------+
     */
    union(csg: CSG | CSG[])
    {
        let csgs: CSG[];
        if (csg instanceof Array)
        {
            csgs = csg.slice(0);
            csgs.push(this);
        }
        else csgs = [this, csg];

        let i: number;
        // combine csg pairs in a way that forms a balanced binary tree pattern
        for (i = 1; i < csgs.length; i += 2)
        {
            csgs.push(csgs[i - 1].unionSub(csgs[i]));
        }
        return csgs[i - 1].reTesselated().canonicalized();
    }

    unionSub(csg, retesselate = false, canonicalize = false)
    {
        if (!this.mayOverlap(csg)) return this.unionForNonIntersecting(csg);
        else
        {
            let a = new Tree(this.polygons);
            let b = new Tree(csg.polygons);
            a.clipTo(b, false);

            // b.clipTo(a, true); // ERROR: this doesn't work
            b.clipTo(a);
            b.invert();
            b.clipTo(a);
            b.invert();

            let newpolygons = a.allPolygons().concat(b.allPolygons());
            let result = fromPolygons(newpolygons);
            result.properties = this.properties._merge(csg.properties);
            if (retesselate) result = result.reTesselated();
            if (canonicalize) result = result.canonicalized();
            return result;
        }
    }

    // Like union, but when we know that the two solids are not intersecting
    // Do not use if you are not completely sure that the solids do not intersect!
    unionForNonIntersecting(csg)
    {
        let newpolygons = this.polygons.concat(csg.polygons);
        let result = fromPolygons(newpolygons);
        result.properties = this.properties._merge(csg.properties);
        result.isCanonicalized = this.isCanonicalized && csg.isCanonicalized;
        result.isRetesselated = this.isRetesselated && csg.isRetesselated;
        return result;
    }

    /**
     * Return a new CSG solid representing space in this solid but
     * not in the given solids. Neither this solid nor the given solids are modified.
     * @param {CSG[]} csg - list of CSG objects
     * @returns {CSG} new CSG object
     * @example
     * let C = A.subtract(B)
     * @example
     * +-------+            +-------+
     * |       |            |       |
     * |   A   |            |       |
     * |    +--+----+   =   |    +--+
     * +----+--+    |       +----+
     *      |   B   |
     *      |       |
     *      +-------+
     */
    subtract(csg)
    {
        let csgs;
        if (csg instanceof Array)
        {
            csgs = csg;
        } else
        {
            csgs = [csg];
        }
        let result: CSG = this;
        for (let i = 0; i < csgs.length; i++)
        {
            let islast = i === csgs.length - 1;
            result = result.subtractSub(csgs[i], islast, islast);
        }
        return result;
    }

    subtractSub(csg, retesselate, canonicalize)
    {
        let a = new Tree(this.polygons);
        let b = new Tree(csg.polygons);
        a.invert();
        a.clipTo(b);
        b.clipTo(a, true);
        a.addPolygons(b.allPolygons());
        a.invert();
        let result = fromPolygons(a.allPolygons());
        result.properties = this.properties._merge(csg.properties);
        if (retesselate) result = result.reTesselated();
        if (canonicalize) result = result.canonicalized();
        return result;
    }

    /**
     * Return a new CSG solid representing space in both this solid and
     * in the given solids. Neither this solid nor the given solids are modified.
     * @param {CSG[]} csg - list of CSG objects
     * @returns {CSG} new CSG object
     * @example
     * let C = A.intersect(B)
     * @example
     * +-------+
     * |       |
     * |   A   |
     * |    +--+----+   =   +--+
     * +----+--+    |       +--+
     *      |   B   |
     *      |       |
     *      +-------+
     */
    intersect(csg)
    {
        let csgs;
        if (csg instanceof Array)
        {
            csgs = csg;
        } else
        {
            csgs = [csg];
        }
        let result: CSG = this;
        for (let i = 0; i < csgs.length; i++)
        {
            let islast = i === csgs.length - 1;
            result = result.intersectSub(csgs[i], islast, islast);
        }
        return result;
    }

    intersectSub(csg, retesselate = false, canonicalize = false)
    {
        let a = new Tree(this.polygons);
        let b = new Tree(csg.polygons);
        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.addPolygons(b.allPolygons());
        a.invert();
        let result = fromPolygons(a.allPolygons());
        result.properties = this.properties._merge(csg.properties);
        if (retesselate) result = result.reTesselated();
        if (canonicalize) result = result.canonicalized();
        return result;
    }

    /**
     * Return a new CSG solid with solid and empty space switched.
     * This solid is not modified.
     * @returns {CSG} new CSG object
     * @example
     * let B = A.invert()
     */
    invert()
    {
        let flippedpolygons = this.polygons.map(p =>
        {
            return p.flipped();
        });
        return fromPolygons(flippedpolygons);
        // TODO: flip properties?
    }

    // Affine transformation of CSG object. Returns a new CSG object
    transform1(matrix4x4)
    {
        let newpolygons = this.polygons.map(p =>
        {
            return p.transform(matrix4x4);
        });
        let result = fromPolygons(newpolygons);
        result.properties = this.properties._transform(matrix4x4);
        result.isRetesselated = this.isRetesselated;
        return result;
    }

    /**
     * Return a new CSG solid that is transformed using the given Matrix.
     * Several matrix transformations can be combined before transforming this solid.
     * @param {CSG.Matrix4x4} matrix4x4 - matrix to be applied
     * @returns {CSG} new CSG object
     * @example
     * var m = new CSG.Matrix4x4()
     * m = m.multiply(CSG.Matrix4x4.rotationX(40))
     * m = m.multiply(CSG.Matrix4x4.translation([-.5, 0, 0]))
     * let B = A.transform(m)
     */
    transform(matrix4x4: Matrix4x4): this
    {
        let ismirror = matrix4x4.isMirroring();
        let transformedvertices = {};
        let transformedplanes = {};
        let newpolygons = this.polygons.map(p =>
        {
            let newplane;
            let plane = p.plane;
            let planetag = plane.getTag();
            if (planetag in transformedplanes)
            {
                newplane = transformedplanes[planetag];
            } else
            {
                newplane = plane.transform(matrix4x4);
                transformedplanes[planetag] = newplane;
            }
            let newvertices = p.vertices.map(v =>
            {
                let newvertex;
                let vertextag = v.getTag();
                if (vertextag in transformedvertices)
                {
                    newvertex = transformedvertices[vertextag];
                } else
                {
                    newvertex = v.transform(matrix4x4);
                    transformedvertices[vertextag] = newvertex;
                }
                return newvertex;
            });
            if (ismirror) newvertices.reverse();
            return new Polygon(newvertices, p.shared, newplane);
        });
        let result = fromPolygons(newpolygons);
        result.properties = this.properties._transform(matrix4x4);
        result.isRetesselated = this.isRetesselated;
        result.isCanonicalized = this.isCanonicalized;
        return result as this;
    }

    // ALIAS !
    center(axes)
    {
        return center({ axes }, [this]);
    }

    // ALIAS !
    expand(radius, resolution)
    {
        return expand(this, radius, resolution);
    }

    // ALIAS !
    contract(radius, resolution)
    {
        return contract(this, radius, resolution);
    }

    // ALIAS !
    expandedShell(radius, resolution, unionWithThis)
    {
        return expandedShellOfCCSG(this, radius, resolution, unionWithThis);
    }

    // cut the solid at a plane, and stretch the cross-section found along plane normal
    // note: only used in roundedCube() internally
    stretchAtPlane(normal, point, length)
    {
        let plane = Plane.fromNormalAndPoint(normal, point);
        let onb = new OrthoNormalBasis(plane);
        let crosssect = this.sectionCut(onb);
        let midpiece = crosssect.extrudeInOrthonormalBasis(onb, length);
        let piece1 = this.cutByPlane(plane);
        let piece2 = this.cutByPlane(plane.flipped());
        let result = piece1.union([
            midpiece,
            piece2.translate(plane.normal.times(length))
        ]);
        return result;
    }

    // ALIAS !
    canonicalized()
    {
        if (this.isCanonicalized) return this;

        return canonicalizeCSG(this);
    }

    // ALIAS !
    reTesselated()
    {
        return reTesselate(this);
    }

    // ALIAS !
    fixTJunctions()
    {
        return fixTJunctions(fromPolygons, this);
    }

    // ALIAS !
    getBounds()
    {
        return bounds(this);
    }

    /** returns true if there is a possibility that the two solids overlap
     * returns false if we can be sure that they do not overlap
     * NOTE: this is critical as it is used in UNIONs
     * @param  {CSG} csg
     */
    mayOverlap(csg)
    {
        if (this.polygons.length === 0 || csg.polygons.length === 0)
        {
            return false;
        } else
        {
            let mybounds = bounds(this);
            let otherbounds = bounds(csg);
            if (mybounds[1].x < otherbounds[0].x) return false;
            if (mybounds[0].x > otherbounds[1].x) return false;
            if (mybounds[1].y < otherbounds[0].y) return false;
            if (mybounds[0].y > otherbounds[1].y) return false;
            if (mybounds[1].z < otherbounds[0].z) return false;
            if (mybounds[0].z > otherbounds[1].z) return false;
            return true;
        }
    }

    // ALIAS !
    cutByPlane(plane)
    {
        return cutByPlane(this, plane);
    }

    /**
     * Connect a solid to another solid, such that two Connectors become connected
     * @param  {Connector} myConnector a Connector of this solid
     * @param  {Connector} otherConnector a Connector to which myConnector should be connected
     * @param  {Boolean} mirror false: the 'axis' vectors of the connectors should point in the same direction
     * true: the 'axis' vectors of the connectors should point in opposite direction
     * @param  {Float} normalrotation degrees of rotation between the 'normal' vectors of the two
     * connectors
     * @returns {CSG} this csg, tranformed accordingly
     */
    connectTo(myConnector, otherConnector, mirror, normalrotation)
    {
        let matrix = myConnector.getTransformationTo(
            otherConnector,
            mirror,
            normalrotation
        );
        return this.transform(matrix);
    }

    /**
     * set the .shared property of all polygons
     * @param  {Object} shared
     * @returns {CSG} Returns a new CSG solid, the original is unmodified!
     */
    setShared(shared)
    {
        let polygons = this.polygons.map(p =>
        {
            return new Polygon(p.vertices, shared, p.plane);
        });
        let result = fromPolygons(polygons);
        result.properties = this.properties; // keep original properties
        result.isRetesselated = this.isRetesselated;
        result.isCanonicalized = this.isCanonicalized;
        return result;
    }

    /** sets the color of this csg: non mutating, returns a new CSG
     * @param  {Object} args
     * @returns {CSG} a copy of this CSG, with the given color
     */
    setColor(args)
    {
        let newshared = Shared.fromColor.apply(this, arguments);
        return this.setShared(newshared);
    }

    // ALIAS !
    getTransformationAndInverseTransformationToFlatLying()
    {
        return getTransformationAndInverseTransformationToFlatLying(this);
    }

    // ALIAS !
    getTransformationToFlatLying()
    {
        return getTransformationToFlatLying(this);
    }

    // ALIAS !
    lieFlat()
    {
        return lieFlat(this);
    }

    // project the 3D CSG onto a plane
    // This returns a 2D CAG with the 'shadow' shape of the 3D solid when projected onto the
    // plane represented by the orthonormal basis
    projectToOrthoNormalBasis(orthobasis)
    {
        // FIXME:  DEPENDS ON CAG !!
        return projectToOrthoNormalBasis(this, orthobasis);
    }

    // FIXME: not finding any uses within our code ?
    sectionCut(orthobasis)
    {
        return sectionCut(this, orthobasis);
    }

    /** @return {Polygon[]} The list of polygons. */
    toPolygons()
    {
        return this.polygons;
    }

    toString()
    {
        let result = "CSG solid:\n";
        for (let p of this.polygons) result += p.toString();
        return result;
    }

    /** returns a compact binary representation of this csg
     * usually used to transfer CSG objects to/from webworkes
     * NOTE: very interesting compact format, with a lot of reusable ideas
     * @returns {Object} compact binary representation of a CSG
     */
    toCompactBinary()
    {
        let csg = this.canonicalized();
        let numpolygons = csg.polygons.length;
        let numpolygonvertices = 0;

        let numvertices = 0;
        let vertexmap = {};
        let vertices = [];

        let numplanes = 0;
        let planemap = {};
        let planes = [];

        let shareds = [];
        let sharedmap = {};
        let numshared = 0;
        // for (let i = 0, iMax = csg.polygons.length; i < iMax; i++) {
        //  let p = csg.polygons[i];
        //  for (let j = 0, jMax = p.length; j < jMax; j++) {
        //      ++numpolygonvertices;
        //      let vertextag = p[j].getTag();
        //      if(!(vertextag in vertexmap)) {
        //          vertexmap[vertextag] = numvertices++;
        //          vertices.push(p[j]);
        //      }
        //  }
        csg.polygons.map(polygon =>
        {
            // FIXME: why use map if we do not return anything ?
            // either for... or forEach
            polygon.vertices.map(vertex =>
            {
                ++numpolygonvertices;
                let vertextag = vertex.getTag();
                if (!(vertextag in vertexmap))
                {
                    vertexmap[vertextag] = numvertices++;
                    vertices.push(vertex);
                }
            });

            let planetag = polygon.plane.getTag();
            if (!(planetag in planemap))
            {
                planemap[planetag] = numplanes++;
                planes.push(polygon.plane);
            }
            let sharedtag = polygon.shared.getTag();
            if (!(sharedtag in sharedmap))
            {
                sharedmap[sharedtag] = numshared++;
                shareds.push(polygon.shared);
            }
        });

        let numVerticesPerPolygon = new Uint32Array(numpolygons);
        let polygonSharedIndexes = new Uint32Array(numpolygons);
        let polygonVertices = new Uint32Array(numpolygonvertices);
        let polygonPlaneIndexes = new Uint32Array(numpolygons);
        let vertexData = new Float64Array(numvertices * 3);
        let planeData = new Float64Array(numplanes * 4);
        let polygonVerticesIndex = 0;

        // FIXME: doublecheck : why does it go through the whole polygons again?
        // can we optimise that ? (perhap due to needing size to init buffers above)
        for (let polygonindex = 0; polygonindex < numpolygons; ++polygonindex)
        {
            let polygon = csg.polygons[polygonindex];
            numVerticesPerPolygon[polygonindex] = polygon.vertices.length;
            polygon.vertices.map(vertex =>
            {
                let vertextag = vertex.getTag();
                let vertexindex = vertexmap[vertextag];
                polygonVertices[polygonVerticesIndex++] = vertexindex;
            });
            let planetag = polygon.plane.getTag();
            let planeindex = planemap[planetag];
            polygonPlaneIndexes[polygonindex] = planeindex;
            let sharedtag = polygon.shared.getTag();
            let sharedindex = sharedmap[sharedtag];
            polygonSharedIndexes[polygonindex] = sharedindex;
        }
        let verticesArrayIndex = 0;
        vertices.map(vertex =>
        {
            const pos = vertex.pos;
            vertexData[verticesArrayIndex++] = pos._x;
            vertexData[verticesArrayIndex++] = pos._y;
            vertexData[verticesArrayIndex++] = pos._z;
        });
        let planesArrayIndex = 0;
        planes.map(plane =>
        {
            const normal = plane.normal;
            planeData[planesArrayIndex++] = normal._x;
            planeData[planesArrayIndex++] = normal._y;
            planeData[planesArrayIndex++] = normal._z;
            planeData[planesArrayIndex++] = plane.w;
        });

        let result = {
            class: "CSG",
            numPolygons: numpolygons,
            numVerticesPerPolygon,
            polygonPlaneIndexes,
            polygonSharedIndexes,
            polygonVertices,
            vertexData,
            planeData,
            shared: shareds
        };
        return result;
    }

    /** returns the triangles of this csg
     * @returns {Polygons} triangulated polygons
     */
    toTriangles()
    {
        let polygons: Polygon[] = [];
        this.polygons.forEach(poly =>
        {
            let firstVertex = poly.vertices[0];
            for (let i = poly.vertices.length - 3; i >= 0; i--)
            {
                polygons.push(
                    new Polygon(
                        [
                            firstVertex,
                            poly.vertices[i + 1],
                            poly.vertices[i + 2]
                        ],
                        poly.shared,
                        poly.plane
                    )
                );
            }
        });
        return polygons;
    }
}
