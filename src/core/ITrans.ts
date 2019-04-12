import { Matrix4x4 } from "./math/Matrix4";
import { Vector3D } from "./math/Vector3";
import { Plane } from "./math/Plane";

export class CanTransformation
{
    transform(Matrix4x4: Matrix4x4)
    {
        return this;
    }
    mirrored(plane)
    {
        return this.transform(Matrix4x4.mirroring(plane));
    }

    mirroredX()
    {
        let plane = new Plane(new Vector3D(1, 0, 0), 0);
        return this.mirrored(plane);
    }

    mirroredY()
    {
        let plane = new Plane(new Vector3D(0, 1, 0), 0);
        return this.mirrored(plane);
    }

    mirroredZ()
    {
        let plane = new Plane(new Vector3D(0, 0, 1), 0);
        return this.mirrored(plane);
    }

    translate(v)
    {
        return this.transform(Matrix4x4.translation(v));
    }

    scale(f: Vector3D)
    {
        return this.transform(Matrix4x4.scaling(f));
    }

    rotateX(deg: number)
    {
        return this.transform(Matrix4x4.rotationX(deg));
    }

    rotateY(deg: number)
    {
        return this.transform(Matrix4x4.rotationY(deg));
    }

    rotateZ(deg: number)
    {
        return this.transform(Matrix4x4.rotationZ(deg));
    }

    rotate(rotationCenter, rotationAxis, degrees)
    {
        return this.transform(
            Matrix4x4.rotation(rotationCenter, rotationAxis, degrees)
        );
    }

    rotateEulerAngles(alpha, beta, gamma, position)
    {
        position = position || [0, 0, 0];

        let Rz1 = Matrix4x4.rotationZ(alpha);
        let Rx = Matrix4x4.rotationX(beta);
        let Rz2 = Matrix4x4.rotationZ(gamma);
        let T = Matrix4x4.translation(Vector3D.Create(position));

        return this.transform(
            Rz2.multiply(Rx)
                .multiply(Rz1)
                .multiply(T)
        );
    }
}
