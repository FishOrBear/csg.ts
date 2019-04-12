import { Side } from "./math/Side";
import { FuzzyFactory } from "./FuzzyFactory";
import { EPS } from "./constants";

export class FuzzyCAGFactory
{
    vertexfactory = new FuzzyFactory(2, EPS);
    constructor() { }

    getVertex(sourcevertex)
    {
        let elements = [sourcevertex.pos._x, sourcevertex.pos._y];
        let result = this.vertexfactory.lookupOrCreate(
            elements,
            els => sourcevertex
        );
        return result;
    }

    getSide(sourceside: Side)
    {
        let vertex0 = this.getVertex(sourceside.vertex0);
        let vertex1 = this.getVertex(sourceside.vertex1);
        return new Side(vertex0, vertex1);
    }
}
