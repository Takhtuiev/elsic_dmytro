import { calculateOuterLengthToEnd } from "./Calculations";
import { LABEL_OFFSET, FONT_SIZE, PADDING } from "./svgConstants";
import { placeDimensions } from "./dimensionPlacement";

// Подготовка слоёв чертежа профиля: геометрия (зеркало, поворот), подписи длин полок
// и углов гибов. Положение подписей выбирается совместно для всех слоёв
// (активный, «призрак», синий) — см. dimensionPlacement.js.

const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-5;
// Средняя ширина символа относительно кегля (моноширинная оценка)
const CHAR_WIDTH = 0.6;
// Размеры длин — как на чертеже: только число (миллиметры подразумеваются)

// Масштаб подписей: чертёж вписывается в контейнер, подписи должны оставаться
// одного экранного размера при любом размере детали
const getLabelScale = (geometrySize, containerSize) => {
    if (!geometrySize?.width || !geometrySize?.height || !containerSize?.width || !containerSize?.height) return 1;
    const scale = Math.max(geometrySize.width / containerSize.width, geometrySize.height / containerSize.height) * 1.15;
    return Math.min(2.5, Math.max(0.6, scale));
};

const rotatePoint = (p, cos, sin) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });

const pointsToPath = (pts) => pts.map((p) => `${p.x} ${p.y}`).join(" L ");

// a, b — острые контуры (по ним размеры и препятствия), ra, rb — скруглённые (рисуются)
const createPathData = (a, b, ra = a, rb = b) => ({
    a,
    b,
    sideAPath: pointsToPath(ra),
    sideBPath: pointsToPath(rb),
    fillPoints: [...ra, ...rb.slice().reverse()].map((p) => `${p.x},${p.y}`).join(" ")
});

// --- Скругления гибов ----------------------------------------------------------
// Внутренняя сторона гиба — радиус инструмента r, наружная — r + t; дуги концентричны.
// Размеры по-прежнему строятся по острым (виртуальным) вершинам, как на чертеже.

const ARC_STEP = Math.PI / 36; // 5° на сегмент дуги
const MIN_DEFLECTION = 1e-3;

const unit = (p, q) => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    return len > EPSILON ? { x: dx / len, y: dy / len, len } : null;
};

// Дуга на вершине k контура side (соседняя сторона — opp): точки от касания с входящим
// отрезком до касания с исходящим. null — вершина не гиб.
const bendArc = (side, opp, k, innerRadius, thickness) => {
    const p = side[k];
    const u1 = side[k - 1] && unit(side[k - 1], p);
    const u2 = side[k + 1] && unit(p, side[k + 1]);
    if (!u1 || !u2 || !opp[k]) return null;
    const cos = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const phi = Math.acos(cos); // угол поворота направления
    if (phi < MIN_DEFLECTION || phi > Math.PI - MIN_DEFLECTION) return null;

    // Внутрь гиба смотрит u2 − u1; сторона, смещённая туда, — внутренняя
    const bx = u2.x - u1.x;
    const by = u2.y - u1.y;
    const bl = Math.hypot(bx, by);
    const isInner = (opp[k].x - p.x) * bx + (opp[k].y - p.y) * by < 0;
    const tanHalf = Math.tan(phi / 2);
    // Короткие полки: наружная дуга не длиннее половины соседних отрезков (обе стороны ужимаются одинаково)
    const oppU1 = opp[k - 1] && unit(opp[k - 1], opp[k]);
    const oppU2 = opp[k + 1] && unit(opp[k], opp[k + 1]);
    const minLen = Math.min(u1.len, u2.len, oppU1 ? oppU1.len : Infinity, oppU2 ? oppU2.len : Infinity);
    const r = Math.max(0, Math.min(innerRadius, minLen / 2 / tanHalf - thickness));
    const R = isInner ? r : r + thickness;
    if (R <= EPSILON) return null;

    const d = R * tanHalf;
    const cd = R / Math.cos(phi / 2);
    const c = { x: p.x + (bx / bl) * cd, y: p.y + (by / bl) * cd };
    const t1 = { x: p.x - u1.x * d, y: p.y - u1.y * d };
    const a1 = Math.atan2(t1.y - c.y, t1.x - c.x);
    // Направление обхода — как у поворота контура
    const turn = Math.sign(u1.x * u2.y - u1.y * u2.x);
    const n = Math.max(2, Math.ceil(phi / ARC_STEP));
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const ang = a1 + turn * phi * (i / n);
        pts.push({ x: c.x + Math.cos(ang) * R, y: c.y + Math.sin(ang) * R });
    }
    return pts;
};

