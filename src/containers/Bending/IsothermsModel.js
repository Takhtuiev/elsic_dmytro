// IsothermsModel.js
// Изотермы и зоны нагрева на сечении листа.
//
// Поле температур модели — половина сечения (y ≥ 0, симметрия по центру). Здесь оно
// зеркалится на полную ширину, сгущается монотонной кубической интерполяцией (гладкие
// контуры даже на грубой сетке, без ложных экстремумов) и разбивается на треугольники. На треугольнике
// температура линейна, поэтому изотерма в нём — отрезок, а зона [lo, hi) — выпуклый
// многоугольник. Это даёт точные, замкнутые и согласованные между собой линии и заливки
// при любой форме поля (карманы, горизонтальные изотермы, несколько пересечений).

// Сгущение: не больше стольких ячеек по ширине и толщине и не больше ×4 к исходной сетке
const TARGET_COLUMNS = 200;
const TARGET_ROWS = 60;
const MAX_REFINE = 8;

// Монотонный кубический эрмитов сплайн (PCHIP) на неравномерной сетке:
// гладкий (C¹) и без выбросов — между узлами не появляется температур, которых нет в данных
function pchipTangents(x, y, n, out) {
    if (n < 2) { out[0] = 0; return; }
    const h0 = x[1] - x[0];
    if (n === 2) { out[0] = out[1] = (y[1] - y[0]) / h0; return; }
    for (let k = 1; k < n - 1; k++) {
        const h1 = x[k] - x[k - 1], h2 = x[k + 1] - x[k];
        const d1 = (y[k] - y[k - 1]) / h1, d2 = (y[k + 1] - y[k]) / h2;
        if (d1 * d2 <= 0) {
            out[k] = 0;
        } else {
            const w1 = 2 * h2 + h1, w2 = h2 + 2 * h1;
            out[k] = (w1 + w2) / (w1 / d1 + w2 / d2);
        }
    }
    // Концы: трёхточечная оценка с ограничением (как в PCHIP)
    const endSlope = (hA, hB, dA, dB) => {
        let m = ((2 * hA + hB) * dA - hA * dB) / (hA + hB);
        if (m * dA <= 0) m = 0;
        else if (dA * dB <= 0 && Math.abs(m) > Math.abs(3 * dA)) m = 3 * dA;
        return m;
    };
    out[0] = endSlope(x[1] - x[0], x[2] - x[1], (y[1] - y[0]) / (x[1] - x[0]), (y[2] - y[1]) / (x[2] - x[1]));
    out[n - 1] = endSlope(x[n - 1] - x[n - 2], x[n - 2] - x[n - 3], (y[n - 1] - y[n - 2]) / (x[n - 1] - x[n - 2]), (y[n - 2] - y[n - 3]) / (x[n - 2] - x[n - 3]));
}
function hermite(y0, y1, m0, m1, h, s) {
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m1;
}

/**
 * Поле на полном сечении.
 * @param {ArrayLike<number>} T  температуры половины сечения, индекс i·Ny + j
 * @param {number} Nx  узлов по толщине
 * @param {number} Ny  узлов по полуширине
 * @param {ArrayLike<number>} depthMm  координаты по толщине (Nx)
 * @param {ArrayLike<number>} halfWidthMm  координаты по полуширине (Ny), от центра
 * @returns {{X: Float64Array, Y: Float64Array, V: Float64Array, nc: number, nr: number}}
 *   X — ширина (−W…W), Y — глубина, V[r·nc + c]
 */
