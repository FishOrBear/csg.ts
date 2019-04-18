import { EPS, _CSGDEBUG } from "./constants";
import { Plane } from "./math/Plane";
import { Polygon } from "./math/Polygon3";
import { Vector3D } from "./math/Vector3";
import { Vertex3D } from "./math/Vertex3";

enum Type
{
    CoplanarFront = 0,
    CoplanarBack = 1,
    Front = 2,
    Back = 3,
    Spanning = 4,
}

// Returns object:
// .type:
//   0: coplanar-front
//   1: coplanar-back
//   2: front
//   3: back
//   4: spanning
// In case the polygon is spanning, returns:
// .front: a Polygon of the front part
// .back: a Polygon of the back part
interface SplitPolygonData
{
    type: Type;
    front: Polygon;
    back: Polygon;
}
function splitPolygonByPlane(plane: Plane, polygon: Polygon): SplitPolygonData
{
    let result: SplitPolygonData = { type: null, front: null, back: null };
    // cache in local lets (speedup):
    let planeNormal = plane.normal;
    let vertices = polygon.vertices;
    let numVertices = vertices.length;
    if (polygon.plane.equals(plane))
    {
        result.type = Type.CoplanarFront;
    }
    else
    {
        let thisW = plane.w;
        let hasFront = false;
        let hasBack = false;
        let vertexIsBack: boolean[] = [];
        let MINEPS = -EPS;
        for (let i = 0; i < numVertices; i++)
        {
            let t = planeNormal.dot(vertices[i].pos) - thisW;
            let isBack = t < 0;
            vertexIsBack.push(isBack);
            if (t > EPS) hasFront = true;
            if (t < MINEPS) hasBack = true;
        }
        if (!hasFront && !hasBack)
        {
            // all points coplanar
            let t = planeNormal.dot(polygon.plane.normal);
            result.type = t >= 0 ? Type.CoplanarFront : Type.CoplanarBack;
        }
        else if (!hasBack)
            result.type = Type.Front;
        else if (!hasFront)
            result.type = Type.Back;
        else
        {
            result.type = Type.Spanning;
            let frontVertices: Vertex3D[] = [];
            let backVertices: Vertex3D[] = [];
            let isBack = vertexIsBack[0];
            for (
                let vertexIndex = 0;
                vertexIndex < numVertices;
                vertexIndex++
            )
            {
                let vertex = vertices[vertexIndex];
                let nextVertexindex = vertexIndex + 1;
                if (nextVertexindex >= numVertices) nextVertexindex = 0;
                let nextIsBack = vertexIsBack[nextVertexindex];
                if (isBack === nextIsBack)
                {
                    // line segment is on one side of the plane:
                    if (isBack)
                        backVertices.push(vertex);
                    else
                        frontVertices.push(vertex);
                }
                else
                {
                    // line segment intersects plane:
                    let point = vertex.pos;
                    let nextPoint = vertices[nextVertexindex].pos;
                    let intersectionPoint = plane.splitLineBetweenPoints(point, nextPoint);
                    let intersectionVertex = new Vertex3D(intersectionPoint);
                    if (isBack)
                    {
                        backVertices.push(vertex);
                        backVertices.push(intersectionVertex);
                        frontVertices.push(intersectionVertex);
                    }
                    else
                    {
                        frontVertices.push(vertex);
                        frontVertices.push(intersectionVertex);
                        backVertices.push(intersectionVertex);
                    }
                }
                isBack = nextIsBack;
            } // for vertexindex
            // remove duplicate vertices:
            let EPS_SQUARED = EPS * EPS;
            if (backVertices.length >= 3)
            {
                //删除重复的点
                let prevVertex = backVertices[backVertices.length - 1];
                for (
                    let vertexindex = 0;
                    vertexindex < backVertices.length;
                    vertexindex++
                )
                {
                    let vertex = backVertices[vertexindex];
                    if (vertex.pos.distanceToSquared(prevVertex.pos) < EPS_SQUARED)
                    {
                        backVertices.splice(vertexindex, 1);
                        vertexindex--;
                    }
                    prevVertex = vertex;
                }
            }
            if (frontVertices.length >= 3)
            {
                let prevVertex = frontVertices[frontVertices.length - 1];
                //删除重复的点
                for (
                    let vertexIndex = 0;
                    vertexIndex < frontVertices.length;
                    vertexIndex++
                )
                {
                    let vertex = frontVertices[vertexIndex];
                    if (vertex.pos.distanceToSquared(prevVertex.pos) < EPS_SQUARED)
                    {
                        frontVertices.splice(vertexIndex, 1);
                        vertexIndex--;
                    }
                    prevVertex = vertex;
                }
            }
            if (frontVertices.length >= 3)
                result.front = new Polygon(frontVertices, polygon.shared, polygon.plane);
            if (backVertices.length >= 3)
                result.back = new Polygon(backVertices, polygon.shared, polygon.plane);
        }
    }
    return result;
}

