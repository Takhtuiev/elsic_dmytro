// Расстановка подписей точек (point-feature label placement).
//
// Подпись всегда стоит рядом со своей точкой, без выносок. Алгоритм:
//  1. Для каждой подписи строится набор кандидатов: картографические позиции (по центру
//     сверху/снизу, справа/слева, углы, немного смещённые варианты) × несколько зазоров
//     (от «вплотную» до заметно дальше, если рядом всё занято).
//  2. У каждого кандидата считается собственная цена: выход за область графика,
//     кривая под текстом, чужой маркер, удаление от точки, сторона, и главное —
//     «перепрыгивание» через чужую кривую. Для кривых-функций y(x) оно определяется точно:
//     сначала находится, с какой стороны от чужой кривой лежит точка, и подпись обязана
//     целиком лежать с той же стороны (плюс проверка отрезка точка → подпись).
//     Кривая, проходящая через саму точку (пересечение/общее начало), не мешает ни одной стороне.
//  3. Выбор комбинации кандидатов — минимизация суммарной цены (собственные + попарные
//     наложения подписей): жадный старт по «трудности», затем имитация отжига
//     (Christensen, Marks, Shieber — лучший практический метод для этой задачи)
//     и финальный локальный спуск. Генератор случайных чисел детерминированный —
//     при перерисовке подписи не прыгают.
//
// Кривые индексируются сеткой ячеек, проверка кандидата — O(отрезков рядом).

const CELL = 16;
// Позиции подписи относительно точки — как в картографии (Imhof): по центру сверху/снизу,
// справа/слева по центру, четыре угла. Смещённые варианты (подпись сдвинута вдоль стороны)
// допустимы, но дороже: подпись по центру над/под точкой читается однозначно.
// ux, uy — сторона (−1/0/1), shift — сдвиг вдоль стороны в долях размера подписи, cost — цена вида.
const SQ = Math.SQRT1_2;
const SLOTS = [
    { ux: 0, uy: -1, shift: 0, cost: 0 },
    { ux: 0, uy: 1, shift: 0, cost: 0 },
    { ux: 1, uy: 0, shift: 0, cost: 12 },
    { ux: -1, uy: 0, shift: 0, cost: 14 },
    { ux: 1, uy: -1, shift: 0, cost: 30 },
    { ux: -1, uy: -1, shift: 0, cost: 32 },
    { ux: 1, uy: 1, shift: 0, cost: 30 },
    { ux: -1, uy: 1, shift: 0, cost: 32 },
    ...[-1, 1].flatMap(uy => [0.2, -0.2, 0.4, -0.4].map(shift => ({ ux: 0, uy, shift, cost: 25 + Math.abs(shift) * 60 }))),
    ...[-1, 1].flatMap(ux => [0.4, -0.4].map(shift => ({ ux, uy: 0, shift, cost: 40 })))
].map(slot => {
    const len = Math.hypot(slot.ux, slot.uy);
    return { ...slot, dir: { vx: slot.ux / len, vy: slot.uy / len } };
});
// Зазор между краем маркера и ближайшим краем подписи, px
const GAPS = [1.5, 3, 5, 8, 12, 17, 24, 32];
// Сколько лучших кандидатов каждой подписи участвует в совместном выборе
const KEEP_CANDIDATES = 48;
// Точка ближе этого к чужой кривой считается лежащей на ней (подпись — с любой стороны)
const ON_CURVE_PX = 0.5;
// Своя точка должна быть ближе к подписи, чем любая чужая, хотя бы на столько, px
const OWN_MARGIN_PX = 4;
// До этого зазора подпись воспринимается «при точке»
const NEAR_GAP_PX = 8;
// Точки ближе этого друг к другу неразличимы — между ними однозначности не требуется
const SAME_POINT_PX = 3;

const COST = {
    labelOverlap: 20000,  // × доля площади наложения на другую подпись / препятствие
    jump: 8000,           // за каждую чужую кривую между точкой и подписью
    outside: 6000,        // × доля подписи за пределами области графика
    outsideAny: 3000,     // подпись хоть немного вылезает за рамку графика
    marker: 900,          // подпись закрывает чужой маркер
    curvePerPx: 120,      // × пикселей кривой внутри подписи (текст поверх линии)
    curveNearPx: 6,       // × пикселей кривой в полосе 2 px вокруг подписи
    gapPerPx: 6,          // × зазор от точки, px (ближе — лучше)
    farGap: 12,           // × (зазор − NEAR_GAP_PX)² — далёкая подпись хуже перескока
    direction: 30,        // × отклонение от предпочтительной стороны (0…2)
    nearLabel: 40,        // подписи почти касаются
    crossedPairs: 600,    // мысленные линии «точка → подпись» двух подписей пересекаются (порядок перепутан)
    ambiguous: 4000        // подпись ближе (или почти так же близко) к чужой подписанной точке, чем к своей
};

