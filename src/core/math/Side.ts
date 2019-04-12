import { Vertex2D } from "./Vertex2";
import { Vertex3D } from "./Vertex3";
import { Polygon } from "./Polygon3";
import { getTag } from "../constants";
import { Vector2D } from "./Vector2";

export class Side 
{
  private tag: number;
  constructor(
    public vertex0: Vertex2D,
    public vertex1: Vertex2D
  )
  {

  }

  toString()
  {
    return this.vertex0.toString() + ' -> ' + this.vertex1.toString();
  }

  toPolygon3D(z0, z1)
  {
    // console.log(this.vertex0.pos)
    const vertices = [
      new Vertex3D(this.vertex0.pos.toVector3D(z0)),
      new Vertex3D(this.vertex1.pos.toVector3D(z0)),
      new Vertex3D(this.vertex1.pos.toVector3D(z1)),
      new Vertex3D(this.vertex0.pos.toVector3D(z1))
    ]
    return new Polygon(vertices)
  }

  transform(matrix4x4)
  {
    const newp1 = this.vertex0.pos.transform(matrix4x4);
    const newp2 = this.vertex1.pos.transform(matrix4x4);
    return new Side(new Vertex2D(newp1), new Vertex2D(newp2))
  }

  flipped()
  {
    return new Side(this.vertex1, this.vertex0)
  }

  direction()
  {
    return this.vertex1.pos.minus(this.vertex0.pos)
  }

  getTag()
  {
    let result = this.tag;;
    if (!result)
    {
      result = getTag();
      this.tag = result;
    }
    return result;
  }

  lengthSquared()
  {
    let x = this.vertex1.pos.x - this.vertex0.pos.x
    let y = this.vertex1.pos.y - this.vertex0.pos.y
    return x * x + y * y
  }

  length()
  {
    return Math.sqrt(this.lengthSquared())
  }

  static fromObject(obj)
  {
    const vertex0 = Vertex2D.fromObject(obj.vertex0);
    const vertex1 = Vertex2D.fromObject(obj.vertex1);
    return new Side(vertex0, vertex1)
  }

  static _fromFakePolygon(polygon)
  {
    // this can happen based on union, seems to be residuals -
    // return null and handle in caller
    if (polygon.vertices.length < 4)
    {
      return null
    }
    const vert1Indices = [];
    const pts2d = polygon.vertices.filter((v, i) =>
    {
      if (v.pos.z > 0)
      {
        vert1Indices.push(i)
        return true
      }
      return false
    })
      .map(v =>
      {
        return new Vector2D(v.pos.x, v.pos.y)
      });
    if (pts2d.length !== 2)
    {
      throw new Error('Assertion failed: _fromFakePolygon: not enough points found')
    }
    const d = vert1Indices[1] - vert1Indices[0];
    if (d === 1 || d === 3)
    {
      if (d === 1)
      {
        pts2d.reverse()
      }
    } else
    {
      throw new Error('Assertion failed: _fromFakePolygon: unknown index ordering')
    }
    const result = new Side(new Vertex2D(pts2d[0]), new Vertex2D(pts2d[1]));
    return result
  }
}
