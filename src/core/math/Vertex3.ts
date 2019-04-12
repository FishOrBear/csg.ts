import { getTag } from "../constants";
import { Vector3D } from "./Vector3";

// # class Vertex
// Represents a vertex of a polygon. Use your own vertex class instead of this
// one to provide additional features like texture coordinates and vertex
// colors. Custom vertex classes need to provide a `pos` property
// `flipped()`, and `interpolate()` methods that behave analogous to the ones
// FIXME: And a lot MORE (see plane.fromVector3Ds for ex) ! This is fragile code
// defined by `Vertex`.
export class Vertex3D
{
  tag: number;
  constructor(public pos: Vector3D)
  {
  }

  // Return a vertex with all orientation-specific data (e.g. vertex normal) flipped. Called when the
  // orientation of a polygon is flipped.
  flipped()
  {
    return this
  }

  getTag()
  {
    let result = this.tag;
    if (!result)
    {
      result = getTag()
      this.tag = result
    }
    return result
  }

  // Create a new vertex between this vertex and `other` by linearly
  // interpolating all properties using a parameter of `t`. Subclasses should
  // override this to interpolate additional properties.

  interpolate(other, t)
  {
    const newpos = this.pos.lerp(other.pos, t);
    return new Vertex3D(newpos)
  }

  // Affine transformation of vertex. Returns a new Vertex

  transform(matrix4x4)
  {
    const newpos = this.pos.multiply4x4(matrix4x4);
    return new Vertex3D(newpos)
  }

  toString()
  {
    return this.pos.toString();
  }

  // create from an untyped object with identical property names:
  static fromObject(obj)
  {
    const pos = Vector3D.Create(obj.pos);
    return new Vertex3D(pos)
  }
}
