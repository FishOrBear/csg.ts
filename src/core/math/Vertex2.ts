import { getTag } from "../constants";
import { Vector2D } from "./Vector2";

export class Vertex2D
{
  tag: any;
  pos: Vector2D;
  constructor(pos: Vector2D)
  {
    this.pos = pos;
  }

  toString()
  {
    return '(' + this.pos.x.toFixed(5) + ',' + this.pos.y.toFixed(5) + ')'
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

  static fromObject(obj)
  {
    return new Vertex2D(new Vector2D(obj.pos._x, obj.pos._y))
  }
}