// --- Геометрия -------------------------------------------------------------

// Доля отрезка внутри прямоугольника (Лианг — Барски)
function clipFraction(x1, y1, x2, y2, l, r, t, b) {
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - l, r - x1, y1 - t, b - y1];
    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
            if (q[i] < 0) return 0;
        } else {
            const ratio = q[i] / p[i];
            if (p[i] < 0) {
                if (ratio > t1) return 0;
                if (ratio > t0) t0 = ratio;
            } else {
                if (ratio < t0) return 0;
                if (ratio < t1) t1 = ratio;
            }
        }
    }
    return t1 > t0 ? t1 - t0 : 0;
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    return d1 * d2 < 0 && d3 * d4 < 0;
}

const overlapArea = (a, b) =>
    Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

// Детерминированный ГПСЧ (mulberry32)
function makeRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// --- Кривые ----------------------------------------------------------------

// Кусок кривой без разрывов. Если x не убывает — это функция y(x): для неё доступны
// значение в точке и минимум/максимум на отрезке x.
function makePiece(xs, ys, graphIndex) {
    const n = xs.length;
    let monotone = n >= 2;
    for (let i = 1; i < n && monotone; i++) if (!(xs[i] >= xs[i - 1])) monotone = false;
    const piece = { xs, ys, graphIndex, monotone, x0: xs[0], x1: xs[n - 1] };
    if (!monotone) return piece;

    const lowerIndex = (x) => {
        let lo = 0, hi = n - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (xs[mid] <= x) lo = mid; else hi = mid;
        }
        return lo;
    };
    const yAt = (x) => {
        if (x < xs[0] || x > xs[n - 1]) return NaN;
        const i = lowerIndex(x);
        const dx = xs[i + 1] - xs[i];
        if (!(dx > 0)) return ys[i];
        return ys[i] + ((ys[i + 1] - ys[i]) * (x - xs[i])) / dx;
    };
    // Минимум и максимум y на [a, b] ∩ области определения; null — если не пересекаются
    const rangeOn = (a, b) => {
        const lo = Math.max(a, xs[0]), hi = Math.min(b, xs[n - 1]);
        if (lo > hi) return null;
        let min = Math.min(yAt(lo), yAt(hi)), max = Math.max(yAt(lo), yAt(hi));
        for (let i = lowerIndex(lo) + 1; i < n && xs[i] < hi; i++) {
            if (ys[i] < min) min = ys[i];
            if (ys[i] > max) max = ys[i];
        }
        return { min, max };
    };
    piece.yAt = yAt;
    piece.rangeOn = rangeOn;
    return piece;
}

// Сетка ячеек → отрезки кривых, проходящие через ячейку
function buildSegmentIndex(pieces) {
    const cells = new Map();
    const segs = [];
    pieces.forEach((piece) => {
        const { xs, ys } = piece;
        for (let i = 0; i < xs.length - 1; i++) {
            const x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1];
            if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
            const id = segs.length;
            segs.push([x1, y1, x2, y2, Math.hypot(x2 - x1, y2 - y1), piece.graphIndex, piece]);
            const c0 = Math.floor(Math.min(x1, x2) / CELL), c1 = Math.floor(Math.max(x1, x2) / CELL);
            const r0 = Math.floor(Math.min(y1, y2) / CELL), r1 = Math.floor(Math.max(y1, y2) / CELL);
            for (let c = c0; c <= c1; c++) {
                for (let r = r0; r <= r1; r++) {
                    const key = c * 100003 + r;
                    let list = cells.get(key);
                    if (!list) cells.set(key, (list = []));
                    list.push(id);
                }
            }
        }
    });
    let stamp = 0;
    const seen = new Uint32Array(segs.length);
    const query = (l, r, t, b, visit) => {
        stamp++;
        for (let c = Math.floor(l / CELL); c <= Math.floor(r / CELL); c++) {
            for (let rr = Math.floor(t / CELL); rr <= Math.floor(b / CELL); rr++) {
                const list = cells.get(c * 100003 + rr);
                if (!list) continue;
                for (const id of list) {
                    if (seen[id] === stamp) continue;
                    seen[id] = stamp;
                    visit(segs[id]);
                }
            }
        }
    };
    return { query };
}