export function buildSectionField(T, Nx, Ny, depthMm, halfWidthMm) {
    if (!T || Nx < 2 || Ny < 2 || T.length < Nx * Ny) return null;

    // Зеркальная полная ширина: −y[Ny−1] … −y[1], y[0] … y[Ny−1]
    const nc0 = 2 * Ny - 1;
    const X0 = new Float64Array(nc0);
    const colSrc = new Int32Array(nc0);
    for (let k = 0; k < nc0; k++) {
        const j = Math.abs(k - (Ny - 1));
        colSrc[k] = j;
        X0[k] = k < Ny - 1 ? -halfWidthMm[j] : halfWidthMm[j];
    }

    const fc = Math.max(1, Math.min(MAX_REFINE, Math.floor(TARGET_COLUMNS / (nc0 - 1))));
    const fr = Math.max(1, Math.min(MAX_REFINE, Math.floor(TARGET_ROWS / (Nx - 1))));
    const nc = (nc0 - 1) * fc + 1;
    const nr = (Nx - 1) * fr + 1;
    const X = new Float64Array(nc);
    const Y = new Float64Array(nr);
    for (let c = 0; c < nc; c++) {
        const k = Math.min(nc0 - 2, Math.floor(c / fc));
        const s = c / fc - k;
        X[c] = X0[k] + s * (X0[k + 1] - X0[k]);
    }
    for (let r = 0; r < nr; r++) {
        const i = Math.min(Nx - 2, Math.floor(r / fr));
        const s = r / fr - i;
        Y[r] = depthMm[i] + s * (depthMm[i + 1] - depthMm[i]);
    }

    // Сначала вдоль ширины в каждом исходном слое, затем вдоль толщины в каждом новом столбце
    const rowsRefined = new Float64Array(Nx * nc);
    const lineY = new Float64Array(nc0);
    const tangents = new Float64Array(Math.max(nc0, Nx));
    for (let i = 0; i < Nx; i++) {
        for (let k = 0; k < nc0; k++) lineY[k] = T[i * Ny + colSrc[k]];
        pchipTangents(X0, lineY, nc0, tangents);
        for (let c = 0; c < nc; c++) {
            const k = Math.min(nc0 - 2, Math.floor(c / fc));
            const sc = c / fc - k;
            rowsRefined[i * nc + c] = hermite(lineY[k], lineY[k + 1], tangents[k], tangents[k + 1], X0[k + 1] - X0[k], sc);
        }
    }
    const V = new Float64Array(nr * nc);
    const colY = new Float64Array(Nx);
    for (let c = 0; c < nc; c++) {
        for (let i = 0; i < Nx; i++) colY[i] = rowsRefined[i * nc + c];
        pchipTangents(depthMm, colY, Nx, tangents);
        for (let r = 0; r < nr; r++) {
            const i = Math.min(Nx - 2, Math.floor(r / fr));
            const sr = r / fr - i;
            V[r * nc + c] = hermite(colY[i], colY[i + 1], tangents[i], tangents[i + 1], depthMm[i + 1] - depthMm[i], sr);
        }
    }
    return { X, Y, V, nc, nr };
}

// Точка уровня level на ребре между узлами p и q. Узлы упорядочиваются, поэтому соседние
// треугольники получают побитово одинаковую точку — заливки стыкуются без щелей.
function edgePoint(field, p, q, level) {
    const a = Math.min(p, q), b = Math.max(p, q);
    const { X, Y, V, nc } = field;
    const va = V[a], vb = V[b];
    const t = vb === va ? 0.5 : (level - va) / (vb - va);
    const xa = X[a % nc], ya = Y[(a / nc) | 0];
    const xb = X[b % nc], yb = Y[(b / nc) | 0];
    return [xa + t * (xb - xa), ya + t * (yb - ya)];
}

// Разбиение ячейки (a b / d e) на два треугольника по диагонали с меньшим перепадом:
// так контуры не «пилят» вдоль одного направления. Изолинии и зоны используют одно правило.
function cellTriangles(V, a, b, d, e) {
    return Math.abs(V[a] - V[e]) <= Math.abs(V[b] - V[d])
        ? [[a, b, e], [a, e, d]]
        : [[a, b, d], [b, e, d]];
}