// # class PolygonTreeNode
// This class manages hierarchical splits of polygons
// At the top is a root node which doesn hold a polygon, only child PolygonTreeNodes
// Below that are zero or more 'top' nodes; each holds a polygon. The polygons can be in different planes
// splitByPlane() splits a node by a plane. If the plane intersects the polygon, two new child nodes
// are created holding the splitted polygon.
// getPolygons() retrieves the polygon from the tree. If for PolygonTreeNode the polygon is split but
// the two split parts (child nodes) are still intact, then the unsplit polygon is returned.
// This ensures that we can safely split a polygon into many fragments. If the fragments are untouched,
//  getPolygons() will return the original unsplit polygon instead of the fragments.
// remove() removes a polygon from the tree. Once a polygon is removed, the parent polygons are invalidated
// since they are no longer intact.
// constructor creates the root node:
class PolygonTreeNode
{
    parent: PolygonTreeNode;
    children: PolygonTreeNode[] = [];
    polygon: Polygon;
    removed: boolean = false;
    constructor() { }

    // fill the tree with polygons. Should be called on the root node only; child nodes must
    // always be a derivate (split) of the parent node.
    addPolygons(polygons: Polygon[])
    {
        // new polygons can only be added to root node; children can only be splitted polygons
        if (!this.isRootNode())
            throw new Error("Assertion failed");

        for (let polygon of polygons)
            this.addChild(polygon);
    }

    // remove a node
    // - the siblings become toplevel nodes
    // - the parent is removed recursively

    remove()
    {
        if (this.removed) return;

        this.removed = true;

        if (_CSGDEBUG)
        {
            if (this.isRootNode()) throw new Error("Assertion failed"); // can't remove root node
            if (this.children.length) throw new Error("Assertion failed"); // we shouldn't remove nodes with children
        }

        // remove ourselves from the parent's children list:
        let parentschildren = this.parent.children;
        let i = parentschildren.indexOf(this);
        if (i < 0) throw new Error("Assertion failed");
        parentschildren.splice(i, 1);

        // invalidate the parent's polygon, and of all parents above it:
        this.parent.recursivelyInvalidatePolygon();
    }

    isRemoved()
    {
        return this.removed;
    }

    isRootNode()
    {
        return !this.parent;
    }

    // invert all polygons in the tree. Call on the root node

    invert()
    {
        if (!this.isRootNode()) throw new Error("Assertion failed"); // can only call this on the root node
        this.invertSub();
    }

    getPolygon(): Polygon
    {
        if (!this.polygon) throw new Error("Assertion failed"); // doesn't have a polygon, which means that it has been broken down
        return this.polygon;
    }

    getPolygons(outPolygons: Polygon[] = []): Polygon[]
    {
        let children: PolygonTreeNode[] = [this];
        let queue = [children];
        for (let i = 0; i < queue.length; ++i)
        {
            // queue size can change in loop, don't cache length
            children = queue[i];
            for (let j = 0, l = children.length; j < l; j++)
            {
                // ok to cache length
                let node = children[j];
                if (node.polygon)
                    // the polygon hasn't been broken yet. We can ignore the children and return our polygon:
                    outPolygons.push(node.polygon);
                else
                    // our polygon has been split up and broken, so gather all subpolygons from the children
                    queue.push(node.children);
            }
        }

        return outPolygons;
    }

    // split the node by a plane; add the resulting nodes to the frontnodes and backnodes array
    // If the plane doesn't intersect the polygon, the 'this' object is added to one of the arrays
    // If the plane does intersect the polygon, two new child nodes are created for the front and back fragments,
    //  and added to both arrays.

    splitByPlane(
        plane: Plane,
        coplanarFrontNodes: PolygonTreeNode[],
        coplanarBackNodes: PolygonTreeNode[],
        frontNodes: PolygonTreeNode[],
        backNodes: PolygonTreeNode[]
    )
    {
        if (this.children.length)
        {
            let queue = [this.children];
            for (let i = 0; i < queue.length; i++)
            {
                // queue.length can increase, do not cache
                let nodes = queue[i];
                for (let j = 0, l = nodes.length; j < l; j++)
                {
                    // ok to cache length
                    let node = nodes[j];
                    if (node.children.length)
                        queue.push(node.children);
                    else
                    {
                        // no children. Split the polygon:
                        node.splitByPlaneNotChildren(plane, coplanarFrontNodes, coplanarBackNodes, frontNodes, backNodes);
                    }
                }
            }
        }
        else
        {
            this.splitByPlaneNotChildren(plane, coplanarFrontNodes, coplanarBackNodes, frontNodes, backNodes);
        }
    }

