// Размеры на чертеже профиля в стиле инженерного чертежа:
//   длина полки — выносные линии от концов размерной грани, размерная линия
//                 параллельно полке, стрелки на концах, текст над размерной линией;
//                 если полка короткая — стрелки снаружи, текст за концом;
//   угол гиба   — размерная дуга со стрелками, упирающимися в грани, текст у середины дуги.
//
// Для каждого размера перебираются варианты (отступ размерной линии, положение текста,
// радиус дуги и т.д.). Цена варианта: наезд текста и размерных линий на профиль,
// пересечения с другими размерами, удаление от детали, неоднозначность.
// Выбор — жадно с самых «зажатых», затем несколько проходов улучшения.

const COST = {
    labelOverlap: 4000,    // × доля наложения текстов
    labelOverlapAny: 600,  // тексты вообще пересекаются
    textOnLine: 400,       // × длина линии под текстом / кегль
    dimCrossesPart: 250,   // размерная линия пересекает контур детали
    extCrossesPart: 120,   // выносная линия пересекает контур детали
    dimCrossesDim: 120,    // размерные линии двух размеров пересекаются
    arrowOnLine: 700,      // стрелка лежит на линии другого размера (сливается с ней)
    ambiguous: 60,         // текст ближе к чужому элементу, чем к своему
    offsetStep: 5,         // каждая ступень удаления размерной линии от детали
    textShift: 6,          // текст сдвинут от середины размерной линии
    textOutside: 12,       // текст вынесен за стрелку (короткий размер)
    angleTurn: 3,          // текст угла повёрнут от биссектрисы (за 15°)
    angleRadiusStep: 4     // каждая ступень увеличения радиуса дуги
};

const PAD_RATIO = 0.15;    // запас вокруг текста, доля кегля
export const ARROW_LENGTH = 0.5;  // длина стрелки размера длины, доля кегля
export const ARROW_WIDTH = 0.17;  // полуширина основания стрелки, доля кегля
const ARC_ARROW_TO_RADIUS = 0.3;  // стрелка дуги угла пропорциональна радиусу дуги
const ARROW_ASPECT = ARROW_WIDTH / ARROW_LENGTH;

// --- геометрия --------------------------------------------------------------

function clipLength(x1, y1, x2, y2, hw, hh) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 + hw, hw - x1, y1 + hh, hh - y1];
    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
            if (q[i] < 0) return 0;
        } else {
            const r = q[i] / p[i];
            if (p[i] < 0) {
                if (r > t1) return 0;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return 0;
                if (r < t1) t1 = r;
            }
        }
    }
    return t1 > t0 ? (t1 - t0) * Math.hypot(dx, dy) : 0;
}

const makeBox = (x, y, w, h, angleDeg, pad) => {
    const r = angleDeg * Math.PI / 180;
    return { x, y, hw: w / 2 + pad, hh: h / 2 + pad, c: Math.cos(r), s: Math.sin(r) };
};

function segmentInBox(box, p, q) {
    const ax = p.x - box.x, ay = p.y - box.y, bx = q.x - box.x, by = q.y - box.y;
    const x1 = ax * box.c + ay * box.s, y1 = -ax * box.s + ay * box.c;
    const x2 = bx * box.c + by * box.s, y2 = -bx * box.s + by * box.c;
    return clipLength(x1, y1, x2, y2, box.hw, box.hh);
}

function boxOverlap(A, B) {
    const axes = [[A.c, A.s], [-A.s, A.c], [B.c, B.s], [-B.s, B.c]];
    const dx = B.x - A.x, dy = B.y - A.y;
    let minRatio = Infinity;
    for (const [ux, uy] of axes) {
        const ra = A.hw * Math.abs(A.c * ux + A.s * uy) + A.hh * Math.abs(-A.s * ux + A.c * uy);
        const rb = B.hw * Math.abs(B.c * ux + B.s * uy) + B.hh * Math.abs(-B.s * ux + B.c * uy);
        const pen = ra + rb - Math.abs(dx * ux + dy * uy);
        if (pen <= 0) return 0;
        minRatio = Math.min(minRatio, pen / (2 * Math.min(ra, rb)));
    }
    return Math.min(1, minRatio);
}

function segmentsCross(p1, p2, p3, p4) {
    const d1 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    const d2 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);
    const d3 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
    const d4 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);
    return d1 * d2 < 0 && d3 * d4 < 0;
}

function pointSegmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const add = (p, v, k) => ({ x: p.x + v.x * k, y: p.y + v.y * k });

// --- варианты размера длины ---------------------------------------------------

