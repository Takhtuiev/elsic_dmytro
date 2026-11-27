import {
    snapGridDensityX,
    snapGridDensityY
} from "./heating2DModel";

// ============================================================================
// ЗАДАЧИ ОПТИМИЗАЦИИ
//
// Каждая задача описывается целиком в одном месте:
//   params   — что подбираем: путь в параметрах симуляции, единица и диапазон
//              (min / max / step или range(baseParams) → { min, max, step });
//   metrics  — что измеряем: label (подпись в интерфейсе), read(res, ctx) → число, единица, resolution
//              (разница меньше неё несущественна: это и допуск предела, и порог
//              значимого улучшения), предел max / min, growsOnly (метрика только
//              накапливается — прогон, ушедший далеко за предел, можно оборвать);
//   minimize / maximize — какая метрика цель; остальные метрики с пределом — ограничения;
//   simulation — что подставить в параметры симуляции на время оптимизации;
//   when(baseParams) — задача доступна только при этом условии;
//   extends — взять другую задачу за основу и изменить только указанное.
// ============================================================================

// Потолок обрыва прогона = предел накапливаемой метрики × этот множитель
const ABORT_CEILING_FACTOR = 3;

// ----------------------------------------------------------------------------
// Диапазоны, которые зависят от модели и машины
// ----------------------------------------------------------------------------

// Минимум и шаг (1 ячейка) параметра плотности сетки — из функции snap модели
function modelGridRange(snapFn, dimensionMm, userMin, max) {
    const modelMin = Number.isFinite(dimensionMm) && dimensionMm > 0 ? snapFn(1e-9, dimensionMm) : NaN;
    if (!Number.isFinite(modelMin) || modelMin <= 0) return { min: userMin, max };

    let step = NaN;
    for (let probe = modelMin * 1e-4; probe <= modelMin * 10; probe *= 1.2) {
        const nextVal = snapFn(modelMin + probe, dimensionMm);
        if (nextVal > modelMin + 1e-12) {
            step = nextVal - modelMin;
            break;
        }
    }
    const baseMin = Math.max(userMin, modelMin);
    const min = Number.isFinite(step) && step > 0 ? Math.ceil((baseMin - 1e-12) / step) * step : baseMin;
    return Number.isFinite(step) && step > 0 ? { min, max, step } : { min, max };
}

// Нижний ТЭН наследует поля ПИД верхнего (как в normalizeMachine модели)
function getHeaterPids(baseParams) {
    const heaters = baseParams?.machine?.heaters;
    if (!Array.isArray(heaters) || heaters.length < 2) return [];
    const top = heaters[0]?.pid || null;
    const bot = (top || heaters[1]?.pid) ? { ...(top || {}), ...(heaters[1]?.pid || {}) } : null;
    return [top, bot].filter(p => p && Number.isFinite(p.periodSeconds) && p.periodSeconds > 0);
}
export function machineHasPid(baseParams) {
    return getHeaterPids(baseParams).length > 0;
}
// Сдвиг фазы повторяется с периодом НОК периодов верхнего и нижнего ТЭНа (Line 2: НОК(84, 54) = 756 с)
export function getPidPhaseRangeSeconds(baseParams, fallback = 245.0, maxCycles = 20) {
    const periods = getHeaterPids(baseParams).map(p => p.periodSeconds);
    if (periods.length === 0) return fallback;
    const toTenths = (v) => Math.max(1, Math.round(v * 10));
    const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
    let lcm = toTenths(periods[0]);
    for (const p of periods.slice(1)) {
        const t = toTenths(p);
        lcm = (lcm / gcd(lcm, t)) * t;
    }
    // Несоизмеримые периоды дают огромный НОК — ограничиваем разумным числом циклов
    return Math.min(lcm / 10, Math.max(...periods) * maxCycles);
}

// ============================================================================
// ЗАДАЧА: сетка — минимум нагрузки при допустимой ошибке
// ============================================================================
export const GRID_LOAD_TASK = defineTask({
    id: "grid_load",
    label: "Grid: minimum load",

    params: {
        gridDensityX: {
            label: "Grid density X",
            path: "simulation.accuracyMode.gridDensityX",
            unit: "/mm⁰·⁶⁴",
            // Ниже минимума модели (5 интервалов) все значения дают одну и ту же сетку
            range: (bp) => modelGridRange(snapGridDensityX, Number(bp.thicknessMm), 3.5, 25)
        },
        gridDensityY: {
            label: "Grid density Y",
            path: "simulation.accuracyMode.gridDensityY",
            unit: "/mm⁰·³⁴",
            range: (bp) => modelGridRange(snapGridDensityY, Number(bp.simulation?.widthHalfMm), 5, 25)
        },
        tempStepK: {
            label: "Temperature step",
            path: "simulation.accuracyMode.tempStepK",
            unit: "K",
            // С BDF2 ошибка по времени мала даже при крупном шаге — нужен широкий диапазон
            min: 0.3,
            max: 7,
            step: 0.01
        }
    },

    metrics: {
        cpuLoad: {
            label: "Load",
            // «Операции решателя»: 1 млн ≈ 1,6 мс расчёта (80 млн ≈ 0,13 с)
            read: (res) => res?.technicalMetrics?.iterations?.totalGridPointsProcessed,
            unit: "ops",
            resolution: 1,
            max: 80e6,
            growsOnly: true
        },
        errorScore: {
            label: "Error",
            // √(время² + сетка² + Пикар²), как в модели
            read: (res) => res?.technicalMetrics?.accuracy?.totalErrorScore,
            unit: "K",
            resolution: 0.005,
            max: 0.5
        }
    },

    minimize: "cpuLoad",
    simulation: { calculateAccuracyError: true }
});