    // only to be called for nodes with no children
    // 仅用于没有子节点的节点
    private splitByPlaneNotChildren(
        plane: Plane,
        coplanarFrontNodes: PolygonTreeNode[],
        coplanarBackNodes: PolygonTreeNode[],
        frontNodes: PolygonTreeNode[],
        backNodes: PolygonTreeNode[]
    )
    {
        if (!this.polygon) return;

        let polygon = this.polygon;
        let bound = polygon.boundingSphere();
        let sphereradius = bound[1] + EPS; // FIXME Why add imprecision?
        let planenormal = plane.normal;
        let spherecenter = bound[0];
        let d = planenormal.dot(spherecenter) - plane.w;
        if (d > sphereradius)
            frontNodes.push(this);
        else if (d < -sphereradius)
            backNodes.push(this);
        else
        {
            let splitresult = splitPolygonByPlane(plane, polygon);
            switch (splitresult.type)
            {
                case Type.CoplanarFront:
                    coplanarFrontNodes.push(this);
                    break;

                case Type.CoplanarBack:
                    coplanarBackNodes.push(this);
                    break;

                case Type.Front:
                    frontNodes.push(this);
                    break;

                case Type.Back:
                    backNodes.push(this);
                    break;

                case Type.Spanning:
                    if (splitresult.front)
                    {
                        let frontNode = this.addChild(splitresult.front);
                        frontNodes.push(frontNode);
                    }
                    if (splitresult.back)
                    {
                        let backNode = this.addChild(splitresult.back);
                        backNodes.push(backNode);
                    }
                    break;
            }
        }
    }

    // add child to a node
    // this should be called whenever the polygon is split
    // a child should be created for every fragment of the split polygon
    // returns the newly created child
    addChild(polygon: Polygon): PolygonTreeNode
    {
        let newchild = new PolygonTreeNode();
        newchild.parent = this;
        newchild.polygon = polygon;
        this.children.push(newchild);
        return newchild;
    }

    invertSub()
    {
        let queue: PolygonTreeNode[][] = [[this]];
        for (let i = 0; i < queue.length; i++)
        {
            let children = queue[i];
            for (let j = 0, l = children.length; j < l; j++)
            {
                let node = children[j];
                if (node.polygon)
                    node.polygon = node.polygon.flipped();
                queue.push(node.children);
            }
        }
    }

    recursivelyInvalidatePolygon()
    {
        let node: PolygonTreeNode = this;
        while (node.polygon)
        {
            node.polygon = null;
            if (node.parent)
                node = node.parent;
        }
    }
}

// # class Tree
// This is the root of a BSP tree
// We are using this separate class for the root of the tree, to hold the PolygonTreeNode root
// The actual tree is kept in this.rootnode
export class Tree
{
    polygonTree = new PolygonTreeNode();
    rootNode = new Node(null);
    constructor(polygons: Polygon[])
    {
        this.addPolygons(polygons);
    }

    invert()
    {
        this.polygonTree.invert();
        this.rootNode.invert();
    }

    // Remove all polygons in this BSP tree that are inside the other BSP tree
    // `tree`. const
    //this 减去 tree   删除此BSP树中位于其他BSP树内的所有多边形
    clipTo(tree: Tree, alsoRemovecoplanarFront = false)
    {
        this.rootNode.clipTo(tree, alsoRemovecoplanarFront);
    }

    allPolygons()
    {
        return this.polygonTree.getPolygons();
    }

    addPolygons(polygons: Polygon[])
    {
        let polygonTreeNodes = polygons.map((p) => this.polygonTree.addChild(p));
        this.rootNode.addPolygonTreeNodes(polygonTreeNodes);
    }
}

// # class Node
// Holds a node in a BSP tree. A BSP tree is built from a collection of polygons
// by picking a polygon to split along.
// Polygons are not stored directly in the tree, but in PolygonTreeNodes, stored in
// this.polygontreenodes. Those PolygonTreeNodes are children of the owning
// Tree.polygonTree
// This is not a leafy BSP tree since there is
// no distinction between internal and leaf nodes.
class Node
{
    plane: Plane;
    front: Node;
    back: Node;
    polygonTreeNodes: PolygonTreeNode[] = [];
    parent: Node;
    constructor(parent: Node)
    {
        this.parent = parent;
    }

