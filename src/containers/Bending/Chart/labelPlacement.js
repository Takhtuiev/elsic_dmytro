// Расстановка подписей точек: подпись всегда вплотную к своей точке (без выносок),
// перебираются положения вокруг точки со штрафами за наложения.
// Кривые индексируются сеткой ячеек, поэтому проверка кандидата стоит O(сегментов рядом),
// а не O(всех сегментов) — расчёт занимает доли миллисекунды и идёт синхронно, без воркера.

const CELL = 16;
const DIRECTIONS = Array.from({ length: 16 }, (_, k) => {
    const a = (k * Math.PI) / 8;
    return { vx: Math.cos(a), vy: Math.sin(a) };
});
// Зазор между краем маркера и подписью: сначала вплотную к точке; если там всё занято —
// дальше (без выноски), пока не найдётся свободное место
const GAPS = [1.5, 3.5, 6];
const FAR_GAPS = [9, 13, 18, 25];

const PENALTY = {
    labelOverlap: 20000,  // × доля площади наложения на другую подпись (хуже всего)
    marker: 900,          // подпись закрывает чужой маркер
    curvePerPx: 120,      // × пикселей кривой внутри подписи (текст поверх линии)
    curveNearPx: 6,       // × пикселей кривой в полосе 2 px вокруг подписи (теснота)
    outside: 6000,        // × доля подписи за пределами области графика
    distance: 10,         // за каждую ступень удаления от точки
    direction: 30,        // за отклонение от предпочтительной стороны (0…2)
    nearLabel: 40,        // подписи почти касаются
    crossCurve: 2000      // между точкой и подписью проходит чужая кривая («перепрыгивание»)
};
// Выше этого штрафа место считается занятым — ищем дальше от точки
const CROWDED_SCORE = 1500;
const ANCHOR_SKIP_PX = 2;

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

// Сетка ячеек → список отрезков кривых, проходящих через ячейку
function buildSegmentIndex(curves) {
    const cells = new Map();
    const segs = [];
    for (const curve of curves) {
        const { xs, ys } = curve;
        for (let i = 0; i < xs.length - 1; i++) {
            const x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1];
            if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
            const id = segs.length;
            segs.push([x1, y1, x2, y2, Math.hypot(x2 - x1, y2 - y1), curve.graphIndex ?? -1]);
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
    }
    const query = (l, r, t, b, visit) => {
        const seen = new Set();
        for (let c = Math.floor(l / CELL); c <= Math.floor(r / CELL); c++) {
            for (let rr = Math.floor(t / CELL); rr <= Math.floor(b / CELL); rr++) {
                const list = cells.get(c * 100003 + rr);
                if (!list) continue;
                for (const id of list) {
                    if (seen.has(id)) continue;
                    seen.add(id);
                    visit(segs[id]);
                }
            }
        }
    };
    return { query };
}

const overlapArea = (a, b) =>
    Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/**
 * @param {Object} p
 * @param {Array<{key:string, x:number, y:number, r:number, w:number, h:number, priority:number, prefer:{vx:number,vy:number}|null}>} p.labels  r — радиус маркера точки, graphIndex — своя кривая
 * @param {Array<{xs:ArrayLike<number>, ys:ArrayLike<number>, graphIndex:number}>} p.curves  кривые в пикселях
 * @param {Array<{x:number,y:number,r:number}>} p.markers  маркеры точек (не закрывать)
 * @param {{l:number,r:number,t:number,b:number}} p.plot  область графика
 * @param {Array<{l:number,r:number,t:number,b:number}>} [p.obstacles]  неподвижные прямоугольники
 * @returns {Map<string, {cx:number, cy:number, l:number, r:number, t:number, b:number}>}
 */