// Скруглённый контур участка [start, end] стороны side. Вершина-гиб на краю участка
// заменяется всей дугой: соседние слои (активный, синий, «призрак») стыкуются без зазора.
// Края из trim — исключение: там дугу рисует другой слой (синий), и участок
// заканчивается в точке касания своей полки.
const roundedSide = (side, opp, start, end, innerRadius, thickness, trim = {}) => {
    const out = [];
    for (let k = start; k <= end; k++) {
        const arc = k > 0 && k < side.length - 1 ? bendArc(side, opp, k, innerRadius, thickness) : null;
        if (!arc) {
            if (side[k]) out.push(side[k]);
        } else if (k === start && trim.start) {
            out.push(arc[arc.length - 1]);
        } else if (k === end && trim.end) {
            out.push(arc[0]);
        } else {
            out.push(...arc);
        }
    }
    return out;
};

const shelfTextWidth = (text, fontSize) => String(text).length * fontSize * CHAR_WIDTH;

// Запрос на подпись длины полки: размерная грань (f0 → f1), наружу — от противоположной грани
function shelfDimension(f0, f1, o0, o1, lengthText, fontSize, thickness) {
    const dx = f1.x - f0.x;
    const dy = f1.y - f0.y;
    const len = Math.hypot(dx, dy);
    if (len <= EPSILON) return null;

    let ux = dx / len;
    let uy = dy / len;
    // Направление текста в пределах [−90°, 90°)
    let angle = Math.atan2(uy, ux) * RAD_TO_DEG;
    // Как на чертеже: текст читается снизу или справа (вертикальный размер — снизу вверх)
    if (angle >= 90 - 1e-6 || angle < -90 - 1e-6) {
        angle = angle >= 90 - 1e-6 ? angle - 180 : angle + 180;
        ux = -ux;
        uy = -uy;
    }

    const mid = { x: (f0.x + f1.x) / 2, y: (f0.y + f1.y) / 2 };
    const oppMid = { x: (o0.x + o1.x) / 2, y: (o0.y + o1.y) / 2 };
    let nx = -uy;
    let ny = ux;
    if (nx * (mid.x - oppMid.x) + ny * (mid.y - oppMid.y) < 0) {
        nx = -nx;
        ny = -ny;
    }

    return {
        kind: "shelf",
        text: `${lengthText}`,
        fontSize,
        angle,
        w: shelfTextWidth(lengthText, fontSize),
        h: fontSize,
        mid,
        u: { x: ux, y: uy },
        n: { x: nx, y: ny },
        length: len,
        thickness,
        gap: LABEL_OFFSET * (fontSize / FONT_SIZE) * 0.6,
        segment: [f0, f1]
    };
}

// Запрос на размер угла: вершина с внутренней стороны гиба, грани и биссектриса внутрь угла
function angleDimension(vertex, prevPoint, nextPoint, oppVertex, bendText, fontSize) {
    const v1 = { x: prevPoint.x - vertex.x, y: prevPoint.y - vertex.y };
    const v2 = { x: nextPoint.x - vertex.x, y: nextPoint.y - vertex.y };
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    if (l1 <= EPSILON || l2 <= EPSILON) return null;

    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    const u2 = { x: v2.x / l2, y: v2.y / l2 };
    // Биссектриса внутрь угла (от наружной вершины к внутренней)
    const tx = vertex.x - oppVertex.x;
    const ty = vertex.y - oppVertex.y;
    const tLen = Math.hypot(tx, ty);
    let bx;
    let by;
    if (tLen > EPSILON) {
        bx = tx / tLen;
        by = ty / tLen;
    } else {
        const sx = u1.x + u2.x;
        const sy = u1.y + u2.y;
        const sl = Math.hypot(sx, sy) || 1;
        bx = sx / sl;
        by = sy / sl;
    }
    return {
        kind: "angle",
        text: bendText,
        fontSize,
        angle: 0,
        w: String(bendText).length * fontSize * CHAR_WIDTH,
        h: fontSize,
        vertex,
        u1,
        u2,
        legs: [l1, l2],
        b: { x: bx, y: by },
        halfOpening: Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y))) / 2
    };
}

