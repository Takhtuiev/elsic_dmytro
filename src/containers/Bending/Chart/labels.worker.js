/* eslint-disable no-restricted-globals */
self.$RefreshReg$ = function () {};
self.$RefreshSig$ = function () { return function (type) { return type; }; };

let isCancelled = false;

const LABEL_DISTANCES = [5, 9, 13];
const LABEL_RAY_DISTANCE = 4;
const LABEL_ACCEPTABLE_SCORE = 30;

const LABEL_PENALTIES = {
    placedOverlap: 10000, placedNear: 50, curveOverlap: 5000, pointInside: 1000,
    leftOverflow: 3000, rightOverflow: 4000, topOverflow: 200, bottomOverflow: 300,
    labelAreaOverflow: 10000, direction: 20, oppositeDirection: 100, rayDistance: 3,
    distance: 5, rayCross: 400, rayGraphCross: 2500,
};

const STATIC_DIRECTIONS = [
    { idx: 0, angle: 0, vx: 1, vy: 0 },
    { idx: 1, angle: 22.5, vx: 0.92387953251128, vy: 0.38268343251128 },
    { idx: 2, angle: 45, vx: 0.70710678118654, vy: 0.70710678118654 },
    { idx: 3, angle: 67.5, vx: 0.38268343236508, vy: 0.92387953236508 },
    { idx: 4, angle: 90, vx: 0, vy: 1 },
    { idx: 5, angle: 112.5, vx: -0.38268343251128, vy: 0.92387953236508 },
    { idx: 6, angle: 135, vx: -0.70710678118654, vy: 0.70710678118654 },
    { idx: 7, angle: 157.5, vx: -0.92387953251128, vy: 0.38268343236508 },
    { idx: 8, angle: 180, vx: -1, vy: 0 },
    { idx: 9, angle: -157.5, vx: -0.92387953251128, vy: -0.38268343236508 },
    { idx: 10, angle: -135, vx: -0.70710678118654, vy: -0.70710678118654 },
    { idx: 11, angle: -112.5, vx: -0.38268343251128, vy: -0.92387953236508 },
    { idx: 12, angle: -90, vx: 0, vy: -1 },
    { idx: 13, angle: -67.5, vx: 0.38268343251128, vy: -0.92387953236508 },
    { idx: 14, angle: -45, vx: 0.70710678118654, vy: -0.70710678118654 },
    { idx: 15, angle: -22.5, vx: 0.92387953236508, vy: -0.38268343236508 },
];

const DIRECTIONS_CACHE = {};
[0, 90, -90].forEach(preferredAngle => {
    DIRECTIONS_CACHE[preferredAngle] = STATIC_DIRECTIONS.slice().sort((a, b) => {
        let diffA = Math.abs(a.angle - preferredAngle);
        let diffB = Math.abs(b.angle - preferredAngle);
        return (diffA > 180 ? 360 - diffA : diffA) - (diffB > 180 ? 360 - diffB : diffB);
    });
});

const getLabelSize = (p, yAxisUnit = "°") => {
    const fontSize = 9;
    return { fontSize, textWidth: `${Math.round(p.val)}${yAxisUnit}`.length * fontSize * 0.52, textHeight: fontSize };
};

const getRayToRectPerimeterDistance = (point, rLeft, rRight, rTop, rBottom) => {
    const centerX = (rLeft + rRight) * 0.5;
    const centerY = (rTop + rBottom) * 0.5;
    const rayX = centerX - point.x;
    const rayY = centerY - point.y;
    const rayLength = Math.hypot(rayX, rayY);
    if (rayLength < 0.00001) return 0;

    const ux = rayX / rayLength;
    const uy = rayY / rayLength;
    let minT = Infinity;

    if (Math.abs(ux) > 0.00001) {
        const tLeft = (rLeft - point.x) / ux;
        if (tLeft >= 0) { const y = point.y + uy * tLeft; if (y >= rTop - 0.1 && y <= rBottom + 0.1) minT = tLeft; }
        const tRight = (rRight - point.x) / ux;
        if (tRight >= 0) { const y = point.y + uy * tRight; if (y >= rTop - 0.1 && y <= rBottom + 0.1 && tRight < minT) minT = tRight; }
    }
    if (Math.abs(uy) > 0.00001) {
        const tTop = (rTop - point.y) / uy;
        if (tTop >= 0) { const x = point.x + ux * tTop; if (x >= rLeft - 0.1 && x <= rRight + 0.1 && tTop < minT) minT = tTop; }
        const tBottom = (rBottom - point.y) / uy;
        if (tBottom >= 0) { const x = point.x + ux * tBottom; if (x >= rLeft - 0.1 && x <= rRight + 0.1 && tBottom < minT) minT = tBottom; }
    }
    return Number.isFinite(minT) ? minT : rayLength;
};