// ============================================================================
// ЗАДАЧА: сетка — минимум ошибки при допустимой нагрузке
// ============================================================================
export const GRID_ERROR_TASK = defineTask({
    extends: GRID_LOAD_TASK,
    id: "grid_error",
    label: "Grid: minimum error",
    minimize: "errorScore"
});

// ============================================================================
// ЗАДАЧА: сдвиг фазы ПИД — максимум температуры поверхности
// ============================================================================
export const PID_MAX_TEMP_TASK = defineTask({
    id: "pid_max_temp",
    label: "PID: maximum surface temperature",
    when: machineHasPid,

    params: {
        pidPhaseOffsetSeconds: {
            label: "PID phase offset",
            path: "machine.pidPhaseOffsetSeconds",
            unit: "s",
            range: (bp) => ({ min: 0, max: getPidPhaseRangeSeconds(bp), step: 0.1 })
        }
    },

    metrics: {
        peakSurfaceTemp: {
            label: "Peak surface T",
            // Большая из температур верхней и нижней поверхности в центре листа
            read: (_res, ctx) => Math.max(ctx.surfaceTop(0), ctx.surfaceBottom(0)),
            unit: "°C",
            resolution: 0.0005
        }
    },

    maximize: "peakSurfaceTemp",
    simulation: { calculateAccuracyError: false }
});

// ============================================================================
// ЗАДАЧА: сдвиг фазы ПИД — минимум пиковой температуры поверхности
// ============================================================================
export const PID_MIN_TEMP_TASK = defineTask({
    extends: PID_MAX_TEMP_TASK,
    id: "pid_min_temp",
    label: "PID: minimum peak surface temperature",
    minimize: "peakSurfaceTemp"
});

// ============================================================================
// РЕЕСТР ЗАДАЧ
// ============================================================================
export const OPTIMIZER_TASKS = Object.fromEntries(
    [GRID_LOAD_TASK, GRID_ERROR_TASK, PID_MAX_TEMP_TASK, PID_MIN_TEMP_TASK].map(t => [t.id, t])
);

export const DEFAULT_TASK_ID = GRID_LOAD_TASK.id;

// Задачи, доступные для текущих параметров (для списка задач в интерфейсе)
export function getApplicableTasks(baseParams) {
    return Object.values(OPTIMIZER_TASKS).filter(t => typeof t.isApplicable !== "function" || t.isApplicable(baseParams));
}

// Задача с вычисленными для текущих параметров диапазонами (min выровнен по шагу)
export function resolveOptimizerTask(
    taskId = DEFAULT_TASK_ID,
    baseParams = {},
    paramOverrides = null,
    settingsOverrides = null
) {
    const task = OPTIMIZER_TASKS[taskId];
    if (!task) {
        throw new Error(`Неизвестная задача оптимизации: ${taskId}`);
    }

    const resolvedParameters = {};
    for (const [key, override] of Object.entries(paramOverrides || task.parameters)) {
        const template = task.parameters[key] || {};
        const base = typeof template.range === "function" ? template.range(baseParams) : template;
        const min = override.min ?? base.min;
        const max = override.max ?? base.max;
        const step = override.step ?? base.step;
        const hasStep = Number.isFinite(step) && step > 0;
        resolvedParameters[key] = {
            label: template.label || key,
            unit: template.unit,
            path: template.path || override.path,
            min: hasStep && Number.isFinite(min) ? alignToStep(min, step) : min,
            max,
            ...(hasStep ? { step } : {})
        };
    }

    const resolved = {
        ...task,
        parameters: resolvedParameters,
        settings: { ...task.settings, ...(settingsOverrides || {}) }
    };
    const { initPoints, totalIterations } = getAdaptiveOptimizerBudget(resolved);
    resolved.budget = { initPoints, iterations: totalIterations };
    return resolved;
}

/**
 * @typedef {Object} OptimizerSettings
 * @property {number|null} [totalBudgetIterations] Шагов на один запуск (по умолчанию — по размерности задачи)
 * @property {number|null} [randomInitPoints] Стартовых точек (по умолчанию — по размерности задачи)
 */