function forEachTriangle(field, visit) {
    const { nc, nr, V } = field;
    for (let r = 0; r < nr - 1; r++) {
        for (let c = 0; c < nc - 1; c++) {
            const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
            for (const [p, q, w] of cellTriangles(V, a, b, d, e)) visit(p, q, w);
        }
    }
}

/**
 * Изотерма уровня level: ломаные (точки [ширина, глубина]) — отрезки треугольников,
 * склеенные по общим рёбрам в непрерывные линии.
 * @returns {Array<Array<[number, number]>>}
 */
export function buildIsolines(field, level) {
    if (!field || !Number.isFinite(level)) return [];
    const { V } = field;
    const segments = [];
    const above = (i) => V[i] >= level;
    const total = V.length;
    const edgeKey = (p, q) => (p < q ? p * total + q : q * total + p);

    forEachTriangle(field, (a, b, c) => {
        const ua = above(a), ub = above(b), uc = above(c);
        if (ua === ub && ub === uc) return;
        const cut = [];
        if (ua !== ub) cut.push([a, b]);
        if (ub !== uc) cut.push([b, c]);
        if (uc !== ua) cut.push([c, a]);
        if (cut.length !== 2) return;
        segments.push({
            k0: edgeKey(cut[0][0], cut[0][1]),
            k1: edgeKey(cut[1][0], cut[1][1]),
            p0: edgePoint(field, cut[0][0], cut[0][1], level),
            p1: edgePoint(field, cut[1][0], cut[1][1], level),
            used: false
        });
    });
    if (!segments.length) return [];

    // Склейка: каждое ребро-пересечение принадлежит максимум двум отрезкам
    const byKey = new Map();
    segments.forEach((s, idx) => {
        for (const k of [s.k0, s.k1]) {
            const list = byKey.get(k);
            if (list) list.push(idx);
            else byKey.set(k, [idx]);
        }
    });
    const next = (key, fromIdx) => {
        const list = byKey.get(key);
        if (!list) return -1;
        for (const idx of list) if (idx !== fromIdx && !segments[idx].used) return idx;
        return -1;
    };

    const lines = [];
    const extend = (line, key, idx) => {
        let curKey = key, curIdx = idx;
        for (;;) {
            const n = next(curKey, curIdx);
            if (n < 0) return;
            const s = segments[n];
            s.used = true;
            if (s.k0 === curKey) {
                line.push(s.p1);
                curKey = s.k1;
            } else {
                line.push(s.p0);
                curKey = s.k0;
            }
            curIdx = n;
        }
    };
    for (let idx = 0; idx < segments.length; idx++) {
        const s = segments[idx];
        if (s.used) continue;
        s.used = true;
        const forward = [s.p0, s.p1];
        extend(forward, s.k1, idx);
        const backward = [];
        extend(backward, s.k0, idx);
        lines.push([...backward.reverse(), ...forward]);
    }
    return lines;
}

// Отсечение многоугольника по уровню: keepAbove — оставить v ≥ level, иначе v < level.
// Вершины: { p: [x, y], v, a, b } — точка лежит на исходном ребре (a, b) (для узла a = b).
function clipByLevel(field, poly, level, keepAbove) {
    const out = [];
    const inside = (vx) => (keepAbove ? vx.v >= level : vx.v < level);
    for (let k = 0; k < poly.length; k++) {
        const P = poly[k];
        const Q = poly[(k + 1) % poly.length];
        const pin = inside(P), qin = inside(Q);
        if (pin) out.push(P);
        if (pin !== qin) {
            // Пересечение лежит на исходном ребре, содержащем обе вершины
            const ids = [...new Set([P.a, P.b, Q.a, Q.b])];
            if (ids.length !== 2) continue;
            const [i, j] = ids;
            out.push({ p: edgePoint(field, i, j, level), v: level, a: Math.min(i, j), b: Math.max(i, j) });
        }
    }
    return out;
}