function getSegmentRectOverlapRatio(x1, y1, x2, y2, rLeft, rRight, rTop, rBottom) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0, t1 = 1;

    if (Math.abs(-dx) < 1e-9) { if (x1 - rLeft < 0) return 0; } else {
        const r = (x1 - rLeft) / -dx;
        if (-dx < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }
    if (Math.abs(dx) < 1e-9) { if (rRight - x1 < 0) return 0; } else {
        const r = (rRight - x1) / dx;
        if (dx < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }
    if (Math.abs(-dy) < 1e-9) { if (y1 - rTop < 0) return 0; } else {
        const r = (y1 - rTop) / -dy;
        if (-dy < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }
    if (Math.abs(dy) < 1e-9) { if (rBottom - y1 < 0) return 0; } else {
        const r = (rBottom - y1) / dy;
        if (dy < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }
    return Math.max(0, t1 - t0);
}

const getRectGapPenalty = (rLeft, rRight, rTop, rBottom, rWidth, rHeight, b) => {
    const overlapWidth = Math.max(0, Math.min(rRight, b.right) - Math.max(rLeft, b.left));
    if (overlapWidth <= 0) return Math.max(b.left - rRight, rLeft - b.right, 0) < 4 && Math.max(b.top - rBottom, rTop - b.bottom, 0) < 4 ? LABEL_PENALTIES.placedNear : 0;

    const overlapHeight = Math.max(0, Math.min(rBottom, b.bottom) - Math.max(rTop, b.top));
    if (overlapHeight <= 0) return Math.max(b.left - rRight, rLeft - b.right, 0) < 4 && Math.max(b.top - rBottom, rTop - b.bottom, 0) < 4 ? LABEL_PENALTIES.placedNear : 0;

    const referenceArea = Math.min(rWidth * rHeight, Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top));
    if (referenceArea <= 0) return 0;

    return Math.min(1, (overlapWidth * overlapHeight) / referenceArea) * LABEL_PENALTIES.placedOverlap;
};

const getOverflowPenalty = (rLeft, rRight, rTop, rBottom, rWidth, rHeight, plotLeft, plotRight, plotTop, plotBottom) => {
    if (rWidth <= 0 || rHeight <= 0) return 0;
    return (
        (Math.max(0, plotLeft - rLeft) / rWidth) * LABEL_PENALTIES.leftOverflow +
        (Math.max(0, rRight - plotRight) / rWidth) * LABEL_PENALTIES.rightOverflow +
        (Math.max(0, plotTop - rTop) / rHeight) * LABEL_PENALTIES.topOverflow +
        (Math.max(0, rBottom - plotBottom) / rHeight) * LABEL_PENALTIES.bottomOverflow
    );
};

const segmentIntersectsSegment = (ax, ay, bx, by, cx, cy, dx, dy, eps = 1e-9) => {
    if (Math.min(ax, bx) - eps > Math.max(cx, dx) || Math.max(ax, bx) + eps < Math.min(cx, dx) ||
        Math.min(ay, by) - eps > Math.max(cy, dy) || Math.max(ay, by) + eps < Math.min(cy, dy)) return false;

    const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);

    if (((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) && ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))) return true;

    const onSegment = (px, py, qx, qy, rx, ry) => rx >= Math.min(px, qx) - eps && rx <= Math.max(px, qx) + eps && ry >= Math.min(py, qy) - eps && ry <= Math.max(py, qy) + eps;
    return (Math.abs(o1) <= eps && onSegment(ax, ay, bx, by, cx, cy)) ||
        (Math.abs(o2) <= eps && onSegment(ax, ay, bx, by, dx, dy)) ||
        (Math.abs(o3) <= eps && onSegment(cx, cy, dx, dy, ax, ay)) ||
        (Math.abs(o4) <= eps && onSegment(cx, cy, dx, dy, bx, by));
};

