import { Vector3D } from "./Vector3";
import { Vector2D } from "./Vector2";
import { OrthoNormalBasis } from "./OrthoNormalBasis";
import { Plane } from "./Plane";

// # class Matrix4x4:
// Represents a 4x4 matrix. Elements are specified in row order
export class Matrix4x4
{
    constructor(public elements: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    {
    }

    plus(m: Matrix4x4)
    {
        const r = [];
        for (let i = 0; i < 16; i++)
            r[i] = this.elements[i] + m.elements[i];
        return new Matrix4x4(r);
    }

    minus(m: Matrix4x4)
    {
        const r = [];
        for (let i = 0; i < 16; i++)
            r[i] = this.elements[i] - m.elements[i];
        return new Matrix4x4(r);
    }

    // right multiply by another 4x4 matrix:

    multiply(m: Matrix4x4)
    {
        // cache elements in local letiables, for speedup:
        const this0 = this.elements[0];
        const this1 = this.elements[1];
        const this2 = this.elements[2];
        const this3 = this.elements[3];
        const this4 = this.elements[4];
        const this5 = this.elements[5];
        const this6 = this.elements[6];
        const this7 = this.elements[7];
        const this8 = this.elements[8];
        const this9 = this.elements[9];
        const this10 = this.elements[10];
        const this11 = this.elements[11];
        const this12 = this.elements[12];
        const this13 = this.elements[13];
        const this14 = this.elements[14];
        const this15 = this.elements[15];
        const m0 = m.elements[0];
        const m1 = m.elements[1];
        const m2 = m.elements[2];
        const m3 = m.elements[3];
        const m4 = m.elements[4];
        const m5 = m.elements[5];
        const m6 = m.elements[6];
        const m7 = m.elements[7];
        const m8 = m.elements[8];
        const m9 = m.elements[9];
        const m10 = m.elements[10];
        const m11 = m.elements[11];
        const m12 = m.elements[12];
        const m13 = m.elements[13];
        const m14 = m.elements[14];
        const m15 = m.elements[15];

        const result = [];
        result[0] = this0 * m0 + this1 * m4 + this2 * m8 + this3 * m12;
        result[1] = this0 * m1 + this1 * m5 + this2 * m9 + this3 * m13;
        result[2] = this0 * m2 + this1 * m6 + this2 * m10 + this3 * m14;
        result[3] = this0 * m3 + this1 * m7 + this2 * m11 + this3 * m15;
        result[4] = this4 * m0 + this5 * m4 + this6 * m8 + this7 * m12;
        result[5] = this4 * m1 + this5 * m5 + this6 * m9 + this7 * m13;
        result[6] = this4 * m2 + this5 * m6 + this6 * m10 + this7 * m14;
        result[7] = this4 * m3 + this5 * m7 + this6 * m11 + this7 * m15;
        result[8] = this8 * m0 + this9 * m4 + this10 * m8 + this11 * m12;
        result[9] = this8 * m1 + this9 * m5 + this10 * m9 + this11 * m13;
        result[10] = this8 * m2 + this9 * m6 + this10 * m10 + this11 * m14;
        result[11] = this8 * m3 + this9 * m7 + this10 * m11 + this11 * m15;
        result[12] = this12 * m0 + this13 * m4 + this14 * m8 + this15 * m12;
        result[13] = this12 * m1 + this13 * m5 + this14 * m9 + this15 * m13;
        result[14] = this12 * m2 + this13 * m6 + this14 * m10 + this15 * m14;
        result[15] = this12 * m3 + this13 * m7 + this14 * m11 + this15 * m15;
        return new Matrix4x4(result);
    }

    clone()
    {
        return new Matrix4x4(this.elements.concat());
    }

    // Right multiply the matrix by a Vector3D (interpreted as 3 row, 1 column)
    // (result = M*v)
    // Fourth element is taken as 1
    rightMultiply1x3Vector(v: Vector3D)
    {
        const v0 = v._x;
        const v1 = v._y;
        const v2 = v._z;
        const v3 = 1;
        let x = v0 * this.elements[0] + v1 * this.elements[1] + v2 * this.elements[2] + v3 * this.elements[3];
        let y = v0 * this.elements[4] + v1 * this.elements[5] + v2 * this.elements[6] + v3 * this.elements[7];
        let z = v0 * this.elements[8] + v1 * this.elements[9] + v2 * this.elements[10] + v3 * this.elements[11];
        const w = v0 * this.elements[12] + v1 * this.elements[13] + v2 * this.elements[14] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1)
        {
            const invw = 1.0 / w;
            x *= invw
            y *= invw
            z *= invw
        }
        return new Vector3D(x, y, z)
    }

    // Multiply a Vector3D (interpreted as 3 column, 1 row) by this matrix
    // (result = v*M)
    // Fourth element is taken as 1

