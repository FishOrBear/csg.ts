import { CanTransformation } from "../ITrans";

/** Class Vector3D
 * Represents a 3D vector with X, Y, Z coordinates.
 * @constructor
 *
 * @example
 * new CSG.Vector3D(1, 2, 3);
 * new CSG.Vector3D([1, 2, 3]);
 * new CSG.Vector3D({ x: 1, y: 2, z: 3 });
 * new CSG.Vector3D(1, 2); // assumes z=0
 * new CSG.Vector3D([1, 2]); // assumes z=0
 */
export class Vector3D extends CanTransformation
{
    constructor(public _x: number, public _y: number, public _z)
    {
        super();
    }

    get x()
    {
        return this._x;
    }

    get y()
    {
        return this._y;
    }

    get z()
    {
        return this._z;
    }

    set x(v)
    {
        throw new Error('Vector3D is immutable')
    }

    set y(v)
    {
        throw new Error('Vector3D is immutable')
    }

    set z(v)
    {
        throw new Error('Vector3D is immutable')
    }

    clone()
    {
        return new Vector3D(this._x, this._y, this._z);
    }
    negated()
    {
        return new Vector3D(-this._x, -this._y, -this._z);
    }

    abs()
    {
        return new Vector3D(Math.abs(this._x), Math.abs(this._y), Math.abs(this._z));
    }

    plus(a)
    {
        return new Vector3D(this._x + a._x, this._y + a._y, this._z + a._z);
    }

    minus(a)
    {
        return new Vector3D(this._x - a._x, this._y - a._y, this._z - a._z);
    }

    times(a)
    {
        return new Vector3D(this._x * a, this._y * a, this._z * a);
    }

    dividedBy(a)
    {
        return new Vector3D(this._x / a, this._y / a, this._z / a);
    }

    dot(a)
    {
        return this._x * a._x + this._y * a._y + this._z * a._z;
    }

    lerp(a, t)
    {
        return this.plus(a.minus(this).times(t));
    }

    lengthSquared()
    {
        return this.dot(this);
    }

    length()
    {
        return Math.sqrt(this.lengthSquared());
    }

    unit()
    {
        return this.dividedBy(this.length());
    }

    cross(a)
    {
        return new Vector3D(this._y * a._z - this._z * a._y, this._z * a._x - this._x * a._z, this._x * a._y - this._y * a._x);
    }

    distanceTo(a)
    {
        return this.minus(a).length()
    }

    distanceToSquared(a)
    {
        return this.minus(a).lengthSquared()
    }

    equals(a)
    {
        return (this._x === a._x) && (this._y === a._y) && (this._z === a._z)
    }

    // Right multiply by a 4x4 matrix (the vector is interpreted as a row vector)
    // Returns a new Vector3D

    multiply4x4(matrix4x4)
    {
        return matrix4x4.leftMultiply1x3Vector(this)
    }

    transform(matrix4x4)
    {
        return matrix4x4.leftMultiply1x3Vector(this)
    }

    toString()
    {
        return '(' + this._x.toFixed(5) + ', ' + this._y.toFixed(5) + ', ' + this._z.toFixed(5) + ')';
    }

    // find a vector that is somewhat perpendicular to this one

    randomNonParallelVector()
    {
        const abs = this.abs();
        if ((abs._x <= abs._y) && (abs._x <= abs._z))
        {
            return new Vector3D(1, 0, 0)
        } else if ((abs._y <= abs._x) && (abs._y <= abs._z))
        {
            return new Vector3D(0, 1, 0)
        } else
        {
            return new Vector3D(0, 0, 1)
        }
    }

    min(p)
    {
        return new Vector3D(Math.min(this._x, p._x), Math.min(this._y, p._y), Math.min(this._z, p._z))
    }

    max(p)
    {
        return new Vector3D(Math.max(this._x, p._x), Math.max(this._y, p._y), Math.max(this._z, p._z))
    }

    // This does the same as new Vector3D(x,y,z) but it doesn't go through the constructor
    // and the parameters are not validated. Is much faster.
    static Create(arr: number[] | Vector3D)
    {
        if (arr instanceof Vector3D)
            return arr;

        return new Vector3D(arr[0], arr[1], arr[2]);
    }
}
