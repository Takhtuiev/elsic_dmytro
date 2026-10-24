// Отключаем webpack hot-reload рантайм внутри воркера, чтобы предотвратить загрузку HMR-чанков через importScripts
/* eslint-disable-next-line no-restricted-globals */
self.$RefreshReg$ = function () {};
/* eslint-disable-next-line no-restricted-globals */
self.$RefreshSig$ = function () { return function (type) { return type; }; };

let isCancelled = false;

// --- Константы конфигурации ---
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

const getLabelSize = (p, yAxisUnit = "°") => {
    const fontSize = 9;
    const text = `${Math.round(p.val)}${yAxisUnit}`;
    return { fontSize, textWidth: text.length * fontSize * 0.52, textHeight: fontSize };
};

// Инлайнинг простых операций для избежания вызовов функций в тяжелых циклах
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

const getSegmentRectOverlapRatio = (x1, y1, x2, y2, rLeft, rRight, rTop, rBottom) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.abs(dx) < 0.00001 && Math.abs(dy) < 0.00001) return 0;

    let t0 = 0;
    let t1 = 1;

    // Инлайнинг функции clip для производительности
    if (Math.abs(dx) < 0.00001) {
        if (x1 - rLeft < 0 || rRight - x1 < 0) return 0;
    } else {
        let r = (x1 - rLeft) / dx;
        if (-dx < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
        r = (rRight - x1) / dx;
        if (dx < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }

    if (Math.abs(dy) < 0.00001) {
        if (y1 - rTop < 0 || rBottom - y1 < 0) return 0;
    } else {
        let r = (y1 - rTop) / dy;
        if (-dy < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
        r = (rBottom - y1) / dy;
        if (dy < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }

    return Math.max(0, t1 - t0);
};

const getRectGapPenalty = (rLeft, rRight, rTop, rBottom, rWidth, rHeight, b) => {
    const overlapWidth = Math.max(0, Math.min(rRight, b.right) - Math.max(rLeft, b.left));
    if (overlapWidth <= 0) {
        return Math.max(b.left - rRight, rLeft - b.right, 0) < 4 && Math.max(b.top - rBottom, rTop - b.bottom, 0) < 4 ? LABEL_PENALTIES.placedNear : 0;
    }
    const overlapHeight = Math.max(0, Math.min(rBottom, b.bottom) - Math.max(rTop, b.top));
    if (overlapHeight <= 0) {
        return Math.max(b.left - rRight, rLeft - b.right, 0) < 4 && Math.max(b.top - rBottom, rTop - b.bottom, 0) < 4 ? LABEL_PENALTIES.placedNear : 0;
    }

    const bWidth = Math.max(0, b.right - b.left);
    const bHeight = Math.max(0, b.bottom - b.top);
    const referenceArea = Math.min(rWidth * rHeight, bWidth * bHeight);
    if (referenceArea <= 0) return 0;

    return Math.min(1, (overlapWidth * overlapHeight) / referenceArea) * LABEL_PENALTIES.placedOverlap;
};

const getOverflowPenalty = (rLeft, rRight, rTop, rBottom, rWidth, rHeight, plotLeft, plotRight, plotTop, plotBottom) => {
    const leftRatio = rWidth > 0 ? Math.min(1, Math.max(0, plotLeft - rLeft) / rWidth) : 0;
    const rightRatio = rWidth > 0 ? Math.min(1, Math.max(0, rRight - plotRight) / rWidth) : 0;
    const topRatio = rHeight > 0 ? Math.min(1, Math.max(0, plotTop - rTop) / rHeight) : 0;
    const bottomRatio = rHeight > 0 ? Math.min(1, Math.max(0, rBottom - plotBottom) / rHeight) : 0;

    return (
        leftRatio * LABEL_PENALTIES.leftOverflow +
        rightRatio * LABEL_PENALTIES.rightOverflow +
        topRatio * LABEL_PENALTIES.topOverflow +
        bottomRatio * LABEL_PENALTIES.bottomOverflow
    );
};

// Быстрый пред-отсев пересечения отрезков по Bounding Box (AABB) перед точной математикой
const segmentIntersectsSegment = (ax, ay, bx, by, cx, cy, dx, dy, eps = 1e-9) => {
    if (Math.min(ax, bx) - eps > Math.max(cx, dx) || Math.max(ax, bx) + eps < Math.min(cx, dx) ||
        Math.min(ay, by) - eps > Math.max(cy, dy) || Math.max(ay, by) + eps < Math.min(cy, dy)) {
        return false;
    }

    const cross = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);

    const o1 = cross(ax, ay, bx, by, cx, cy);
    const o2 = cross(ax, ay, bx, by, dx, dy);
    const o3 = cross(cx, cy, dx, dy, ax, ay);
    const o4 = cross(cx, cy, dx, dy, bx, by);

    if (((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) && ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))) return true;

    const onSegment = (px, py, qx, qy, rx, ry) => rx >= Math.min(px, qx) - eps && rx <= Math.max(px, qx) + eps && ry >= Math.min(py, qy) - eps && ry <= Math.max(py, qy) + eps;

    return (Math.abs(o1) <= eps && onSegment(ax, ay, bx, by, cx, cy)) ||
        (Math.abs(o2) <= eps && onSegment(ax, ay, bx, by, dx, dy)) ||
        (Math.abs(o3) <= eps && onSegment(cx, cy, dx, dy, ax, ay)) ||
        (Math.abs(o4) <= eps && onSegment(cx, cy, dx, dy, bx, by));
};

const getCurveOverlap = (graph, rLeft, rRight, rTop, rBottom) => {
    let totalPixelsInside = 0;
    const { points, xsProj, ysProj } = graph;
    const len = points.length;
    if (len < 2) return 0;

    let x1 = xsProj[0];
    let y1 = ysProj[0];

    for (let i = 0; i < len - 1; i++) {
        const x2 = xsProj[i + 1];
        const y2 = ysProj[i + 1];

        if (x2 === null || x1 === null) {
            x1 = x2; y1 = y2; continue;
        }

        // Раннее ленивое исключение сегментов вне прямоугольника метки (AABB)
        const segLeft = x1 < x2 ? x1 : x2;
        const segRight = x1 > x2 ? x1 : x2;
        const segTop = y1 < y2 ? y1 : y2;
        const segBottom = y1 > y2 ? y1 : y2;

        if (segRight < rLeft || segLeft > rRight || segBottom < rTop || segTop > rBottom) {
            x1 = x2; y1 = y2; continue;
        }

        const length = Math.hypot(x2 - x1, y2 - y1);
        if (length > 0.00001) {
            totalPixelsInside += length * getSegmentRectOverlapRatio(x1, y1, x2, y2, rLeft, rRight, rTop, rBottom);
        }
        x1 = x2; y1 = y2;
    }
    return totalPixelsInside;
};

const getOrderedDirections = (p, prevY, nextY, hasNeighbors) => {
    let preferredAngle = 0;
    if (hasNeighbors) {
        preferredAngle = p.y < prevY && p.y < nextY ? -90 : p.y > prevY && p.y > nextY ? 90 : 0;
    }
    // Быстрая сортировка без создания новых инстансов функций каждый раз
    return STATIC_DIRECTIONS.slice().sort((a, b) => {
        let diffA = Math.abs(a.angle - preferredAngle);
        let diffB = Math.abs(b.angle - preferredAngle);
        return (diffA > 180 ? 360 - diffA : diffA) - (diffB > 180 ? 360 - diffB : diffB);
    });
};

/* eslint-disable-next-line no-restricted-globals */
self.onmessage = function (e) {
    if (e.data.type === "STOP") {
        isCancelled = true;
        return;
    }

    isCancelled = false;

    const { sortedLabels, graphData, plotLeft, plotRight, plotTop, plotBottom, axes, xMax, xsMap, ysMap } = e.data;
    const placed = [];
    const placedMap = {};

    // Оптимизация проекций: маппинг по индексу массива вместо работы со строковыми ключами в цикле
    const projectedGraphs = graphData.map(g => {
        const xsProj = new Float64Array(g.points.length);
        const ysProj = new Float64Array(g.points.length);
        for (let i = 0; i < g.points.length; i++) {
            const pt = g.points[i];
            if (pt) {
                const key = pt[0] + ',' + pt[1];
                xsProj[i] = xsMap[key] ?? null;
                ysProj[i] = ysMap[key] ?? null;
            } else {
                xsProj[i] = null;
                ysProj[i] = null;
            }
        }
        return { index: g.index, points: g.points, xsProj, ysProj };
    });

    const isPlotRightEdge = (p) => Math.abs(p.rawX - xMax) < 1e-6;

    for (let lIdx = 0; lIdx < sortedLabels.length; lIdx++) {
        if (isCancelled) return;

        const p = sortedLabels[lIdx];
        const currentGraph = projectedGraphs.find(g => g.index === p.graphIndex);
        if (!currentGraph) continue;

        const { textWidth, textHeight } = getLabelSize(p, axes.y);

        const isLeftEdge = p.id === 0;
        const isRightEdge = isPlotRightEdge(p);
        let prevY = 0, nextY = 0, hasNeighbors = false;

        if (!isLeftEdge && p.id < currentGraph.points.length - 1 && currentGraph.points[p.id - 1] && currentGraph.points[p.id + 1]) {
            prevY = currentGraph.ysProj[p.id - 1];
            nextY = currentGraph.ysProj[p.id + 1];
            hasNeighbors = true;
        }

        const orderedDirections = getOrderedDirections(p, prevY, nextY, hasNeighbors);
        let best = null;
        let bestScore = Infinity;

        for (let dIdx = 0; dIdx < orderedDirections.length; dIdx++) {
            const dir = orderedDirections[dIdx];

            for (let distIdx = 0; distIdx < LABEL_DISTANCES.length; distIdx++) {
                const baseDist = LABEL_DISTANCES[distIdx];
                const angle = Math.abs(dir.angle) % 90;
                const distance = baseDist + LABEL_RAY_DISTANCE * (1 - Math.min(angle, 90 - angle) / 45);
                const dx = dir.vx * distance;
                const dy = dir.vy * distance;

                let textAnchor = "middle";
                if (p.id === 0 && Math.abs(p.x - plotLeft) < 0.1 && dx > 0.01) textAnchor = "start";
                if (isRightEdge) textAnchor = dx >= 0 ? "start" : "end";

                const tx = p.x + dx;
                const ty = p.y + dy;

                // Деконструкция rect на плоские переменные для разгрузки GC
                const rLeft = tx - (textAnchor === "end" ? textWidth : textAnchor === "middle" ? textWidth * 0.5 : 0) - 1;
                const rRight = tx + (textAnchor === "start" ? textWidth : textAnchor === "middle" ? textWidth * 0.5 : 0) + 1;
                const rTop = ty - textHeight * 0.5 - 0.5;
                const rBottom = ty + textHeight * 0.5 + 0.5;
                const rWidth = rRight - rLeft;
                const rHeight = rBottom - rTop;
                const rDiagonal = Math.hypot(rWidth, rHeight);

                let score = dIdx * LABEL_PENALTIES.direction +
                    distIdx * LABEL_PENALTIES.distance +
                    Math.pow(Math.max(0, getRayToRectPerimeterDistance(p, rLeft, rRight, rTop, rBottom) - 6), 2) * LABEL_PENALTIES.rayDistance;

                score += getOverflowPenalty(rLeft, rRight, rTop, rBottom, rWidth, rHeight, plotLeft, plotRight, plotTop, plotBottom);

                // Расчет оверлапа собственного сегмента
                let ownSegmentOverlap = 0;
                const startNode = Math.max(0, p.id - 1);
                const endNode = Math.min(currentGraph.points.length - 2, p.id + 1);

                for (let i = startNode; i <= endNode; i++) {
                    const cx1 = currentGraph.xsProj[i];   const cy1 = currentGraph.ysProj[i];
                    const cx2 = currentGraph.xsProj[i + 1]; const cy2 = currentGraph.ysProj[i + 1];
                    if (cx1 === null || cx2 === null) continue;

                    ownSegmentOverlap += Math.hypot(cx2 - cx1, cy2 - cy1) * getSegmentRectOverlapRatio(cx1, cy1, cx2, cy2, rLeft, rRight, rTop, rBottom);
                }
                if (ownSegmentOverlap > 0 && rDiagonal > 0) {
                    score += Math.min(1, ownSegmentOverlap / rDiagonal) * LABEL_PENALTIES.curveOverlap;
                }

                // Оверлапы графиков
                for (let g = 0; g < projectedGraphs.length; g++) {
                    const overlapPixels = getCurveOverlap(projectedGraphs[g], rLeft, rRight, rTop, rBottom);
                    if (overlapPixels > 0 && rDiagonal > 0) {
                        score += Math.min(1, overlapPixels / rDiagonal) * LABEL_PENALTIES.curveOverlap;
                    }
                }

                // Пересечения лучей с графиками
                let rayCrossesGraph = false;
                for (let g = 0; g < projectedGraphs.length; g++) {
                    if (projectedGraphs[g].index === p.graphIndex) continue;
                    const og = projectedGraphs[g];
                    for (let i = 0; i < og.points.length - 1; i++) {
                        const ox1 = og.xsProj[i];   const oy1 = og.ysProj[i];
                        const ox2 = og.xsProj[i + 1]; const oy2 = og.ysProj[i + 1];
                        if (ox1 === null || ox2 === null) continue;

                        if (segmentIntersectsSegment(p.x, p.y, tx, ty, ox1, oy1, ox2, oy2)) {
                            rayCrossesGraph = true;
                            break;
                        }
                    }
                    if (rayCrossesGraph) break;
                }
                if (rayCrossesGraph) score += LABEL_PENALTIES.rayGraphCross;

                // Пенальти за пересечение с уже расставленными метками
                for (let pl = 0; pl < placed.length; pl++) {
                    const q = placed[pl];
                    score += getRectGapPenalty(rLeft, rRight, rTop, rBottom, rWidth, rHeight, q);

                    const qCenterX = (q.left + q.right) * 0.5;
                    const qCenterY = (q.top + q.bottom) * 0.5;
                    if (segmentIntersectsSegment(p.x, p.y, tx, ty, q.x, q.y, qCenterX, qCenterY)) {
                        score += LABEL_PENALTIES.rayCross;
                    }
                }

                if (score < bestScore) {
                    bestScore = score;
                    if (!best) best = {};
                    best.dx = dx; best.dy = dy; best.textAnchor = textAnchor;
                    best.rLeft = rLeft; best.rRight = rRight; best.rTop = rTop; best.rBottom = rBottom;
                }

                if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
            }
            if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
        }

        if (!best) {
            const fallbackDir = orderedDirections[0] || { vx: 1, vy: 0 };
            best = {
                dx: fallbackDir.vx * 12, dy: fallbackDir.vy * 12, textAnchor: "middle",
                rLeft: p.x - 10, rRight: p.x + 10, rTop: p.y - 5, rBottom: p.y + 5
            };
        }

        const finalLabel = {
            ...p, dx: best.dx, dy: best.dy,
            left: best.rLeft, right: best.rRight, top: best.rTop, bottom: best.rBottom,
            textAnchor: best.textAnchor
        };
        placed.push(finalLabel);
        placedMap[p.graphIndex + '-' + p.id] = finalLabel;
    }

    if (!isCancelled) {
        /* eslint-disable-next-line no-restricted-globals */
        self.postMessage({ placedMap });
    }
};
