import { EPS } from "../constants";
import { fnNumberSort, insertSorted, interpolateBetween2DPointsForY } from "../utils";
import { Line2D } from "./Line2";
import { OrthoNormalBasis } from "./OrthoNormalBasis";
import { Polygon } from "./Polygon3";
import { Vector2D } from "./Vector2";
import { Vertex3D } from "./Vertex3";

//在这个文件中 Top    表示的是 y最小.
//            Bottom 表示的是 y最大

interface ActivePolygon
{
    polygonindex: number;
    leftvertexindex: number;
    rightvertexindex: number;

    topleft: Vector2D;
    bottomleft: Vector2D;

    topright: Vector2D,
    bottomright: Vector2D
}


//一组共面多边形的Retesselation函数。 请参阅此文件顶部的介绍。
export function reTesselateCoplanarPolygons(sourcePolygons: Polygon[], destpolygons: Polygon[])
{
    let numPolygons = sourcePolygons.length;
    if (numPolygons === 0)
        return;

    let plane = sourcePolygons[0].plane;
    let shared = sourcePolygons[0].shared;
    let orthobasis = new OrthoNormalBasis(plane);

    // let xcoordinatebins = {}
    let yCoordinateBins: { [key: number]: number } = {}   //整数map
    let yCoordinateBinningFactor = 1.0 / EPS * 10

    let polygonVertices2d: (Vector2D[])[] = []           // (Vector2[])[];
    let polygonTopVertexIndexes: number[] = []     // 每个多边形最顶层顶点的索引数组 minIndex
    let topY2PolygonIndexes: { [key: number]: number[] } = {}         // Map<minY,polygonIndex[]>
    let yCoordinateToPolygonIndexes: { [key: string]: { [key: number]: boolean } } = {} // Map<Y,Map<polygonIndex,boole> >           Y坐标映射所有的多边形

    //将多边形转换为2d点表   polygonVertices2d
    //建立y对应的多边形Map   yCoordinateToPolygonIndexes
    for (let polygonIndex = 0; polygonIndex < numPolygons; polygonIndex++)
    {
        let poly3d = sourcePolygons[polygonIndex];
        let numVertices = poly3d.vertices.length;

        if (numVertices === 0)
            continue;

        let vertices2d: Vector2D[] = []  //Vector2d[];
        let minIndex = -1;
        let miny: number, maxy: number;
        for (let i = 0; i < numVertices; i++)
        {
            let pos2d = orthobasis.to2D(poly3d.vertices[i].pos);
            // perform binning of y coordinates: If we have multiple vertices very
            // close to each other, give them the same y coordinate:
            let yCoordinatebin = Math.floor(pos2d.y * yCoordinateBinningFactor);
            let newy: number;
            if (yCoordinatebin in yCoordinateBins)
                newy = yCoordinateBins[yCoordinatebin];
            else if (yCoordinatebin + 1 in yCoordinateBins)
                newy = yCoordinateBins[yCoordinatebin + 1];
            else if (yCoordinatebin - 1 in yCoordinateBins)
                newy = yCoordinateBins[yCoordinatebin - 1];
            else
            {
                newy = pos2d.y;
                yCoordinateBins[yCoordinatebin] = pos2d.y;
            }
            pos2d = Vector2D.Create(pos2d.x, newy);
            vertices2d.push(pos2d);
            if ((i === 0) || (newy < miny))
            {
                miny = newy;
                minIndex = i;
            }
            if ((i === 0) || (newy > maxy))
                maxy = newy;

            if (!(newy in yCoordinateToPolygonIndexes))
                yCoordinateToPolygonIndexes[newy] = {};

            yCoordinateToPolygonIndexes[newy][polygonIndex] = true;
        }

        //退化多边形，所有顶点都具有相同的y坐标。 从现在开始忽略它：
        if (miny >= maxy)
            continue;

        if (!(miny in topY2PolygonIndexes))
            topY2PolygonIndexes[miny] = [];

        topY2PolygonIndexes[miny].push(polygonIndex);

        // reverse the vertex order:
        vertices2d.reverse();
        minIndex = numVertices - minIndex - 1;
        polygonVertices2d.push(vertices2d);
        polygonTopVertexIndexes.push(minIndex);
    }

    //所有的y坐标,从小到大排序
    let yCoordinates: string[] = [];
    for (let ycoordinate in yCoordinateToPolygonIndexes)
        yCoordinates.push(ycoordinate);
    yCoordinates.sort(fnNumberSort);

    //迭代y坐标 从低到高

    // activepolygons ：'active'的源多边形，即与y坐标相交
    // 多边形是从左往右排序的
    // activepolygons 中的每个元素都具有以下属性：
    //      polygonindex         源多边形的索引（即sourcepolygons的索引 和polygonvertices2d数组）
    //      leftvertexindex      左边 在当前y坐标处或刚好在当前y坐标之上
    //      rightvertexindex     右边
    //      topleft bottomleft   与当前y坐标交叉的多边形左侧的坐标
    //      topright bottomright 与当前y坐标交叉的多边形右侧的坐标

    let activePolygons: ActivePolygon[] = [];    //polygon[]
    let prevOutPolygonRow = []; //上一个外部多边形行?
    for (let yindex = 0; yindex < yCoordinates.length; yindex++)
    {
        let ycoordinate_as_string = yCoordinates[yindex];
        let yCoordinate = Number(ycoordinate_as_string);

        // 用当前的y 更新 activepolygons
        //  - 删除以y坐标结尾的所有多边形  删除polygon maxy = y 的多边形
        //  - 更新 leftvertexindex 和 rightvertexindex （指向当前顶点索引）
        //    在多边形的左侧和右侧

        // 迭代在Y坐标处有一个角的所有多边形
        let polygonIndexeSwithCorner = yCoordinateToPolygonIndexes[ycoordinate_as_string];
        for (let activePolygonIndex = 0; activePolygonIndex < activePolygons.length; ++activePolygonIndex)
        {
            let activepolygon = activePolygons[activePolygonIndex];
            let polygonindex = activepolygon.polygonindex;

            if (!polygonIndexeSwithCorner[polygonindex])//如果不在角内
                continue;

            //多边形在此y坐标处有一个角
            let vertices2d = polygonVertices2d[polygonindex];
            let numvertices = vertices2d.length;
            let newleftvertexindex = activepolygon.leftvertexindex;
            let newrightvertexindex = activepolygon.rightvertexindex;

            //看看我们是否需要增加 leftvertexindex 或减少 rightvertexindex ：
            while (true)
            {
                let nextleftvertexindex = newleftvertexindex + 1;
                if (nextleftvertexindex >= numvertices) nextleftvertexindex = 0;
                if (vertices2d[nextleftvertexindex].y !== yCoordinate) break;
                newleftvertexindex = nextleftvertexindex;
            }
            //减少 rightvertexindex
            let nextrightvertexindex = newrightvertexindex - 1;
            if (nextrightvertexindex < 0)
                nextrightvertexindex = numvertices - 1;
            if (vertices2d[nextrightvertexindex].y === yCoordinate)
                newrightvertexindex = nextrightvertexindex;

            if ((newleftvertexindex !== activepolygon.leftvertexindex) //有向上更新
                && (newleftvertexindex === newrightvertexindex))
            {     //指向同一个点
                // We have increased leftvertexindex or decreased rightvertexindex, and now they point to the same vertex
                // This means that this is the bottom point of the polygon. We'll remove it:
                //我们增加了leftvertexindex或减少了rightvertexindex，现在它们指向同一个顶点
                //这意味着这是多边形的底点。 我们将删除它：
                activePolygons.splice(activePolygonIndex, 1);
                --activePolygonIndex;
            }
            else
            {
                activepolygon.leftvertexindex = newleftvertexindex;
                activepolygon.rightvertexindex = newrightvertexindex;
                activepolygon.topleft = vertices2d[newleftvertexindex];
                activepolygon.topright = vertices2d[newrightvertexindex];
                let nextleftvertexindex = newleftvertexindex + 1;
                if (nextleftvertexindex >= numvertices) nextleftvertexindex = 0;
                activepolygon.bottomleft = vertices2d[nextleftvertexindex];
                let nextrightvertexindex = newrightvertexindex - 1;
                if (nextrightvertexindex < 0) nextrightvertexindex = numvertices - 1;
                activepolygon.bottomright = vertices2d[nextrightvertexindex];
            }
        }

        let nextYCoordinate: number; // number y
        if (yindex >= yCoordinates.length - 1)
        {
            // last row, all polygons must be finished here:
            // 最后一行，所有多边形必须在这里完成：
            activePolygons = [];
        }
        else // yindex < ycoordinates.length-1
        {
            nextYCoordinate = Number(yCoordinates[yindex + 1]);
            let middleYCoordinate = 0.5 * (yCoordinate + nextYCoordinate);
            // update activepolygons by adding any polygons that start here:
            // 添加从这里开始的多边形 到 activePolygons
            let startingPolygonIndexes = topY2PolygonIndexes[ycoordinate_as_string];
            for (let polygonindex_key in startingPolygonIndexes)
            {
                let polygonindex = startingPolygonIndexes[polygonindex_key];
                let vertices2d = polygonVertices2d[polygonindex];
                let numvertices = vertices2d.length;
                let topVertexIndex = polygonTopVertexIndexes[polygonindex];
                // the top of the polygon may be a horizontal line. In that case topvertexindex can point to any point on this line.
                // Find the left and right topmost vertices which have the current y coordinate:
                // 顶部可以是一条直线,寻找最左边的点和最右边的点
                let topleftvertexindex = topVertexIndex;
                while (true)
                {
                    let i = topleftvertexindex + 1;
                    if (i >= numvertices) i = 0;
                    if (vertices2d[i].y !== yCoordinate) break;
                    if (i === topVertexIndex) break; // should not happen, but just to prevent endless loops
                    topleftvertexindex = i;
                }
                let toprightvertexindex = topVertexIndex;
                while (true)
                {
                    let i = toprightvertexindex - 1;
                    if (i < 0) i = numvertices - 1;
                    if (vertices2d[i].y !== yCoordinate) break;
                    if (i === topleftvertexindex) break; // should not happen, but just to prevent endless loops
                    toprightvertexindex = i;
                }

                let nextleftvertexindex = topleftvertexindex + 1;
                if (nextleftvertexindex >= numvertices) nextleftvertexindex = 0;
                let nextrightvertexindex = toprightvertexindex - 1;
                if (nextrightvertexindex < 0) nextrightvertexindex = numvertices - 1;
                let newactivepolygon: ActivePolygon = {
                    polygonindex: polygonindex,
                    leftvertexindex: topleftvertexindex,
                    rightvertexindex: toprightvertexindex,
                    topleft: vertices2d[topleftvertexindex],
                    topright: vertices2d[toprightvertexindex],
                    bottomleft: vertices2d[nextleftvertexindex],
                    bottomright: vertices2d[nextrightvertexindex]
                }

                //二分插入
                insertSorted(activePolygons, newactivepolygon, function (el1, el2)
                {
                    let x1 = interpolateBetween2DPointsForY(
                        el1.topleft, el1.bottomleft, middleYCoordinate);
                    let x2 = interpolateBetween2DPointsForY(
                        el2.topleft, el2.bottomleft, middleYCoordinate);
                    if (x1 > x2) return 1;
                    if (x1 < x2) return -1;
                    return 0;
                })
            }
        }

        //#region
        // if( (yindex === ycoordinates.length-1) || (nextycoordinate - ycoordinate > EPS) )
        // if(true)
        // {

        let newOutPolygonRow = [];   //输出多边形

        // Build the output polygons for the next row in newOutPolygonRow:
        //现在 activepolygons 是最新的
        //为 newOutPolygonRow 中的下一行构建输出多边形：
        for (let activepolygonKey in activePolygons)
        {
            let activepolygon = activePolygons[activepolygonKey];

            let x = interpolateBetween2DPointsForY(activepolygon.topleft, activepolygon.bottomleft, yCoordinate)
            let topleft = Vector2D.Create(x, yCoordinate)
            x = interpolateBetween2DPointsForY(activepolygon.topright, activepolygon.bottomright, yCoordinate)
            let topright = Vector2D.Create(x, yCoordinate)
            x = interpolateBetween2DPointsForY(activepolygon.topleft, activepolygon.bottomleft, nextYCoordinate)
            let bottomleft = Vector2D.Create(x, nextYCoordinate)
            x = interpolateBetween2DPointsForY(activepolygon.topright, activepolygon.bottomright, nextYCoordinate)
            let bottomright = Vector2D.Create(x, nextYCoordinate)
            let outPolygon = {
                topleft: topleft,
                topright: topright,
                bottomleft: bottomleft,
                bottomright: bottomright,
                leftline: Line2D.fromPoints(topleft, bottomleft),
                rightline: Line2D.fromPoints(bottomright, topright)
            }

            if (newOutPolygonRow.length > 0)
            {
                let prevoutpolygon = newOutPolygonRow[newOutPolygonRow.length - 1]
                let d1 = outPolygon.topleft.distanceTo(prevoutpolygon.topright)
                let d2 = outPolygon.bottomleft.distanceTo(prevoutpolygon.bottomright)
                if ((d1 < EPS) && (d2 < EPS))
                {
                    // we can join this polygon with the one to the left:
                    outPolygon.topleft = prevoutpolygon.topleft
                    outPolygon.leftline = prevoutpolygon.leftline
                    outPolygon.bottomleft = prevoutpolygon.bottomleft
                    newOutPolygonRow.splice(newOutPolygonRow.length - 1, 1)
                }
            }

            newOutPolygonRow.push(outPolygon)
        }

        if (yindex > 0)
        {
            // try to match the new polygons against the previous row:
            //尝试将新多边形与上一行匹配：
            let prevContinuedIndexes = {}
            let matchedIndexes = {}
            for (let i = 0; i < newOutPolygonRow.length; i++)
            {
                let thispolygon = newOutPolygonRow[i]
                for (let ii = 0; ii < prevOutPolygonRow.length; ii++)
                {
                    if (!matchedIndexes[ii]) // not already processed?
                    {
                        // We have a match if the sidelines are equal or if the top coordinates
                        // are on the sidelines of the previous polygon
                        let prevpolygon = prevOutPolygonRow[ii]
                        if (prevpolygon.bottomleft.distanceTo(thispolygon.topleft) < EPS)
                        {
                            if (prevpolygon.bottomright.distanceTo(thispolygon.topright) < EPS)
                            {
                                // Yes, the top of this polygon matches the bottom of the previous:
                                matchedIndexes[ii] = true
                                // Now check if the joined polygon would remain convex:
                                let d1 = thispolygon.leftline.direction().x - prevpolygon.leftline.direction().x
                                let d2 = thispolygon.rightline.direction().x - prevpolygon.rightline.direction().x
                                let leftlinecontinues = Math.abs(d1) < EPS
                                let rightlinecontinues = Math.abs(d2) < EPS
                                let leftlineisconvex = leftlinecontinues || (d1 >= 0)
                                let rightlineisconvex = rightlinecontinues || (d2 >= 0)
                                if (leftlineisconvex && rightlineisconvex)
                                {
                                    // yes, both sides have convex corners:
                                    // This polygon will continue the previous polygon
                                    thispolygon.outpolygon = prevpolygon.outpolygon
                                    thispolygon.leftlinecontinues = leftlinecontinues
                                    thispolygon.rightlinecontinues = rightlinecontinues
                                    prevContinuedIndexes[ii] = true
                                }
                                break
                            }
                        }
                    } // if(!prevcontinuedindexes[ii])
                } // for ii
            } // for i
            for (let ii = 0; ii < prevOutPolygonRow.length; ii++)
            {
                if (!prevContinuedIndexes[ii])
                {
                    // polygon ends here
                    // Finish the polygon with the last point(s):
                    let prevpolygon = prevOutPolygonRow[ii]
                    prevpolygon.outpolygon.rightpoints.push(prevpolygon.bottomright)
                    if (prevpolygon.bottomright.distanceTo(prevpolygon.bottomleft) > EPS)
                    {
                        // polygon ends with a horizontal line:
                        prevpolygon.outpolygon.leftpoints.push(prevpolygon.bottomleft)
                    }
                    // reverse the left half so we get a counterclockwise circle:
                    prevpolygon.outpolygon.leftpoints.reverse()
                    let points2d = prevpolygon.outpolygon.rightpoints.concat(prevpolygon.outpolygon.leftpoints)
                    let vertices3d = []
                    points2d.map(function (point2d)
                    {
                        let point3d = orthobasis.to3D(point2d)
                        let vertex3d = new Vertex3D(point3d)
                        vertices3d.push(vertex3d)
                    })
                    let polygon = new Polygon(vertices3d, shared, plane)
                    destpolygons.push(polygon)
                }
            }
        }

        for (let i = 0; i < newOutPolygonRow.length; i++)
        {
            let thispolygon = newOutPolygonRow[i]
            if (!thispolygon.outpolygon)
            {
                // polygon starts here:
                thispolygon.outpolygon = {
                    leftpoints: [],
                    rightpoints: []
                }
                thispolygon.outpolygon.leftpoints.push(thispolygon.topleft)
                if (thispolygon.topleft.distanceTo(thispolygon.topright) > EPS)
                {
                    // we have a horizontal line at the top:
                    thispolygon.outpolygon.rightpoints.push(thispolygon.topright)
                }
            } else
            {
                // continuation of a previous row
                if (!thispolygon.leftlinecontinues)
                {
                    thispolygon.outpolygon.leftpoints.push(thispolygon.topleft)
                }
                if (!thispolygon.rightlinecontinues)
                {
                    thispolygon.outpolygon.rightpoints.push(thispolygon.topright)
                }
            }
        }

        prevOutPolygonRow = newOutPolygonRow
        // }
        //#endregion

    } // for yindex
}