// Слой: точки профиля на отрезке [start, end] и запросы подписей
export const buildLayer = ({
    start,
    end,
    ctxSideA,
    ctxSideB,
    ctxShelves,
    ctxBends,
    showCutAngle = false,
    labelScale = 1,
    thickness = 0,
    innerRadius = 0,
    trim
}) => {
    const a = ctxSideA.slice(start, end + 1);
    const b = ctxSideB.slice(start, end + 1);
    const fontSize = FONT_SIZE * labelScale;
    const dimensions = [];

    const addAngle = (sideArr, oppArr, i, bend) => {
        if (!sideArr[i - 1] || !sideArr[i] || !sideArr[i + 1] || !oppArr[i]) return;
        const d = angleDimension(sideArr[i], sideArr[i - 1], sideArr[i + 1], oppArr[i], `${bend.angle}°`, fontSize);
        if (d) dimensions.push(d);
    };

    ctxShelves.slice(start, end).forEach((shelf, j) => {
        const current = shelf.isTop ? a : b;
        const opposite = shelf.isTop ? b : a;
        const d = shelfDimension(current[j], current[j + 1], opposite[j], opposite[j + 1], shelf.length, fontSize, thickness);
        if (d) dimensions.push(d);

        const bend = ctxBends[start + j];
        if (!bend || j + 1 >= a.length - 1) return;
        const side = bend.direction === "right" ? b : a;
        const oppositeSide = bend.direction === "right" ? a : b;
        addAngle(side, oppositeSide, j + 1, bend);
    });

    if (showCutAngle) {
        const cutIndex = start > 0 ? start : end;
        const bend = ctxBends[cutIndex - 1];
        if (bend) {
            const side = bend.direction === "right" ? ctxSideB : ctxSideA;
            const opposite = bend.direction === "right" ? ctxSideA : ctxSideB;
            addAngle(side, opposite, cutIndex, bend);
        }
    }

    return {
        ...createPathData(
            a,
            b,
            innerRadius > 0 ? roundedSide(ctxSideA, ctxSideB, start, end, innerRadius, thickness, trim) : a,
            innerRadius > 0 ? roundedSide(ctxSideB, ctxSideA, start, end, innerRadius, thickness, trim) : b
        ),
        dimensions,
        labels: [],
        dims: [],
        angles: [],
        strokeStartCap: start === 0,
        strokeEndCap: end === ctxShelves.length
    };
};

// Готовые элементы чертежа из размещённых размеров
function finalizeLayer(layer) {
    if (!layer) return;
    for (const d of layer.dimensions) {
        const p = d.placed;
        if (!p) continue;
        if (d.kind === "shelf") {
            layer.labels.push({ text: d.text, x: p.x, y: p.y, angle: d.angle, fontSize: d.fontSize });
            layer.dims.push({ lines: p.lines, arrows: p.arrows, fontSize: d.fontSize });
        } else {
            layer.angles.push({ text: d.text, x: p.x, y: p.y, path: p.path, arrows: p.arrows, fontSize: d.fontSize });
        }
    }
    delete layer.dimensions;
}

// Размер «призрака», совпадающий с размером активного или синего слоя (та же полка,
// то же значение), не повторяется: например, в виде гиба последняя полка и синий
// размер до упора — одна и та же линия
function removeDuplicateDimensions(ghost, others) {
    if (!ghost) return;
    const tolerance = (d) => Math.max(1, 2 * (d.thickness || 0));
    const same = (g, o) => {
        if (g.kind !== o.kind || String(g.text) !== String(o.text)) return false;
        if (g.kind === "angle") return Math.hypot(g.vertex.x - o.vertex.x, g.vertex.y - o.vertex.y) < 1e-3 + tolerance(o);
        const parallel = Math.abs(g.u.x * o.u.y - g.u.y * o.u.x) < 0.02;
        return parallel && Math.hypot(g.mid.x - o.mid.x, g.mid.y - o.mid.y) < tolerance(g);
    };
    const pool = others.filter(Boolean).flatMap((l) => l.dimensions);
    ghost.dimensions = ghost.dimensions.filter((g) => !pool.some((o) => same(g, o)));
}