export function placeLabels({ labels, curves, markers, plot, obstacles = [] }) {
    const index = buildSegmentIndex(curves);
    const placed = new Map();
    // Неподвижные препятствия (пометки на линиях и т. п.) учитываются как уже стоящие подписи
    obstacles.forEach((o, i) => placed.set(`__obstacle_${i}`, o));
    const order = [...labels].sort((a, b) => b.priority - a.priority || a.y - b.y);

    const scoreCandidate = (label, rect, distIdx, dir) => {
        let score = distIdx * PENALTY.distance;
        if (label.prefer) score += (1 - (dir.vx * label.prefer.vx + dir.vy * label.prefer.vy)) * PENALTY.direction;

        const area = (rect.r - rect.l) * (rect.b - rect.t);
        const inside = overlapArea(rect, plot);
        score += (1 - inside / area) * PENALTY.outside;

        let curvePx = 0, nearPx = 0;
        const m = 2;
        index.query(rect.l - m, rect.r + m, rect.t - m, rect.b + m, (seg) => {
            curvePx += seg[4] * clipFraction(seg[0], seg[1], seg[2], seg[3], rect.l, rect.r, rect.t, rect.b);
            nearPx += seg[4] * clipFraction(seg[0], seg[1], seg[2], seg[3], rect.l - m, rect.r + m, rect.t - m, rect.b + m);
        });
        score += curvePx * PENALTY.curvePerPx + Math.max(0, nearPx - curvePx) * PENALTY.curveNearPx;

        for (const m of markers) {
            if (m.x === label.x && m.y === label.y) continue;
            if (m.x + m.r > rect.l && m.x - m.r < rect.r && m.y + m.r > rect.t && m.y - m.r < rect.b) score += PENALTY.marker;
        }

        for (const [key, other] of placed) {
            if (key === label.key) continue;
            const ov = overlapArea(rect, other);
            if (ov > 0) score += (ov / area) * PENALTY.labelOverlap;
            else if (rect.l < other.r + 3 && rect.r > other.l - 3 && rect.t < other.b + 3 && rect.b > other.t - 3) score += PENALTY.nearLabel;
        }

        // Не перепрыгивать через чужую кривую: чужая линия не должна проходить между точкой
        // и подписью — проверяются отрезки от точки до ближайшего края и до центра подписи
        const ex = Math.max(rect.l, Math.min(rect.r, label.x));
        const ey = Math.max(rect.t, Math.min(rect.b, label.y));
        let crosses = 0;
        for (const [tx, ty] of [[ex, ey], [rect.cx, rect.cy]]) {
            const len = Math.hypot(tx - label.x, ty - label.y);
            if (len < ANCHOR_SKIP_PX + 0.5) continue;
            // Начало отрезка отступает от точки: кривые, сходящиеся в самой точке, — не перескок
            const sx = label.x + (tx - label.x) * ANCHOR_SKIP_PX / len;
            const sy = label.y + (ty - label.y) * ANCHOR_SKIP_PX / len;
            let n = 0;
            index.query(Math.min(sx, tx), Math.max(sx, tx), Math.min(sy, ty), Math.max(sy, ty), (seg) => {
                if (seg[5] === label.graphIndex) return;
                if (segmentsIntersect(sx, sy, tx, ty, seg[0], seg[1], seg[2], seg[3])) n++;
            });
            crosses = Math.max(crosses, n);
        }
        score += Math.min(3, crosses) * PENALTY.crossCurve;
        return score;
    };

    const bestFor = (label) => {
        let best = null;
        const hw = label.w / 2, hh = label.h / 2;
        const markerR = label.r || 0;
        const tryGaps = (gaps, stepOffset) => {
            for (let di = 0; di < gaps.length; di++) {
                for (const dir of DIRECTIONS) {
                    // Центр так, чтобы ближайший край подписи был на зазоре от края маркера
                    const extent = Math.abs(dir.vx) * hw + Math.abs(dir.vy) * hh;
                    const dist = markerR + gaps[di] + extent;
                    const cx = label.x + dir.vx * dist;
                    const cy = label.y + dir.vy * dist;
                    const rect = { l: cx - hw, r: cx + hw, t: cy - hh, b: cy + hh, cx, cy };
                    const score = scoreCandidate(label, rect, di + stepOffset, dir);
                    if (!best || score < best.score) best = { ...rect, score };
                }
                if (best && best.score < 20) return;
            }
        };
        tryGaps(GAPS, 0);
        if (best && best.score >= CROWDED_SCORE) tryGaps(FAR_GAPS, GAPS.length);
        return best;
    };

    // Жадная расстановка по приоритету, затем два прохода уточнения с учётом всех соседей
    for (const label of order) {
        const best = bestFor(label);
        if (best) placed.set(label.key, best);
    }
    for (let pass = 0; pass < 2; pass++) {
        for (const label of order) {
            const best = bestFor(label);
            const current = placed.get(label.key);
            if (best && (!current || best.score < current.score - 1)) placed.set(label.key, best);
        }
    }

    const result = new Map();
    for (const label of order) {
        const p = placed.get(label.key);
        if (!p) continue;
        result.set(label.key, { cx: p.cx, cy: p.cy, l: p.l, r: p.r, t: p.t, b: p.b });
    }
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