function shelfCandidates(d) {
    const out = [];
    const { u, n, length, w, h, fontSize } = d;
    const [f0, f1] = d.segment;
    // Порядок концов по направлению текста u (f0 → f1 может идти против u)
    const sameDir = (f1.x - f0.x) * u.x + (f1.y - f0.y) * u.y >= 0;
    const p0 = sameDir ? f0 : f1;
    const p1 = sameDir ? f1 : f0;
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

    const arrowL = ARROW_LENGTH * fontSize;
    const extGap = 0.25 * fontSize;      // зазор между деталью и выносной линией
    const extOver = 0.35 * fontSize;     // выход выносной линии за размерную
    const textGap = 0.2 * fontSize;      // зазор между размерной линией и текстом
    const arrowsInside = length >= 2.6 * arrowL;

    // Положения текста вдоль размерной линии
    const room = Math.max(0, (length - w) / 2 - (arrowsInside ? arrowL : 0));
    const shifts = [];
    if (length >= w + (arrowsInside ? 2 * arrowL : 0)) {
        shifts.push({ t: 0, cost: 0 });
        if (room > 0.1 * w) shifts.push({ t: room, cost: COST.textShift }, { t: -room, cost: COST.textShift });
    }
    const outside = length / 2 + (arrowsInside ? 0 : 1.6 * arrowL) + textGap * 2 + w / 2;
    shifts.push({ t: outside, cost: COST.textOutside }, { t: -outside, cost: COST.textOutside });

    const offsets = [1.3, 2.3, 3.4, 4.6].map((k) => k * fontSize);
    offsets.forEach((D, k) => {
        const a0 = add(p0, n, D);
        const a1 = add(p1, n, D);
        const ext0 = [add(p0, n, extGap), add(p0, n, D + extOver)];
        const ext1 = [add(p1, n, extGap), add(p1, n, D + extOver)];
        for (const sh of shifts) {
            const isOutside = Math.abs(sh.t) > length / 2;
            // Размерная линия; при стрелках снаружи и вынесенном тексте — продлевается под текст
            let lineStart = a0;
            let lineEnd = a1;
            if (!arrowsInside) {
                lineStart = add(a0, u, -1.6 * arrowL);
                lineEnd = add(a1, u, 1.6 * arrowL);
            }
            if (isOutside) {
                if (sh.t > 0) lineEnd = add(a1, u, sh.t - length / 2 + w / 2);
                else lineStart = add(a0, u, sh.t + length / 2 - w / 2);
            }
            const text = add(add(mid, n, D + textGap + h / 2), u, sh.t);
            out.push({
                x: text.x,
                y: text.y,
                cost: k * COST.offsetStep + sh.cost,
                lines: [ext0, ext1, [lineStart, lineEnd]],
                dimLine: [lineStart, lineEnd],
                extLines: [ext0, ext1],
                arrows: (arrowsInside
                    ? [{ tip: a0, dir: { x: -u.x, y: -u.y } }, { tip: a1, dir: u }]
                    : [{ tip: a0, dir: u }, { tip: a1, dir: { x: -u.x, y: -u.y } }]
                ).map((ar) => ({ ...ar, len: arrowL, half: arrowL * ARROW_ASPECT }))
            });
        }
    });
    return out;
}

// --- варианты размера угла ---------------------------------------------------