// Габарит повёрнутого прямоугольника подписи
function addBoxToBounds(bounds, x, y, w, h, angleDeg) {
    const r = (angleDeg || 0) * Math.PI / 180;
    const rx = Math.abs(Math.cos(r)) * w / 2 + Math.abs(Math.sin(r)) * h / 2;
    const ry = Math.abs(Math.sin(r)) * w / 2 + Math.abs(Math.cos(r)) * h / 2;
    bounds.minX = Math.min(bounds.minX, x - rx);
    bounds.maxX = Math.max(bounds.maxX, x + rx);
    bounds.minY = Math.min(bounds.minY, y - ry);
    bounds.maxY = Math.max(bounds.maxY, y + ry);
}

function addLayerToBounds(bounds, layer) {
    if (!layer) return;
    for (const p of [...layer.a, ...layer.b]) {
        bounds.minX = Math.min(bounds.minX, p.x);
        bounds.maxX = Math.max(bounds.maxX, p.x);
        bounds.minY = Math.min(bounds.minY, p.y);
        bounds.maxY = Math.max(bounds.maxY, p.y);
    }
    const addPoint = (q) => {
        bounds.minX = Math.min(bounds.minX, q.x);
        bounds.maxX = Math.max(bounds.maxX, q.x);
        bounds.minY = Math.min(bounds.minY, q.y);
        bounds.maxY = Math.max(bounds.maxY, q.y);
    };
    for (const d of layer.dimensions) {
        if (!d.placed) continue;
        addBoxToBounds(bounds, d.placed.x, d.placed.y, d.w, d.h, d.angle);
        for (const [p, q] of d.placed.lines) {
            addPoint(p);
            addPoint(q);
        }
    }
}

// Синий слой: полка от наружной вершины выбранного гиба до упора (вид гиба)
const calculateBlueRawData = (profile, bendIndex, bendSide, blueLength, sideA, sideB) => {
    if (bendIndex < 0 || blueLength <= 0) return null;
    const vertexIndex = bendIndex + 1;
    const bend = profile.bends?.[bendIndex];
    if (!bend) return null;

    const isToEnd = bendSide === "toEnd";
    const isInnerRight = bend.direction === "right";
    const outerSide = isInnerRight ? sideA : sideB;
    const innerSide = isInnerRight ? sideB : sideA;
    const outerApex = outerSide[vertexIndex];
    const targetPoint = outerSide[isToEnd ? vertexIndex + 1 : vertexIndex - 1];
    const innerApex = innerSide[vertexIndex];
    if (!outerApex || !targetPoint || !innerApex) return null;

    const dx = targetPoint.x - outerApex.x;
    const dy = targetPoint.y - outerApex.y;
    const len = Math.hypot(dx, dy);
    if (len <= EPSILON) return null;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const sideSign = (innerApex.x - outerApex.x) * nx + (innerApex.y - outerApex.y) * ny >= 0 ? 1 : -1;
    const thickness = Number(profile.thickness) || 0;

    const outerEnd = { x: outerApex.x + ux * blueLength, y: outerApex.y + uy * blueLength };
    const innerEnd = { x: outerEnd.x + nx * sideSign * thickness, y: outerEnd.y + ny * sideSign * thickness };

    return {
        endPointA: isInnerRight ? outerEnd : innerEnd,
        endPointB: isInnerRight ? innerEnd : outerEnd,
        lengthSide: isInnerRight ? "A" : "B"
    };
};