// --- Цена кандидата без учёта других подписей ------------------------------

function makeStaticCost({ index, pieces, markers, plot, obstacles, anchors }) {
    // С какой стороны чужих кривых-функций лежит точка:
    // +1 — кривая ниже точки на экране, −1 — выше, 0 — проходит через точку
    const sidesFor = (label) => {
        const sides = new Map();
        for (const piece of pieces) {
            if (!piece.monotone || piece.graphIndex === label.graphIndex) continue;
            const y = piece.yAt(label.x);
            if (!Number.isFinite(y)) continue;
            const d = y - label.y;
            sides.set(piece, d > ON_CURVE_PX ? 1 : d < -ON_CURVE_PX ? -1 : 0);
        }
        return sides;
    };

    // Сколько чужих кривых отделяет подпись от её точки
    const jumpsFor = (label, sides, rect) => {
        const separating = new Set();
        // 1) Кривая-функция: подпись должна целиком лежать с той же стороны, что и точка
        for (const [piece, side] of sides) {
            if (side === 0) continue;
            const range = piece.rangeOn(rect.l, rect.r);
            if (!range) continue;
            if (side > 0 ? range.min < rect.b : range.max > rect.t) separating.add(piece);
        }
        // 2) Отрезки от точки до ближайшего края и до центра подписи не пересекают чужих кривых
        //    (кроме проходящих через саму точку — для них обе стороны допустимы)
        const ex = Math.max(rect.l, Math.min(rect.r, label.x));
        const ey = Math.max(rect.t, Math.min(rect.b, label.y));
        for (const [tx, ty] of [[ex, ey], [rect.cx, rect.cy]]) {
            if (Math.abs(tx - label.x) + Math.abs(ty - label.y) < 0.5) continue;
            index.query(Math.min(label.x, tx), Math.max(label.x, tx), Math.min(label.y, ty), Math.max(label.y, ty), (seg) => {
                const piece = seg[6];
                if (piece.graphIndex === label.graphIndex || separating.has(piece)) return;
                if (piece.monotone && sides.get(piece) === 0) return;
                if (segmentsIntersect(label.x, label.y, tx, ty, seg[0], seg[1], seg[2], seg[3])) separating.add(piece);
            });
        }
        return Math.min(3, separating.size);
    };

    const staticCost = (label, sides, rect, gap, dir) => {
        // Ближе — лучше; дальше NEAR_GAP_PX подпись быстро теряет связь с точкой
        const far = Math.max(0, gap - NEAR_GAP_PX);
        let cost = gap * COST.gapPerPx + far * far * COST.farGap;
        if (label.prefer) cost += (1 - (dir.vx * label.prefer.vx + dir.vy * label.prefer.vy)) * COST.direction;

        const area = (rect.r - rect.l) * (rect.b - rect.t);
        const outside = 1 - overlapArea(rect, plot) / area;
        if (outside > 1e-6) cost += COST.outsideAny + outside * COST.outside;

        let curvePx = 0, nearPx = 0;
        const m = 2;
        index.query(rect.l - m, rect.r + m, rect.t - m, rect.b + m, (seg) => {
            curvePx += seg[4] * clipFraction(seg[0], seg[1], seg[2], seg[3], rect.l, rect.r, rect.t, rect.b);
            nearPx += seg[4] * clipFraction(seg[0], seg[1], seg[2], seg[3], rect.l - m, rect.r + m, rect.t - m, rect.b + m);
        });
        cost += curvePx * COST.curvePerPx + Math.max(0, nearPx - curvePx) * COST.curveNearPx;

        for (const mk of markers) {
            if (mk.x === label.x && mk.y === label.y) continue;
            if (mk.x + mk.r > rect.l && mk.x - mk.r < rect.r && mk.y + mk.r > rect.t && mk.y - mk.r < rect.b) cost += COST.marker;
        }
        for (const o of obstacles) {
            const ov = overlapArea(rect, o);
            if (ov > 0) cost += (ov / area) * COST.labelOverlap;
        }
        cost += jumpsFor(label, sides, rect) * COST.jump;

        // Однозначность: ближайшая к подписи подписанная точка — своя, с запасом
        const distTo = (q) => Math.hypot(Math.max(rect.l, Math.min(rect.r, q.x)) - q.x, Math.max(rect.t, Math.min(rect.b, q.y)) - q.y);
        const own = distTo(label);
        for (const q of anchors) {
            if (Math.hypot(q.x - label.x, q.y - label.y) < SAME_POINT_PX) continue;
            const shortfall = own + OWN_MARGIN_PX - distTo(q);
            if (shortfall > 0) cost += COST.ambiguous * Math.min(2, shortfall / OWN_MARGIN_PX);
        }
        return cost;
    };
    return { sidesFor, staticCost };
}