/**
 * Бюджет запуска: всего шагов и сколько из них стартовых. Его получает оптимизатор
 * (task.budget) и показывает интерфейс — считается только здесь.
 * Стартовых точек — по размерности задачи; маленький бюджет может их только уменьшить.
 * @param {{ parameters?: Object, settings?: OptimizerSettings }} task
 * @returns {{ initPoints: number, totalIterations: number }}
 */
export function getAdaptiveOptimizerBudget(task) {
    const numParams = Math.max(1, Object.keys(task?.parameters || {}).length);
    /** @type {OptimizerSettings} */
    const settings = task?.settings || {};
    const hasBudget = Number.isFinite(settings.totalBudgetIterations);
    const totalIterations = hasBudget
        ? Math.max(1, Math.floor(settings.totalBudgetIterations))
        : Math.max(80, numParams * 35 + 20);
    const initCap = hasBudget
        ? Math.max(6, Math.min(16, Math.floor(settings.totalBudgetIterations * 0.25)))
        : 16;
    const initPoints = Math.min(totalIterations, Number.isFinite(settings.randomInitPoints)
        ? Math.max(1, Math.floor(settings.randomInitPoints))
        : Math.min(initCap, Math.max(6, numParams * 4)));
    return { initPoints, totalIterations };
}

// ============================================================================
// СБОРКА ЗАДАЧИ ИЗ ОПИСАНИЯ
// ============================================================================
function alignToStep(value, step) {
    const str = step.toString();
    const prec = str.includes("e-")
        ? Math.min(8, Number(str.split("e-")[1]))
        : (str.includes(".") ? Math.min(6, str.length - str.indexOf(".") - 1) : 0);
    return Number((Math.ceil((value - 1e-12) / step) * step || 0).toFixed(prec));
}

function defineTask(input) {
    const parent = { ...(input.extends?.definition || {}) };
    // Новая цель заменяет унаследованную целиком (minimize ↔ maximize)
    if ("minimize" in input || "maximize" in input) {
        delete parent.minimize;
        delete parent.maximize;
    }
    const def = { ...parent, ...input };
    delete def.extends;

    const goal = def.maximize ? "max" : "min";
    const goalMetric = def.maximize || def.minimize;
    const metrics = def.metrics || {};
    if (!metrics[goalMetric]) {
        throw new Error(`Задача ${def.id}: цель «${goalMetric}» не описана в metrics`);
    }
    const hasLimit = (m) => Number.isFinite(m.max) || Number.isFinite(m.min);
    const limitOf = (name) => ({ name, min: metrics[name].min, max: metrics[name].max });
    const constraintNames = Object.keys(metrics).filter(name => name !== goalMetric && hasLimit(metrics[name]));

    const readMetric = (name, res, ctx) => {
        const v = metrics[name].read(res, ctx);
        return Number.isFinite(v) ? v : NaN;
    };

    // Прерывание: накапливаемая метрика с верхним пределом
    const abortName = Object.keys(metrics).find(name => metrics[name].growsOnly && Number.isFinite(metrics[name].max));
    const earlyAbort = abortName
        ? {
            metric: (_percent, technicalMetrics) => {
                const v = metrics[abortName].read({ technicalMetrics }, null);
                return Number.isFinite(v) ? v : 0;
            },
            ceiling: metrics[abortName].max * ABORT_CEILING_FACTOR,
            monotonic: true
        }
        : undefined;

    return {
        definition: def,
        id: def.id,
        label: def.label,
        goal,
        unit: metrics[goalMetric].unit || "",
        isApplicable: typeof def.when === "function" ? def.when : undefined,
        settings: { objectiveTransform: "auto", ...(def.settings || {}) },
        simOverrides: { ...(def.simulation || {}) },
        parameters: Object.fromEntries(
            Object.entries(def.params || {}).map(([key, p]) => [key, { label: key, ...p }])
        ),
        // Подписи и единицы метрик для интерфейса
        metricsInfo: Object.fromEntries(
            Object.entries(metrics).map(([name, m]) => [name, { label: m.label || name, unit: m.unit || "", min: m.min, max: m.max }])
        ),
        // Описание цели и пределов для интерфейса (до первого результата)
        spec: {
            objective: { name: goalMetric, unit: metrics[goalMetric].unit },
            constraints: [goalMetric, ...constraintNames].filter(n => hasLimit(metrics[n])).map(limitOf)
        },
        earlyAbort,
        evaluateResult: (res, _baseParams, ctx) => {
            const g = metrics[goalMetric];
            return {
                objective: {
                    name: goalMetric,
                    value: readMetric(goalMetric, res, ctx),
                    goal,
                    unit: g.unit,
                    min: g.min,
                    max: g.max,
                    tolerance: g.resolution
                },
                constraints: constraintNames.map(name => ({
                    name,
                    value: readMetric(name, res, ctx),
                    min: metrics[name].min,
                    max: metrics[name].max,
                    tolerance: metrics[name].resolution
                }))
            };
        }
    };
}