export const prepareSvgLayers = (profile, view, containerSize, geometry) => {
    if (!geometry?.sideA?.length) return null;

    const shelves = geometry.shelvesData;
    const bends = profile.bends || [];
    const totalShelves = shelves.length;
    const thickness = Number(profile.thickness) || 0;
    // Внутренний радиус гиба — радиус инструмента машины
    const innerRadius = Math.max(0, Number(profile.rTool ?? profile.machine?.rTool) || 0);

    const bendIndex = Number(view?.bendIndex ?? -1);
    const bendSide = view?.bendSide || "toEnd";
    const blueLength = bendIndex >= 0
        ? Number(calculateOuterLengthToEnd(profile, bendIndex, bendSide).toFixed(2))
        : 0;

    // Зеркало и поворот применяются к исходной геометрии
    const rot = Number(view?.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const transform = (p) => rotatePoint(view?.mirrored ? { x: -p.x, y: p.y } : p, cos, sin);
    const sideA = geometry.sideA.map(transform);
    const sideB = geometry.sideB.map(transform);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of [...sideA, ...sideB]) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    const labelScale = getLabelScale({ width: maxX - minX, height: maxY - minY }, containerSize);

    let activeStart = 0;
    let activeEnd = totalShelves;
    let ghostStart = -1;
    let ghostEnd = -1;
    if (bendIndex >= 0) {
        if (bendSide === "toEnd") {
            activeEnd = bendIndex + 1;
            ghostStart = bendIndex + 1;
            ghostEnd = totalShelves;
        } else {
            ghostStart = 0;
            ghostEnd = bendIndex + 1;
            activeStart = bendIndex + 1;
        }
    }

    const layerOptions = { ctxSideA: sideA, ctxSideB: sideB, ctxShelves: shelves, ctxBends: bends, labelScale, thickness, innerRadius };
    let blueData = null;
    const blueRaw = calculateBlueRawData(profile, bendIndex, bendSide, blueLength, sideA, sideB);
    if (blueRaw) {
        const i = bendIndex + 1;
        const isToEnd = bendSide === "toEnd";
        const bendA = sideA[i];
        const bendB = sideB[i];
        const adjacentA = sideA[isToEnd ? i - 1 : i + 1];
        const adjacentB = sideB[isToEnd ? i - 1 : i + 1];
        if (bendA && bendB && adjacentA && adjacentB) {
            const blueShelf = { ...shelves[bendIndex + 1], length: blueLength, isTop: blueRaw.lengthSide === "A" };
            blueData = buildLayer({
                start: isToEnd ? 1 : 0,
                end: isToEnd ? 2 : 1,
                ctxSideA: isToEnd ? [adjacentA, bendA, blueRaw.endPointA] : [blueRaw.endPointA, bendA, adjacentA],
                ctxSideB: isToEnd ? [adjacentB, bendB, blueRaw.endPointB] : [blueRaw.endPointB, bendB, adjacentB],
                ctxShelves: isToEnd ? [shelves[bendIndex], blueShelf] : [blueShelf, shelves[bendIndex]],
                ctxBends: [bends[bendIndex]],
                showCutAngle: true,
                labelScale,
                thickness,
                innerRadius
            });
            blueData.strokeStartCap = !isToEnd;
            blueData.strokeEndCap = isToEnd;
        }
    }

    // Гиб, выбранный в виде гиба, скругляет синий слой; активный и серый доходят только до него
    const cutVertex = blueData ? bendIndex + 1 : -1;
    const trimFor = (start, end) => ({ start: start === cutVertex, end: end === cutVertex });
    const activeData = buildLayer({ ...layerOptions, start: activeStart, end: activeEnd, trim: trimFor(activeStart, activeEnd) });
    const ghostData = ghostStart >= 0 ? buildLayer({ ...layerOptions, start: ghostStart, end: ghostEnd, trim: trimFor(ghostStart, ghostEnd) }) : null;

    // Размеры активного и синего слоёв размещаются совместно; серый слой — фон:
    // его не учитывают, а его размеры обходят уже нарисованное
    const layers = [
        { layer: activeData, priority: 2 },
        { layer: blueData, priority: 3 },
        { layer: ghostData, priority: 1, background: true }
    ].filter((l) => l.layer);
    removeDuplicateDimensions(ghostData, [activeData, blueData]);
    placeDimensions(layers);

    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const { layer } of layers) addLayerToBounds(bounds, layer);
    if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) return null;
    for (const { layer } of layers) finalizeLayer(layer);

    const pad = PADDING * labelScale;
    return {
        activeData,
        ghostData,
        blueData,
        viewBox: [
            bounds.minX - pad,
            bounds.minY - pad,
            bounds.maxX - bounds.minX + pad * 2,
            bounds.maxY - bounds.minY + pad * 2
        ].join(" ")
    };
};