/**
 * Зоны (полосы температур). bands — [{ key, lo, hi }] с lo < hi (±Infinity допустимы),
 * упорядоченные по возрастанию и без перекрытий; точка относится к зоне при lo ≤ T < hi.
 * Возвращает Map key → массив колец [[x, y], …] (одинаковая ориентация, без щелей).
 * Целые ячейки одной зоны в строке объединяются в один прямоугольник.
 */
export function buildIsobands(field, bands) {
    const result = new Map(bands.map(b => [b.key, []]));
    if (!field || !bands.length) return result;
    const { X, Y, V, nc, nr } = field;

    const bandOf = (v) => {
        for (let k = 0; k < bands.length; k++) if (v >= bands[k].lo && v < bands[k].hi) return k;
        return -1;
    };
    const node = (i) => ({ p: [X[i % nc], Y[(i / nc) | 0]], v: V[i], a: i, b: i });

    for (let r = 0; r < nr - 1; r++) {
        let runBand = -1, runStart = 0;
        const flushRun = (endCol) => {
            if (runBand < 0) return;
            const x0 = X[runStart], x1 = X[endCol];
            result.get(bands[runBand].key).push([[x0, Y[r]], [x1, Y[r]], [x1, Y[r + 1]], [x0, Y[r + 1]]]);
            runBand = -1;
        };
        for (let c = 0; c < nc - 1; c++) {
            const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
            const ka = bandOf(V[a]), kb = bandOf(V[b]), kd = bandOf(V[d]), ke = bandOf(V[e]);
            if (ka === kb && kb === kd && kd === ke && ka >= 0) {
                if (runBand !== ka) {
                    flushRun(c);
                    runBand = ka;
                    runStart = c;
                }
                continue;
            }
            flushRun(c);
            const kMin = Math.max(0, Math.min(ka, kb, kd, ke));
            const kMax = Math.max(ka, kb, kd, ke);
            for (const tri of cellTriangles(V, a, b, d, e)) {
                const base = tri.map(node);
                for (let k = kMin; k <= kMax; k++) {
                    let poly = base;
                    if (Number.isFinite(bands[k].lo)) poly = clipByLevel(field, poly, bands[k].lo, true);
                    if (poly.length >= 3 && Number.isFinite(bands[k].hi)) poly = clipByLevel(field, poly, bands[k].hi, false);
                    if (poly.length >= 3) result.get(bands[k].key).push(poly.map(vx => vx.p));
                }
            }
        }
        flushRun(nc - 1);
    }
    return result;
}

/**
 * Значение температуры на глубине depth (линейно между слоями) по полуширине
 * и полуширина, на которой она опускается ниже level при движении от центра.
 * @returns {number|null}  null — уже в центре ниже level; halfWidth — выше level по всей ширине
 */
export function findHalfWidthAboveLevel(T, Nx, Ny, depthMm, halfWidthMm, depth, level) {
    if (!T || Nx < 1 || Ny < 2 || !Number.isFinite(depth) || !Number.isFinite(level)) return null;
    let i = 0;
    while (i < Nx - 2 && depthMm[i + 1] < depth) i++;
    const span = Nx > 1 ? depthMm[i + 1] - depthMm[i] : 0;
    const s = Nx > 1 && span > 0 ? Math.max(0, Math.min(1, (depth - depthMm[i]) / span)) : 0;
    const at = (j) => (Nx > 1 ? T[i * Ny + j] + s * (T[(i + 1) * Ny + j] - T[i * Ny + j]) : T[j]);

    if (at(0) < level) return null;
    for (let j = 0; j < Ny - 1; j++) {
        const t1 = at(j), t2 = at(j + 1);
        if (t1 >= level && t2 < level) {
            return halfWidthMm[j] + ((t1 - level) / (t1 - t2)) * (halfWidthMm[j + 1] - halfWidthMm[j]);
        }
    }
    return halfWidthMm[Ny - 1];
}
