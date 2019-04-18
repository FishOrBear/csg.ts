import { FuzzyFactory } from "./FuzzyFactory";
import { EPS } from "./constants";
import { Polygon, Shared } from "./math/Polygon3";
import { Plane } from "./math/Plane";
import { Vertex3D } from "./math/Vertex3";

export class FuzzyCSGFactory
{
    vertexfactory = new FuzzyFactory(3, EPS);
    planefactory = new FuzzyFactory(4, EPS);
    polygonsharedfactory: { [key: string]: Shared } = {};
    constructor() { }

    getPolygonShared(sourceshared: Shared): Shared
    {
        let hash = sourceshared.getHash();
        if (hash in this.polygonsharedfactory)
            return this.polygonsharedfactory[hash];
        else
        {
            this.polygonsharedfactory[hash] = sourceshared;
            return sourceshared;
        }
    }

    getVertex(sourcevertex: Vertex3D): Vertex3D
    {
        let elements = [
            sourcevertex.pos._x,
            sourcevertex.pos._y,
            sourcevertex.pos._z
        ];
        let result = this.vertexfactory.lookupOrCreate(
            elements,
            els => sourcevertex
        );
        return result;
    }

    getPlane(sourceplane: Plane): Plane
    {
        let elements: number[] = [
            sourceplane.normal._x,
            sourceplane.normal._y,
            sourceplane.normal._z,
            sourceplane.w
        ];
        let result = this.planefactory.lookupOrCreate(
            elements,
            els => sourceplane
        );
        return result;
    }

    getPolygon(sourcePolygon: Polygon, outputPolygon = sourcePolygon): Polygon
    {
        let newPlane = this.getPlane(sourcePolygon.plane);
        let newShared = this.getPolygonShared(sourcePolygon.shared);
        let newVertices = sourcePolygon.vertices.map(vertex => this.getVertex(vertex));
        // two vertices that were originally very close may now have become
        // truly identical (referring to the same Vertex object).
        // Remove duplicate vertices:
        let newVerticesDedup: Vertex3D[] = [];//新的顶点列表(已过滤重复)
        if (newVertices.length > 0)
        {
            let prevVertexTag = newVertices[newVertices.length - 1].getTag();
            for (let vertex of newVertices)
            {
                let vertextag = vertex.getTag();
                if (vertextag !== prevVertexTag)
                    newVerticesDedup.push(vertex);
                prevVertexTag = vertextag;
            }
        }
        // If it's degenerate, remove all vertices:
        if (newVerticesDedup.length < 3)
            newVerticesDedup = [];

        outputPolygon.vertices = newVertices;
        outputPolygon.shared = newShared;
        outputPolygon.plane = newPlane;
        return outputPolygon;
    }
}
