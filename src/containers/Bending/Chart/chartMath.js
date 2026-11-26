// Математика графиков: «красивые» деления осей, масштабы, прореживание и построение линий

// Шаг делений 1 / 2 / 5 × 10^k, дающий примерно targetCount делений на интервале span
export function niceStep(span, targetCount) {
    const raw = span / Math.max(1, targetCount);
    if (!(raw > 0) || !Number.isFinite(raw)) return 1;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    const mantissa = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
    return mantissa * power;
}

const roundToStep = (value, step) => {
    const decimals = Math.max(0, Math.min(10, -Math.floor(Math.log10(step)) + 1));
    const rounded = Number(value.toFixed(decimals));
    return Object.is(rounded, -0) ? 0 : rounded;
};

// Деления внутри [lo, hi] (lo < hi)
export function niceTicks(lo, hi, targetCount) {
    if (!(hi > lo)) return { step: 1, ticks: Number.isFinite(lo) ? [lo] : [] };
    const step = niceStep(hi - lo, targetCount);
    const ticks = [];
    const first = Math.ceil(lo / step - 1e-9) * step;
    for (let v = first, n = 0; v <= hi + step * 1e-9 && n < 200; v += step, n++) {
        ticks.push(roundToStep(v, step));
    }
    return { step, ticks };
}

// Число знаков после запятой, достаточное для подписей с шагом step
export function decimalsForStep(step) {
    if (!(step > 0) || !Number.isFinite(step)) return 0;
    return Math.max(0, Math.min(6, Math.ceil(-Math.log10(step) - 1e-9)));
}

export function formatNumber(value, decimals) {
    if (!Number.isFinite(value)) return "";
    const text = value.toFixed(decimals);
    return text === "-0" || /^-0\.0*$/.test(text) ? text.slice(1) : text;
}

// Линейный масштаб: домен [d0, d1] (может быть «перевёрнут») → пиксели [r0, r1]
export function makeScale(d0, d1, r0, r1) {
    const k = (r1 - r0) / ((d1 - d0) || 1);
    const scale = (v) => r0 + (v - d0) * k;
    scale.invert = (p) => d0 + (p - r0) / k;
    scale.domain = [d0, d1];
    return scale;
}

// Домен оси: заданные min/max (порядок сохраняется — так задаётся «перевёрнутая» ось)
// или границы данных, для оси значений — округлённые до «красивого» шага
export function resolveDomain(axis, dataLo, dataHi, { nice, targetTicks }) {
    const hasMin = typeof axis?.min === "number" && Number.isFinite(axis.min);
    const hasMax = typeof axis?.max === "number" && Number.isFinite(axis.max);
    if (hasMin && hasMax && axis.min !== axis.max) return [axis.min, axis.max];

    let lo = hasMin ? axis.min : dataLo;
    let hi = hasMax ? axis.max : dataHi;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (lo > hi) [lo, hi] = [hi, lo];
    if (hi - lo < 1e-9) {
        const pad = Math.max(1, Math.abs(lo) * 0.05);
        lo -= pad;
        hi += pad;
    }
    if (nice) {
        const step = niceStep(hi - lo, targetTicks);
        if (!hasMin) lo = Math.floor(lo / step + 1e-9) * step;
        if (!hasMax) hi = Math.ceil(hi / step - 1e-9) * step;
    }
    return [lo, hi];
}

// Точки графика (с разрывами null) → непрерывные куски [[x, y], ...] из конечных чисел
export function splitSegments(points) {
    const segments = [];
    let current = [];
    for (const p of points || []) {
        if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
            if (current.length) segments.push(current);
            current = [];
            continue;
        }
        current.push(p);
    }
    if (current.length) segments.push(current);
    return segments;
}

// x строго монотонен по всем кускам (функция от x) — тогда можно сглаживать и читать значение по x
export function isMonotoneX(segments) {
    let sign = 0;
    let prev = null;
    for (const seg of segments) {
        for (const p of seg) {
            if (prev !== null) {
                const d = p[0] - prev;
                if (d === 0) return false;
                const s = d > 0 ? 1 : -1;
                if (sign === 0) sign = s;
                else if (s !== sign) return false;
            }
            prev = p[0];
        }
    }
    return true;
}

// Прореживание по пиксельным столбцам с сохранением экстремумов: в каждом столбце остаются
// первая, минимальная, максимальная и последняя точки. Для монотонных по x рядов.
export function decimateColumns(px, py) {
    const n = px.length;
    const outX = [];
    const outY = [];
    let i = 0;
    while (i < n) {
        const column = Math.round(px[i]);
        let first = i, last = i, minI = i, maxI = i;
        let j = i + 1;
        while (j < n && Math.round(px[j]) === column) {
            if (py[j] < py[minI]) minI = j;
            if (py[j] > py[maxI]) maxI = j;
            last = j;
            j++;
        }
        const keep = [first, minI, maxI, last].filter((v, k, a) => a.indexOf(v) === k).sort((a, b) => a - b);
        for (const k of keep) {
            outX.push(px[k]);
            outY.push(py[k]);
        }
        i = j;
    }
    return { px: outX, py: outY };
}

const f2 = (v) => Math.round(v * 100) / 100;

export function polylinePath(px, py) {
    if (px.length < 2) return "";
    let d = `M${f2(px[0])} ${f2(py[0])}`;
    for (let i = 1; i < px.length; i++) d += `L${f2(px[i])} ${f2(py[i])}`;
    return d;
}

// Монотонный кубический сплайн (Фритч — Карлсон): гладкий и без ложных выбросов
// между узлами — экстремумы кривой совпадают с экстремумами данных
export function monotonePath(px, py) {
    const n = px.length;
    if (n < 3) return polylinePath(px, py);
    const h = new Float64Array(n - 1);
    const m = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
        h[i] = px[i + 1] - px[i];
        m[i] = (py[i + 1] - py[i]) / (h[i] || 1e-12);
    }
    const t = new Float64Array(n);
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) {
        if (m[i - 1] * m[i] <= 0) {
            t[i] = 0;
        } else {
            const h0 = h[i - 1], h1 = h[i];
            t[i] = (3 * (h0 + h1)) / ((2 * h1 + h0) / m[i - 1] + (h1 + 2 * h0) / m[i]);
        }
    }
    let d = `M${f2(px[0])} ${f2(py[0])}`;
    for (let i = 0; i < n - 1; i++) {
        const dx = h[i] / 3;
        d += `C${f2(px[i] + dx)} ${f2(py[i] + t[i] * dx)} ${f2(px[i + 1] - dx)} ${f2(py[i + 1] - t[i + 1] * dx)} ${f2(px[i + 1])} ${f2(py[i + 1])}`;
    }
    return d;
}

// Значение ряда в точке x (линейная интерполяция, ряд монотонен по x); null — вне ряда
export function valueAtX(segments, x) {
    for (const seg of segments) {
        const n = seg.length;
        if (n === 0) continue;
        const ascending = n < 2 || seg[n - 1][0] >= seg[0][0];
        const lo = ascending ? seg[0][0] : seg[n - 1][0];
        const hi = ascending ? seg[n - 1][0] : seg[0][0];
        if (x < lo || x > hi) continue;
        if (n === 1) return seg[0][1];
        let a = 0, b = n - 1;
        while (b - a > 1) {
            const mid = (a + b) >> 1;
            if ((seg[mid][0] <= x) === ascending) a = mid;
            else b = mid;
        }
        const [x0, y0] = seg[a];
        const [x1, y1] = seg[b];
        return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    return null;
}