function angleCandidates(d) {
    const out = [];
    const { vertex, u1, u2, b, halfOpening, legs, w, h, fontSize } = d;
    const textGap = 0.25 * fontSize;
    const maxR = 0.85 * Math.min(legs[0], legs[1]);
    const radii = [1.3, 2.0, 2.8].map((k) => k * fontSize).filter((r, i) => i === 0 || r <= maxR);

    const a1 = Math.atan2(u1.y, u1.x);
    let delta = Math.atan2(u2.y, u2.x) - a1;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    radii.forEach((R0, ri) => {
        const R = Math.min(R0, Math.max(maxR, 0.6 * fontSize));
        const arcPts = [];
        for (let k = 0; k <= 12; k++) {
            const t = a1 + (delta * k) / 12;
            arcPts.push({ x: vertex.x + Math.cos(t) * R, y: vertex.y + Math.sin(t) * R });
        }
        const P1 = arcPts[0];
        const P2 = arcPts[arcPts.length - 1];
        const arcLen = Math.abs(delta) * R;
        const arrowL = Math.min(0.45 * fontSize, Math.max(0.22 * fontSize, ARC_ARROW_TO_RADIUS * R));
        // Стрелки внутрь дуги, если она достаточно длинная; иначе — снаружи
        const inside = arcLen >= 2.6 * arrowL;
        const tangent = (P, other) => {
            const rx = P.x - vertex.x, ry = P.y - vertex.y;
            const rl = Math.hypot(rx, ry) || 1;
            let tx = -ry / rl, ty = rx / rl;
            if (tx * (P.x - other.x) + ty * (P.y - other.y) < 0) { tx = -tx; ty = -ty; }
            return { x: tx, y: ty }; // наружу от середины дуги
        };
        const t1 = tangent(P1, P2);
        const t2 = tangent(P2, P1);
        const dirSign = Math.sign(delta) || 1;
        const a2 = a1 + delta;
        const arrowAngle = arrowL / R;
        // Стрелки изогнуты по дуге: остриё на конце дуги, тело уходит вдоль дуги
        // (внутрь — при стрелках внутри, наружу — при стрелках снаружи)
        const curved = (tipAngle, bodySign, dir) => ({
            tip: { x: vertex.x + Math.cos(tipAngle) * R, y: vertex.y + Math.sin(tipAngle) * R },
            dir,
            len: arrowL,
            half: arrowL * ARROW_ASPECT,
            arc: { cx: vertex.x, cy: vertex.y, r: R, tipAngle, sweep: bodySign * arrowAngle }
        });
        const arrows = inside
            ? [curved(a1, dirSign, t1), curved(a2, -dirSign, t2)]
            : [curved(a1, -dirSign, { x: -t1.x, y: -t1.y }), curved(a2, dirSign, { x: -t2.x, y: -t2.y })];

        // Дуга (при стрелках снаружи — с продолжением за концы) как ломаная
        const tail = inside ? 0 : 1.8 * arrowAngle;
        const from = a1 - dirSign * tail;
        const span = delta + 2 * dirSign * tail;
        const steps = Math.max(8, Math.ceil(Math.abs(span) / 0.08));
        const arcLine = [];
        for (let k = 0; k <= steps; k++) {
            const t = from + (span * k) / steps;
            arcLine.push({ x: vertex.x + Math.cos(t) * R, y: vertex.y + Math.sin(t) * R });
        }
        const lines = [];
        for (let k = 0; k < arcLine.length - 1; k++) lines.push([arcLine[k], arcLine[k + 1]]);
        const path = arcLine.map((q, k) => `${k ? "L" : "M"} ${q.x} ${q.y}`).join(" ");

        for (const k of [0, 1, -1, 2, -2, 3, -3]) {
            const phi = (k * 15 * Math.PI) / 180;
            if (Math.abs(phi) > Math.max(0, halfOpening - 0.12)) continue;
            const dx = b.x * Math.cos(phi) - b.y * Math.sin(phi);
            const dy = b.x * Math.sin(phi) + b.y * Math.cos(phi);
            const textRadius = Math.abs(dx) * w / 2 + Math.abs(dy) * h / 2;
            const r = R + textGap + textRadius;
            out.push({
                x: vertex.x + dx * r,
                y: vertex.y + dy * r,
                cost: Math.abs(k) * COST.angleTurn + ri * COST.angleRadiusStep,
                lines,
                dimLine: null,
                extLines: [],
                arrows,
                path
            });
        }
    });
    return out;
}

// --- размещение -------------------------------------------------------------

/**
 * @param {Array<{layer: {a, b, dimensions}, priority: number, background?: boolean}>} layers
 * Слои с background: true («призрак») — фон: размеры остальных слоёв их не учитывают,
 * а сами они размещаются после и обходят всё уже нарисованное.
 * Записывает в каждый запрос d.placed = { x, y, lines, arrows, path? }.
 */
export function placeDimensions(layers) {
    const foreground = layers.filter((l) => !l.background);
    const background = layers.filter((l) => l.background);
    const fixed = solveLayers(foreground, foreground, []);
    if (background.length) solveLayers(background, layers, fixed);
}