    leftMultiply1x3Vector(v: Vector3D)
    {
        const v0 = v._x;
        const v1 = v._y;
        const v2 = v._z;
        const v3 = 1;
        let x = v0 * this.elements[0] + v1 * this.elements[4] + v2 * this.elements[8] + v3 * this.elements[12];
        let y = v0 * this.elements[1] + v1 * this.elements[5] + v2 * this.elements[9] + v3 * this.elements[13];
        let z = v0 * this.elements[2] + v1 * this.elements[6] + v2 * this.elements[10] + v3 * this.elements[14];
        const w = v0 * this.elements[3] + v1 * this.elements[7] + v2 * this.elements[11] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1)
        {
            const invw = 1.0 / w;
            x *= invw
            y *= invw
            z *= invw
        }
        return new Vector3D(x, y, z)
    }

    // Right multiply the matrix by a Vector2D (interpreted as 2 row, 1 column)
    // (result = M*v)
    // Fourth element is taken as 1

    rightMultiply1x2Vector(v: Vector3D)
    {
        const v0 = v.x;
        const v1 = v.y;
        const v2 = 0;
        const v3 = 1;
        let x = v0 * this.elements[0] + v1 * this.elements[1] + v2 * this.elements[2] + v3 * this.elements[3];
        let y = v0 * this.elements[4] + v1 * this.elements[5] + v2 * this.elements[6] + v3 * this.elements[7];
        let z = v0 * this.elements[8] + v1 * this.elements[9] + v2 * this.elements[10] + v3 * this.elements[11];
        const w = v0 * this.elements[12] + v1 * this.elements[13] + v2 * this.elements[14] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1)
        {
            const invw = 1.0 / w;
            x *= invw
            y *= invw
            z *= invw
        }
        return new Vector2D(x, y)
    }

    // Multiply a Vector2D (interpreted as 2 column, 1 row) by this matrix
    // (result = v*M)
    // Fourth element is taken as 1

    leftMultiply1x2Vector(v: Vector3D)
    {
        const v0 = v.x;
        const v1 = v.y;
        const v2 = 0;
        const v3 = 1;
        let x = v0 * this.elements[0] + v1 * this.elements[4] + v2 * this.elements[8] + v3 * this.elements[12];
        let y = v0 * this.elements[1] + v1 * this.elements[5] + v2 * this.elements[9] + v3 * this.elements[13];
        let z = v0 * this.elements[2] + v1 * this.elements[6] + v2 * this.elements[10] + v3 * this.elements[14];
        const w = v0 * this.elements[3] + v1 * this.elements[7] + v2 * this.elements[11] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1)
        {
            const invw = 1.0 / w;
            x *= invw
            y *= invw
            z *= invw
        }
        return new Vector2D(x, y)
    }

    // determine whether this matrix is a mirroring transformation

    isMirroring()
    {
        const u = new Vector3D(this.elements[0], this.elements[4], this.elements[8]);
        const v = new Vector3D(this.elements[1], this.elements[5], this.elements[9]);
        const w = new Vector3D(this.elements[2], this.elements[6], this.elements[10]);

        // for a true orthogonal, non-mirrored base, u.cross(v) == w
        // If they have an opposite direction then we are mirroring
        const mirrorvalue = u.cross(v).dot(w);
        const ismirror = (mirrorvalue < 0);
        return ismirror;
    }

    // return the unity matrix
    static unity()
    {
        return new Matrix4x4();
    }

    // Create a rotation matrix for rotating around the x axis
    static rotationX(degrees: number)
    {
        const radians = degrees * Math.PI * (1.0 / 180.0);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const els = [
            1, 0, 0, 0, 0, cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1
        ];
        return new Matrix4x4(els);
    }

    // Create a rotation matrix for rotating around the y axis
    static rotationY(degrees: number)
    {
        const radians = degrees * Math.PI * (1.0 / 180.0);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const els = [
            cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, 0, 0, 0, 1
        ];
        return new Matrix4x4(els)
    }

    // Create a rotation matrix for rotating around the z axis
    static rotationZ(degrees: number)
    {
        const radians = degrees * Math.PI * (1.0 / 180.0);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const els = [
            cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
        ];
        return new Matrix4x4(els)
    }

    // Matrix for rotation about arbitrary point and axis
    static rotation(rotationCenter: Vector3D | number[], rotationAxis: Vector3D | number[], degrees: number)
    {
        rotationCenter = Vector3D.Create(rotationCenter);
        rotationAxis = Vector3D.Create(rotationAxis);
        let rotationPlane = Plane.fromNormalAndPoint(rotationAxis, rotationCenter);
        let orthobasis = new OrthoNormalBasis(rotationPlane)
        let transformation = Matrix4x4.translation(rotationCenter.negated())
        transformation = transformation.multiply(orthobasis.getProjectionMatrix())
        transformation = transformation.multiply(Matrix4x4.rotationZ(degrees))
        transformation = transformation.multiply(orthobasis.getInverseProjectionMatrix())
        transformation = transformation.multiply(Matrix4x4.translation(rotationCenter))
        return transformation
    }

    // Create an affine matrix for translation:
    static translation(v: number[] | Vector3D)
    {
        // parse as Vector3D, so we can pass an array or a Vector3D
        let vec = Vector3D.Create(v);
        let els = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, vec.x, vec.y, vec.z, 1];
        return new Matrix4x4(els);
    }

    static mirroring(plane: Plane)
    {
        let nx = plane.normal.x;
        let ny = plane.normal.y;
        let nz = plane.normal.z;
        let w = plane.w;
        let els = [
            (1.0 - 2.0 * nx * nx), (-2.0 * ny * nx), (-2.0 * nz * nx), 0,
            (-2.0 * nx * ny), (1.0 - 2.0 * ny * ny), (-2.0 * nz * ny), 0,
            (-2.0 * nx * nz), (-2.0 * ny * nz), (1.0 - 2.0 * nz * nz), 0,
            (2.0 * nx * w), (2.0 * ny * w), (2.0 * nz * w), 1
        ]
        return new Matrix4x4(els)
    }

    static scaling(v: Vector3D)
    {
        let els = [v.x, 0, 0, 0, 0, v.y, 0, 0, 0, 0, v.z, 0, 0, 0, 0, 1]
        return new Matrix4x4(els)
    }
}