let segLeft = 0, segRight = 0, segTop = 0, segBottom = 0;
const getCurveOverlap = (graph, rLeft, rRight, rTop, rBottom) => {
    let totalPixelsInside = 0;
    const xsProj = graph.xsProj;
    const ysProj = graph.ysProj;
    const pointsLength = graph.pointsLength;
    if (pointsLength < 2) return 0;

    let x1 = xsProj[0], y1 = ysProj[0];
    let x2 = 0, y2 = 0, dx = 0, dy = 0;

    for (let i = 0; i < pointsLength - 1; i++) {
        x2 = xsProj[i + 1];
        y2 = ysProj[i + 1];

        if (x1 < x2) { segLeft = x1; segRight = x2; } else { segLeft = x2; segRight = x1; }
        if (y1 < y2) { segTop = y1; segBottom = y2; } else { segTop = y2; segBottom = y1; }

        if (segRight < rLeft || segLeft > rRight || segBottom < rTop || segTop > rBottom) {
            x1 = x2; y1 = y2; continue;
        }

        dx = x2 - x1;
        dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0.00001) {
            totalPixelsInside += length * getSegmentRectOverlapRatio(x1, y1, x2, y2, rLeft, rRight, rTop, rBottom);
        }
        x1 = x2; y1 = y2;
    }
    return totalPixelsInside;
};

const getOrderedDirections = (p, prevY, nextY, hasNeighbors) => {
    if (!hasNeighbors) return DIRECTIONS_CACHE[0];
    return DIRECTIONS_CACHE[p.y < prevY && p.y < nextY ? -90 : p.y > prevY && p.y > nextY ? 90 : 0];
};