// Попарная цена двух поставленных подписей: наложение, касание и перепутанный порядок
// (отрезки «точка → центр подписи» пересекаются — глаз связывает подпись не с той точкой)
function pairCost(a, b) {
    const ov = overlapArea(a, b);
    let cost = 0;
    if (ov > 0) cost += COST.labelOverlap * (0.5 + ov / Math.min(a.area, b.area));
    else if (a.l < b.r + 3 && a.r > b.l - 3 && a.t < b.b + 3 && a.b > b.t - 3) cost += COST.nearLabel;
    if (Math.hypot(a.ax - b.ax, a.ay - b.ay) >= SAME_POINT_PX &&
        segmentsIntersect(a.ax, a.ay, a.cx, a.cy, b.ax, b.ay, b.cx, b.cy)) cost += COST.crossedPairs;
    return cost;
}

/**
 * @param {Object} p
 * @param {Array<{key:string, x:number, y:number, r:number, w:number, h:number, priority:number, prefer:{vx:number,vy:number}|null, graphIndex:number}>} p.labels  r — радиус маркера точки, graphIndex — своя кривая
 * @param {Array<{xs:ArrayLike<number>, ys:ArrayLike<number>, graphIndex:number}>} p.curves  кривые в пикселях (то, что нарисовано)
 * @param {Array<{x:number,y:number,r:number}>} p.markers  маркеры точек (не закрывать)
 * @param {{l:number,r:number,t:number,b:number}} p.plot  область графика
 * @param {Array<{l:number,r:number,t:number,b:number}>} [p.obstacles]  неподвижные прямоугольники
 * @returns {Map<string, {cx:number, cy:number, l:number, r:number, t:number, b:number}>}
 */