    // Convert solid space to empty space and empty space to solid space.
    invert()
    {
        let queue: Node[] = [this];
        for (let i = 0; i < queue.length; i++)
        {
            let node = queue[i];
            if (node.plane) node.plane = node.plane.flipped();
            if (node.front) queue.push(node.front);
            if (node.back) queue.push(node.back);
            let temp = node.front;
            node.front = node.back;
            node.back = temp;
        }
    }

    // clip polygontreenodes to our plane
    // calls remove() for all clipped PolygonTreeNodes
    //将polygontreenodes剪辑到我们的飞机上
    //为所有剪切的PolygonTreeNodes调用remove（）
    clipPolygons(polygonTreeNodes: PolygonTreeNode[], alsoRemoveCoplanarFront: boolean)
    {
        interface D
        {
            node: Node;
            polygonTreeNodes: PolygonTreeNode[];
        }

        let args: D = { node: this, polygonTreeNodes };
        let stack: D[] = [];

        do
        {
            let node = args.node;
            let polygonTreeNodes = args.polygonTreeNodes;

            // begin "function"
            if (node.plane)
            {
                let backnodes: PolygonTreeNode[] = [];
                let frontnodes: PolygonTreeNode[] = [];
                let coplanarfrontnodes = alsoRemoveCoplanarFront ? backnodes : frontnodes;
                let plane = node.plane;
                for (let node1 of polygonTreeNodes)
                {
                    if (!node1.isRemoved())
                        node1.splitByPlane(plane, coplanarfrontnodes, backnodes, frontnodes, backnodes);
                }

                if (node.front && frontnodes.length > 0)
                    stack.push({ node: node.front, polygonTreeNodes: frontnodes });

                let numbacknodes = backnodes.length;
                if (node.back && numbacknodes > 0)
                    stack.push({ node: node.back, polygonTreeNodes: backnodes });
                else
                {
                    // there's nothing behind this plane. Delete the nodes behind this plane:
                    // 这架飞机背后什么也没有。 删除此平面后面的节点：
                    for (let i = 0; i < numbacknodes; i++)
                        backnodes[i].remove();
                }
            }
            args = stack.pop();
        }
        while (args);
    }

    // Remove all polygons in this BSP tree that are inside the other BSP tree
    // `tree`.

    clipTo(tree: Tree, alsoRemovecoplanarFront: boolean)
    {
        let node: Node = this;
        let stack: Node[] = [];
        do
        {
            if (node.polygonTreeNodes.length > 0)
            {
                tree.rootNode.clipPolygons(
                    node.polygonTreeNodes,
                    alsoRemovecoplanarFront
                );
            }
            if (node.front) stack.push(node.front);
            if (node.back) stack.push(node.back);
            node = stack.pop();
        }
        while (node);
    }

    addPolygonTreeNodes(polygonTreeNodes: PolygonTreeNode[])
    {
        interface D
        {
            node: Node;
            polygontreenodes: PolygonTreeNode[];
        }
        let args: D = { node: this, polygontreenodes: polygonTreeNodes };
        let stack: D[] = [];
        do
        {
            let node = args.node;
            polygonTreeNodes = args.polygontreenodes;

            if (polygonTreeNodes.length === 0)
            {
                args = stack.pop();
                continue;
            }
            if (!node.plane)
            {
                let bestplane = polygonTreeNodes[0].getPolygon().plane;
                node.plane = bestplane;
            }
            let frontNodes: PolygonTreeNode[] = [];
            let backNodes: PolygonTreeNode[] = [];

            for (let i = 0, n = polygonTreeNodes.length; i < n; ++i)
            {
                polygonTreeNodes[i].splitByPlane(
                    node.plane,
                    node.polygonTreeNodes,
                    backNodes,
                    frontNodes,
                    backNodes
                );
            }

            if (frontNodes.length > 0)
            {
                if (!node.front) node.front = new Node(node);
                stack.push({ node: node.front, polygontreenodes: frontNodes });
            }
            if (backNodes.length > 0)
            {
                if (!node.back) node.back = new Node(node);
                stack.push({ node: node.back, polygontreenodes: backNodes });
            }

            args = stack.pop();
        }
        while (args);
    }

    getParentPlaneNormals(normals: Vector3D[], maxdepth: number)
    {
        if (maxdepth > 0)
        {
            if (this.parent)
            {
                normals.push(this.parent.plane.normal);
                this.parent.getParentPlaneNormals(normals, maxdepth - 1);
            }
        }
    }
}
