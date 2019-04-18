import { Vector3D } from "./Vector3";

import { solve2Linear } from "../utils";
import { EPS } from "../constants";
import { Plane } from "./Plane";

// # class Line3D
// Represents a line in 3D space
// direction must be a unit vector
// point is a random point on the line
export class Line3D
{
    point: Vector3D;
    direction: Vector3D;
    constructor(point: Vector3D, direction: Vector3D)
    {
        point = Vector3D.Create(point);
        direction = Vector3D.Create(direction);
        this.point = point;
        this.direction = direction.unit();
    }

    intersectWithPlane(plane: Plane)
    {
        // plane: plane.normal * p = plane.w
        // line: p=line.point + labda * line.direction
        let labda =
            (plane.w - plane.normal.dot(this.point)) /
            plane.normal.dot(this.direction);
        let point = this.point.plus(this.direction.times(labda));
        return point;
    }

    clone()
    {
        return new Line3D(this.point.clone(), this.direction.clone());
    }

    reverse()
    {
        return new Line3D(this.point.clone(), this.direction.negated());
    }

    transform(matrix4x4)
    {
        let newpoint = this.point.multiply4x4(matrix4x4);
        let pointPlusDirection = this.point.plus(this.direction);
        let newPointPlusDirection = pointPlusDirection.multiply4x4(matrix4x4);
        let newdirection = newPointPlusDirection.minus(newpoint);
        return new Line3D(newpoint, newdirection);
    }

    closestPointOnLine(point: Vector3D)
    {
        let t = point.minus(this.point).dot(this.direction) / this.direction.dot(this.direction);
        let closestpoint = this.point.plus(this.direction.times(t));
        return closestpoint;
    }

    distanceToPoint(point: Vector3D)
    {
        let closestpoint = this.closestPointOnLine(point);
        let distancevector = point.minus(closestpoint);
        let distance = distancevector.length();
        return distance;
    }

    equals(line3d)
    {
        if (!this.direction.equals(line3d.direction)) return false;
        let distance = this.distanceToPoint(line3d.point);
        if (distance > EPS) return false;
        return true;
    }

    static fromPoints(p1, p2)
    {
        p1 = Vector3D.Create(p1);
        p2 = Vector3D.Create(p2);
        let direction = p2.minus(p1);
        return new Line3D(p1, direction);
    }

    static fromPlanes(p1, p2)
    {
        let direction = p1.normal.cross(p2.normal);
        let l = direction.length();
        if (l < EPS)
        {
            throw new Error("Parallel planes");
        }
        direction = direction.times(1.0 / l);

        let mabsx = Math.abs(direction.x);
        let mabsy = Math.abs(direction.y);
        let mabsz = Math.abs(direction.z);
        let origin: Vector3D;
        if (mabsx >= mabsy && mabsx >= mabsz)
        {
            // direction vector is mostly pointing towards x
            // find a point p for which x is zero:
            let r = solve2Linear(p1.normal.y, p1.normal.z, p2.normal.y, p2.normal.z, p1.w, p2.w);
            origin = new Vector3D(0, r[0], r[1]);
        } else if (mabsy >= mabsx && mabsy >= mabsz)
        {
            // find a point p for which y is zero:
            let r = solve2Linear(p1.normal.x, p1.normal.z, p2.normal.x, p2.normal.z, p1.w, p2.w);
            origin = new Vector3D(r[0], 0, r[1]);
        } else
        {
            // find a point p for which z is zero:
            let r = solve2Linear(p1.normal.x, p1.normal.y, p2.normal.x, p2.normal.y, p1.w, p2.w);
            origin = new Vector3D(r[0], r[1], 0);
        }
        return new Line3D(origin, direction);
    }
}