self.onmessage = function (e) {
    if (e.data.type === "STOP") { isCancelled = true; return; }
    isCancelled = false;

    const { sortedLabels, graphData, plotLeft, plotRight, plotTop, plotBottom, axes, xMax } = e.data;
    const placed = [];
    const placedMap = {};
    const currentBest = { dx: 0, dy: 0, textAnchor: "middle", rLeft: 0, rRight: 0, rTop: 0, rBottom: 0 };

    const graphMap = {};
    for (let i = 0; i < graphData.length; i++) {
        graphMap[graphData[i].index] = graphData[i];
    }

    for (let lIdx = 0; lIdx < sortedLabels.length; lIdx++) {
        if (isCancelled) return;

        const p = sortedLabels[lIdx];
        const currentGraph = graphMap[p.graphIndex];
        if (!currentGraph) continue;

        const { textWidth, textHeight } = getLabelSize(p, axes.y);
        const isRightEdge = Math.abs(p.rawX - xMax) < 1e-6;
        let prevY = 0, nextY = 0, hasNeighbors = false;

        if (p.id > 0 && p.id < currentGraph.pointsLength - 1) {
            prevY = currentGraph.ysProj[p.id - 1];
            nextY = currentGraph.ysProj[p.id + 1];
            hasNeighbors = true;
        }

        const orderedDirections = getOrderedDirections(p, prevY, nextY, hasNeighbors);
        let hasBest = false, bestScore = Infinity;

        for (let dIdx = 0; dIdx < orderedDirections.length; dIdx++) {
            const dir = orderedDirections[dIdx];

            for (let distIdx = 0; distIdx < LABEL_DISTANCES.length; distIdx++) {
                const angle = Math.abs(dir.angle) % 90;
                const distance = LABEL_DISTANCES[distIdx] + LABEL_RAY_DISTANCE * (1 - Math.min(angle, 90 - angle) / 45);
                const dx = dir.vx * distance, dy = dir.vy * distance;

                let textAnchor = "middle";
                if (p.id === 0 && Math.abs(p.x - plotLeft) < 0.1 && dx > 0.01) textAnchor = "start";
                if (isRightEdge) textAnchor = dx >= 0 ? "start" : "end";

                const tx = p.x + dx, ty = p.y + dy;
                const rLeft = tx - (textAnchor === "end" ? textWidth : textAnchor === "middle" ? textWidth * 0.5 : 0) - 1;
                const rRight = tx + (textAnchor === "start" ? textWidth : textAnchor === "middle" ? textWidth * 0.5 : 0) + 1;
                const rTop = ty - textHeight * 0.5 - 0.5, rBottom = ty + textHeight * 0.5 + 0.5;
                const rWidth = rRight - rLeft, rHeight = rBottom - rTop;

                const rDiagDx = rRight - rLeft;
                const rDiagDy = rBottom - rTop;
                const rDiagonal = Math.sqrt(rDiagDx * rDiagDx + rDiagDy * rDiagDy);

                const rayDistPenalty = Math.max(0, getRayToRectPerimeterDistance(p, rLeft, rRight, rTop, rBottom) - 6);
                let score = dIdx * LABEL_PENALTIES.direction + distIdx * LABEL_PENALTIES.distance + (rayDistPenalty * rayDistPenalty) * LABEL_PENALTIES.rayDistance;
                score += getOverflowPenalty(rLeft, rRight, rTop, rBottom, rWidth, rHeight, plotLeft, plotRight, plotTop, plotBottom);

                let ownSegmentOverlap = 0;
                const startNode = Math.max(0, p.id - 1);
                const endNode = Math.min(currentGraph.pointsLength - 2, p.id + 1);

                for (let i = startNode; i <= endNode; i++) {
                    const cx1 = currentGraph.xsProj[i], cy1 = currentGraph.ysProj[i];
                    const cx2 = currentGraph.xsProj[i + 1], cy2 = currentGraph.ysProj[i + 1];
                    const cDx = cx2 - cx1, cDy = cy2 - cy1;
                    ownSegmentOverlap += Math.sqrt(cDx * cDx + cDy * cDy) * getSegmentRectOverlapRatio(cx1, cy1, cx2, cy2, rLeft, rRight, rTop, rBottom);
                }
                if (ownSegmentOverlap > 0 && rDiagonal > 0) score += Math.min(1, ownSegmentOverlap / rDiagonal) * LABEL_PENALTIES.curveOverlap;

                for (let g = 0; g < graphData.length; g++) {
                    const overlapPixels = getCurveOverlap(graphData[g], rLeft, rRight, rTop, rBottom);
                    if (overlapPixels > 0 && rDiagonal > 0) score += Math.min(1, overlapPixels / rDiagonal) * LABEL_PENALTIES.curveOverlap;
                }

                let rayCrossesGraph = false;
                for (let g = 0; g < graphData.length; g++) {
                    if (graphData[g].index === p.graphIndex) continue;
                    const og = graphData[g];
                    const pLen = og.pointsLength - 1;
                    for (let i = 0; i < pLen; i++) {
                        if (segmentIntersectsSegment(p.x, p.y, tx, ty, og.xsProj[i], og.ysProj[i], og.xsProj[i + 1], og.ysProj[i + 1])) {
                            rayCrossesGraph = true; break;
                        }
                    }
                    if (rayCrossesGraph) break;
                }
                if (rayCrossesGraph) score += LABEL_PENALTIES.rayGraphCross;

                for (let pl = 0; pl < placed.length; pl++) {
                    const q = placed[pl];
                    score += getRectGapPenalty(rLeft, rRight, rTop, rBottom, rWidth, rHeight, q);
                    if (segmentIntersectsSegment(p.x, p.y, tx, ty, q.x, q.y, (q.left + q.right) * 0.5, (q.top + q.bottom) * 0.5)) score += LABEL_PENALTIES.rayCross;
                }

                if (score < bestScore) {
                    bestScore = score; hasBest = true;
                    currentBest.dx = dx; currentBest.dy = dy; currentBest.textAnchor = textAnchor;
                    currentBest.rLeft = rLeft; currentBest.rRight = rRight; currentBest.rTop = rTop; currentBest.rBottom = rBottom;
                }
                if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
            }
            if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
        }

        if (!hasBest) {
            const fallbackDir = orderedDirections[0] || { vx: 1, vy: 0 };
            currentBest.dx = fallbackDir.vx * 12; currentBest.dy = fallbackDir.vy * 12; currentBest.textAnchor = "middle";
            currentBest.rLeft = p.x - 10; currentBest.rRight = p.x + 10; currentBest.rTop = p.y - 5; currentBest.rBottom = p.y + 5;
        }

        const finalLabel = {
            ...p, dx: currentBest.dx, dy: currentBest.dy,
            left: currentBest.rLeft, right: currentBest.rRight, top: currentBest.rTop, bottom: currentBest.rBottom,
            textAnchor: currentBest.textAnchor
        };
        placed.push(finalLabel);
        placedMap[`${p.graphIndex}-${p.id}`] = finalLabel;
    }

    if (!isCancelled) self.postMessage({ placedMap });
};