// Размещение размеров слоёв targets; контур и элементы для проверок — из context;
// fixed — уже размещённые размеры (неподвижные препятствия)
function solveLayers(targets, context, fixed) {
    const items = [];
    const partLines = [];
    const shelfSegments = [];
    const angleVertices = [];

    for (const { layer } of context) {
        const { a, b } = layer;
        for (let i = 0; i < a.length - 1; i++) partLines.push([a[i], a[i + 1]], [b[i], b[i + 1]]);
        if (a.length) partLines.push([a[0], b[0]], [a[a.length - 1], b[b.length - 1]]);
        for (const d of layer.dimensions) {
            if (d.kind === "angle") angleVertices.push(d.vertex);
            else shelfSegments.push(d.segment);
        }
    }
    for (const { layer, priority } of targets) {
        for (const d of layer.dimensions) items.push({ d, priority });
    }
    if (!items.length) return [];

    for (const it of items) {
        const { d } = it;
        const pad = d.fontSize * PAD_RATIO;
        const raw = d.kind === "shelf" ? shelfCandidates(d) : angleCandidates(d);
        it.cands = raw.map((c) => {
            const box = makeBox(c.x, c.y, d.w, d.h, d.angle, pad);
            let cost = c.cost;
            let under = 0;
            for (const [p, q] of partLines) under += segmentInBox(box, p, q);
            cost += (under / d.fontSize) * COST.textOnLine;
            for (const [p, q] of partLines) {
                if (c.dimLine && segmentsCross(c.dimLine[0], c.dimLine[1], p, q)) cost += COST.dimCrossesPart;
                for (const e of c.extLines) if (segmentsCross(e[0], e[1], p, q)) cost += COST.extCrossesPart;
            }
            if (d.kind === "angle") {
                const own = Math.hypot(c.x - d.vertex.x, c.y - d.vertex.y);
                if (angleVertices.some((v) => v !== d.vertex && Math.hypot(c.x - v.x, c.y - v.y) < own * 0.9)) cost += COST.ambiguous;
            } else {
                const own = pointSegmentDistance(c, d.segment[0], d.segment[1]);
                if (shelfSegments.some((s) => s !== d.segment && pointSegmentDistance(c, s[0], s[1]) < own * 0.85)) cost += COST.ambiguous;
            }
            // Прямоугольники стрелок (вдоль направления стрелки)
            const arrowBoxes = c.arrows.map((ar) => {
                const cx = ar.tip.x - ar.dir.x * ar.len / 2;
                const cy = ar.tip.y - ar.dir.y * ar.len / 2;
                return makeBox(cx, cy, ar.len, ar.half * 2, Math.atan2(ar.dir.y, ar.dir.x) * 180 / Math.PI, ar.half * 0.5);
            });
            return { ...c, box, arrowBoxes, cost };
        }).sort((p, q) => p.cost - q.cost);
    }

    // Попарная цена: тексты, текст на чужих размерных линиях, пересечение размерных линий
    const pairCost = (A, B, fsA, fsB) => {
        let c = 0;
        const ov = boxOverlap(A.box, B.box);
        if (ov > 0) c += COST.labelOverlapAny + ov * COST.labelOverlap;
        let under = 0;
        for (const [p, q] of B.lines) under += segmentInBox(A.box, p, q);
        for (const [p, q] of A.lines) under += segmentInBox(B.box, p, q);
        c += (under / Math.min(fsA, fsB)) * COST.textOnLine;
        for (const [p, q] of A.lines) {
            for (const [r, s] of B.lines) if (segmentsCross(p, q, r, s)) c += COST.dimCrossesDim;
        }
        // Стрелка на чужой линии или на чужой стрелке — сливается
        const arrowHits = (boxes, lines, otherBoxes) => {
            let hits = 0;
            for (const ab of boxes) {
                let len = 0;
                for (const [p, q] of lines) len += segmentInBox(ab, p, q);
                if (len > 0) hits += Math.min(1, len / (2 * ab.hw));
                for (const ob of otherBoxes) if (boxOverlap(ab, ob) > 0) hits += 1;
            }
            return hits;
        };
        c += (arrowHits(A.arrowBoxes, B.lines, B.arrowBoxes) + arrowHits(B.arrowBoxes, A.lines, [])) * COST.arrowOnLine;
        return c;
    };

    const choice = new Array(items.length).fill(-1);
    const costOf = (i, k) => {
        const A = items[i].cands[k];
        let c = A.cost;
        for (const f of fixed) c += pairCost(A, f.cand, items[i].d.fontSize, f.fontSize);
        for (let j = 0; j < items.length; j++) {
            if (j === i || choice[j] < 0) continue;
            c += pairCost(A, items[j].cands[choice[j]], items[i].d.fontSize, items[j].d.fontSize);
        }
        return c;
    };
    const best = (i) => {
        let bk = 0;
        let bc = Infinity;
        for (let k = 0; k < items[i].cands.length; k++) {
            const c = costOf(i, k);
            if (c < bc - 1e-9) {
                bc = c;
                bk = k;
            }
        }
        return { k: bk, c: bc };
    };

    const freeCount = items.map((it) => it.cands.filter((c) => c.cost < it.cands[0].cost + 20).length);
    const order = items.map((_, i) => i).sort((p, q) => freeCount[p] - freeCount[q] || items[q].priority - items[p].priority);
    for (const i of order) choice[i] = best(i).k;
    for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        for (const i of order) {
            const cur = costOf(i, choice[i]);
            const b = best(i);
            if (b.c < cur - 1e-6) {
                choice[i] = b.k;
                changed = true;
            }
        }
        if (!changed) break;
    }

    return items.map((it, i) => {
        const c = it.cands[choice[i]];
        it.d.placed = { x: c.x, y: c.y, lines: c.lines, arrows: c.arrows, path: c.path };
        return { cand: c, fontSize: it.d.fontSize };
    });
}
