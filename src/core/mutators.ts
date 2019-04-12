import { Matrix4x4 } from "./math/Matrix4";
import { Vector3D } from "./math/Vector3";
import { Plane } from "./math/Plane";


// Add several convenience methods to the classes that support a transform() method:
export const addTransformationMethodsToPrototype = prot =>
{
    prot.mirrored = function (plane)
    {
        return this.transform(Matrix4x4.mirroring(plane));
    };

    prot.mirroredX = function ()
    {
        let plane = new Plane(new Vector3D(1, 0, 0), 0);
        return this.mirrored(plane);
    };

    prot.mirroredY = function ()
    {
        let plane = new Plane(new Vector3D(0, 1, 0), 0);
        return this.mirrored(plane);
    };

    prot.mirroredZ = function ()
    {
        let plane = new Plane(new Vector3D(0, 0, 1), 0);
        return this.mirrored(plane);
    };

    prot.translate = function (v)
    {
        return this.transform(Matrix4x4.translation(v));
    };

    prot.scale = function (f)
    {
        return this.transform(Matrix4x4.scaling(f));
    };

    prot.rotateX = function (deg)
    {
        return this.transform(Matrix4x4.rotationX(deg));
    };

    prot.rotateY = function (deg)
    {
        return this.transform(Matrix4x4.rotationY(deg));
    };

    prot.rotateZ = function (deg)
    {
        return this.transform(Matrix4x4.rotationZ(deg));
    };

    prot.rotate = function (rotationCenter, rotationAxis, degrees)
    {
        return this.transform(
            Matrix4x4.rotation(rotationCenter, rotationAxis, degrees)
        );
    };

    prot.rotateEulerAngles = function (alpha, beta, gamma, position)
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
    };
};

// TODO: consider generalization and adding to addTransformationMethodsToPrototype
export const addCenteringToPrototype = (prot, axes) =>
{
    prot.center = function (cAxes)
    {
        cAxes = Array.prototype.map.call(arguments, a =>
        {
            return a; // .toLowerCase();
        });
        // no args: center on all axes
        if (!cAxes.length)
        {
            cAxes = axes.slice();
        }
        let b = this.getBounds();
        return this.translate(
            axes.map(a =>
            {
                return cAxes.indexOf(a) > -1 ? -(b[0][a] + b[1][a]) / 2 : 0;
            })
        );
    };
};