export function placeLabels({ labels, curves, markers, plot, obstacles = [] }) {
    const result = new Map();
    if (!labels.length) return result;

    const pieces = curves.filter(c => c.xs.length >= 2).map(c => makePiece(c.xs, c.ys, c.graphIndex ?? -1));
    const index = buildSegmentIndex(pieces);
    const { sidesFor, staticCost } = makeStaticCost({ index, pieces, markers, plot, obstacles, anchors: [...labels, ...markers] });

    // 1. Кандидаты каждой подписи с собственной ценой
    const options = labels.map((label) => {
        const sides = sidesFor(label);
        const hw = label.w / 2, hh = label.h / 2;
        const markerR = label.r || 0;
        const list = [];
        for (const gap of GAPS) {
            for (const slot of SLOTS) {
                let cx, cy;
                if (slot.ux && slot.uy) {
                    // Угол: ближайший угол подписи по диагонали на зазоре от маркера
                    const d = (markerR + gap) * SQ;
                    cx = label.x + slot.ux * (d + hw);
                    cy = label.y + slot.uy * (d + hh);
                } else if (slot.uy) {
                    cx = label.x + slot.shift * label.w;
                    cy = label.y + slot.uy * (markerR + gap + hh);
                } else {
                    cx = label.x + slot.ux * (markerR + gap + hw);
                    cy = label.y + slot.shift * label.h;
                }
                const rect = { cx, cy, l: cx - hw, r: cx + hw, t: cy - hh, b: cy + hh, area: label.w * label.h, ax: label.x, ay: label.y };
                rect.cost = staticCost(label, sides, rect, gap, slot.dir) + slot.cost;
                list.push(rect);
            }
        }
        list.sort((a, b) => a.cost - b.cost);
        return list.slice(0, KEEP_CANDIDATES);
    });

    const n = labels.length;
    // Соседи: подписи, кандидаты которых вообще могут пересечься
    const reach = options.map(list => list.reduce((box, q) => ({
        l: Math.min(box.l, q.l), r: Math.max(box.r, q.r), t: Math.min(box.t, q.t), b: Math.max(box.b, q.b)
    }), { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity }));
    const neighbors = labels.map((_, i) => {
        const list = [];
        for (let j = 0; j < n; j++) {
            if (j === i) continue;
            const a = reach[i], b = reach[j];
            if (a.l < b.r + 3 && a.r > b.l - 3 && a.t < b.b + 3 && a.b > b.t - 3) list.push(j);
        }
        return list;
    });

    const choice = new Int32Array(n).fill(-1);
    const costOf = (i, k) => {
        const rect = options[i][k];
        let cost = rect.cost;
        for (const j of neighbors[i]) if (choice[j] >= 0) cost += pairCost(rect, options[j][choice[j]]);
        return cost;
    };
    const bestResponse = (i) => {
        let bestK = 0, bestCost = Infinity;
        for (let k = 0; k < options[i].length; k++) {
            const c = costOf(i, k);
            if (c < bestCost - 1e-9) { bestCost = c; bestK = k; }
        }
        return { k: bestK, cost: bestCost };
    };
    const totalCost = () => {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += options[i][choice[i]].cost;
            for (const j of neighbors[i]) if (j > i) sum += pairCost(options[i][choice[i]], options[j][choice[j]]);
        }
        return sum;
    };

    // 2. Жадный старт: сначала самые «трудные» (меньше хороших мест), затем по приоритету
    const goodCount = options.map(list => list.filter(q => q.cost < list[0].cost + 200).length);
    const order = labels.map((_, i) => i).sort((a, b) =>
        goodCount[a] - goodCount[b] || labels[b].priority - labels[a].priority || labels[a].y - labels[b].y);
    for (const i of order) choice[i] = bestResponse(i).k;

    // 3. Локальный спуск до неподвижной точки
    const descend = () => {
        for (let sweep = 0; sweep < 10; sweep++) {
            let changed = false;
            for (const i of order) {
                const current = costOf(i, choice[i]);
                const best = bestResponse(i);
                if (best.cost < current - 1e-6) { choice[i] = best.k; changed = true; }
            }
            if (!changed) break;
        }
    };
    descend();

    // 4. Имитация отжига — только если остались конфликты между подписями
    const hasConflicts = () => {
        for (let i = 0; i < n; i++) for (const j of neighbors[i]) {
            if (j > i && pairCost(options[i][choice[i]], options[j][choice[j]]) >= COST.nearLabel * 2) return true;
        }
        return false;
    };
    if (n > 1 && hasConflicts()) {
        const random = makeRandom(0x9E3779B9 ^ n);
        let energy = totalCost();
        let bestEnergy = energy;
        let bestChoice = choice.slice();
        let temperature = 2000;
        const movesPerStage = 40 * n;
        while (temperature > 1) {
            let accepted = 0;
            for (let m = 0; m < movesPerStage; m++) {
                const i = Math.floor(random() * n);
                const k = Math.floor(random() * options[i].length);
                if (k === choice[i]) continue;
                const delta = costOf(i, k) - costOf(i, choice[i]);
                if (delta <= 0 || random() < Math.exp(-delta / temperature)) {
                    choice[i] = k;
                    energy += delta;
                    accepted++;
                    if (energy < bestEnergy - 1e-6) { bestEnergy = energy; bestChoice = choice.slice(); }
                }
            }
            if (!accepted && temperature < 50) break;
            temperature *= 0.85;
        }
        choice.set(bestChoice);
        descend();
    }

    labels.forEach((label, i) => {
        const p = options[i][choice[i]];
        result.set(label.key, { cx: p.cx, cy: p.cy, l: p.l, r: p.r, t: p.t, b: p.b });
    });
    return result;
}

// Разведение подписей вдоль оси (метки пределов, подписи концов кривых): не ближе minGap,
// внутри [lo, hi]. Сохраняет порядок; возвращает новые координаты.
export function spreadAlongAxis(positions, minGap, lo, hi) {
    const items = positions.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = items.map(it => it.v);
    for (let iter = 0; iter < 8; iter++) {
        let moved = false;
        for (let k = 1; k < out.length; k++) {
            const overlap = out[k - 1] + minGap - out[k];
            if (overlap > 0.01) {
                out[k - 1] -= overlap / 2;
                out[k] += overlap / 2;
                moved = true;
            }
        }
        if (out.length) {
            if (out[0] < lo) { const s = lo - out[0]; for (let k = 0; k < out.length; k++) out[k] += s; moved = true; }
            const last = out.length - 1;
            if (out[last] > hi) {
                out[last] = hi;
                for (let k = last - 1; k >= 0; k--) out[k] = Math.min(out[k], out[k + 1] - minGap);
                moved = true;
            }
        }
        if (!moved) break;
    }
    const result = new Array(positions.length);
    items.forEach((it, k) => { result[it.i] = out[k]; });
    return result;
}
