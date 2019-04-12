import { FuzzyFactory } from "./FuzzyFactory";
import { EPS } from "./constants";
import { Polygon } from "./math/Polygon3";
import { Plane } from "./math/Plane";

export class FuzzyCSGFactory
{
    vertexfactory = new FuzzyFactory(3, EPS);
    planefactory = new FuzzyFactory(4, EPS);
    polygonsharedfactory: {} = {};
    constructor() { }

    getPolygonShared(sourceshared)
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

    getVertex(sourcevertex)
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

    getPlane(sourceplane: Plane)
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

    getPolygon(sourcepolygon: Polygon)
    {
        let newplane = this.getPlane(sourcepolygon.plane);
        let newshared = this.getPolygonShared(sourcepolygon.shared);
        let _this = this;
        let newvertices = sourcepolygon.vertices.map(vertex =>
            _this.getVertex(vertex)
        );
        // two vertices that were originally very close may now have become
        // truly identical (referring to the same Vertex object).
        // Remove duplicate vertices:
        let newverticesDedup = [];
        if (newvertices.length > 0)
        {
            let prevvertextag = newvertices[newvertices.length - 1].getTag();
            newvertices.forEach(vertex =>
            {
                let vertextag = vertex.getTag();
                if (vertextag !== prevvertextag) newverticesDedup.push(vertex);
                prevvertextag = vertextag;
            });
        }
        // If it's degenerate, remove all vertices:
        if (newverticesDedup.length < 3) newverticesDedup = [];

        return new Polygon(newverticesDedup, newshared, newplane);
    }
}
