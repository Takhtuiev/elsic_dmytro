import {
    snapGridDensityX,
    snapGridDensityY
} from "./heating2DModel";

// Автоматически извлекает шаг (1 ячейка) и минимум модели из её функции snap
function getModelGridBounds(snapFn, dimensionMm, userMin) {
    if (!Number.isFinite(dimensionMm) || dimensionMm <= 0) {
        return { min: userMin, step: NaN };
    }

    const modelMin = snapFn(1e-9, dimensionMm);
    if (!Number.isFinite(modelMin) || modelMin <= 0) {
        return { min: userMin, step: NaN };
    }

    let step = NaN;
    let probe = modelMin * 1e-4;
    while (probe <= modelMin * 10) {
        const nextVal = snapFn(modelMin + probe, dimensionMm);
        if (nextVal > modelMin + 1e-12) {
            step = nextVal - modelMin;
            break;
        }
        probe *= 1.2;
    }

    const baseMin = Math.max(userMin, modelMin);
    const alignedMin = Number.isFinite(step) && step > 0
        ? Math.ceil((baseMin - 1e-12) / step) * step
        : baseMin;

    return { min: alignedMin, step };
}

const extractGridMetrics = (res) => {
    const acc = res?.technicalMetrics?.accuracy;
    const load = res?.technicalMetrics?.iterations?.totalGridPointsProcessed;

    const timeErr = acc?.timeIntegrationErrorC;
    const gridErr = acc?.spatialGridErrorC;
    const picardErr = Number.isFinite(acc?.picardConvergenceErrorC)
        ? Math.abs(acc.picardConvergenceErrorC)
        : NaN;

    const errorScore = (
        Number.isFinite(timeErr) && timeErr >= 0 &&
        Number.isFinite(gridErr) && gridErr >= 0 &&
        Number.isFinite(picardErr) && picardErr >= 0
    )
        ? Math.hypot(timeErr, gridErr, picardErr)
        : NaN;

    return { load, errorScore };
};

// ============================================================================
// ЗАДАЧА 1: Оптимизация сетки (минимизация нагрузки)
// ============================================================================
export const GRID_LOAD_TASK = {
    id: "grid_load",
    label: "Оптимизация сетки (мин. нагрузка)",
    goal: "min",
    unit: "ops",

    settings: {
        randomInitPoints: null,
        totalBudgetIterations: null
    },

    simOverrides: {
        calculateAccuracyError: true
    },

    parameters: {
        gridDensityX: {
            label: "gridDensityX",
            path: "simulation.accuracyMode.gridDensityX",
            unit: "/mm⁰·⁶⁴",
            min: 3.50,
            max: 25.00,
            step: (baseParams) => getModelGridBounds(snapGridDensityX, Number(baseParams.thicknessMm), 3.50).step
        },
        gridDensityY: {
            label: "gridDensityY",
            path: "simulation.accuracyMode.gridDensityY",
            unit: "/mm⁰·³⁴",
            min: 5.00,
            max: 25.00,
            step: (baseParams) => getModelGridBounds(snapGridDensityY, Number(baseParams.simulation?.widthHalfMm), 5.00).step
        },
        tempStepK: {
            label: "tempStepK",
            path: "simulation.accuracyMode.tempStepK",
            unit: "K",
            min: 0.30,
            max: 2.50,
            step: 0.01
        }
    },

    earlyAbort: {
        metric: (_percent, techMetrics) => techMetrics?.iterations?.totalGridPointsProcessed ?? 0,
        ceiling: 27000000 * 3
    },

    evaluateResult: (res) => {
        const { load, errorScore } = extractGridMetrics(res);

        return {
            objective: {
                value: load,
                goal: "min",
                unit: "ops"
            },
            constraints: [
                { name: "errorScore", value: errorScore, max: 0.5 },
                { name: "cpuLoad", value: load, max: 25000000 }
            ]
        };
    }
};

// ============================================================================
// ЗАДАЧА 2: Оптимизация сетки (минимизация ошибки)
// ============================================================================
export const GRID_ERROR_TASK = {
    ...GRID_LOAD_TASK,
    id: "grid_error",
    label: "Оптимизация сетки (мин. ошибка)",
    goal: "min",
    unit: "K",

    evaluateResult: (res) => {
        const { load, errorScore } = extractGridMetrics(res);

        return {
            objective: {
                value: errorScore,
                goal: "min",
                unit: "K"
            },
            constraints: [
                { name: "errorScore", value: errorScore, max: 0.5 },
                { name: "cpuLoad", value: load, max: 25000000 }
            ]
        };
    }
};

// ============================================================================
// ЗАДАЧА 3: Подбор pidPhaseOffsetSeconds (МАКСИМУМ температуры поверхности)
// ============================================================================
export const PID_MAX_TEMP_TASK = {
    id: "pid_max_temp",
    label: "Сдвиг фазы ПИД (макс. T поверхности)",
    goal: "max",
    unit: "°C",

    settings: {
        randomInitPoints: 8,
        totalBudgetIterations: 35
    },

    simOverrides: {
        calculateAccuracyError: false
    },

    parameters: {
        pidPhaseOffsetSeconds: {
            label: "pidPhaseOffsetSeconds",
            path: "machine.pidPhaseOffsetSeconds",
            unit: "s",
            min: 0.0,
            max: (baseParams) => baseParams?.machine?.heaters?.[0]?.pid?.periodSeconds || 245.0,
            step: 0.1
        }
    },

    evaluateResult: (_res, _baseParams, ctx) => {
        const maxSurfaceT = Math.max(ctx.surfaceTop(0), ctx.surfaceBottom(0));

        return {
            objective: {
                value: maxSurfaceT,
                goal: "max",
                unit: "°C"
            },
            constraints: []
        };
    }
};

// ============================================================================
// ЗАДАЧА 4: Подбор pidPhaseOffsetSeconds (МИНИМУМ температуры поверхности)
// ============================================================================
export const PID_MIN_TEMP_TASK = {
    id: "pid_min_temp",
    label: "Сдвиг фазы ПИД (мин. T поверхности)",
    goal: "min",
    unit: "°C",

    settings: {
        randomInitPoints: 8,
        totalBudgetIterations: 35
    },

    simOverrides: {
        calculateAccuracyError: false
    },

    parameters: {
        pidPhaseOffsetSeconds: {
            label: "pidPhaseOffsetSeconds",
            path: "machine.pidPhaseOffsetSeconds",
            unit: "s",
            min: 0.0,
            max: (baseParams) => baseParams?.machine?.heaters?.[0]?.pid?.periodSeconds || 245.0,
            step: 0.1
        }
    },

    evaluateResult: (_res, _baseParams, ctx) => {
        const maxSurfaceT = Math.max(ctx.surfaceTop(0), ctx.surfaceBottom(0));

        return {
            objective: {
                value: maxSurfaceT,
                goal: "min",
                unit: "°C"
            },
            constraints: []
        };
    }
};

// ============================================================================
// РЕЕСТР ЗАДАЧ И УТИЛИТЫ ИНИЦИАЛИЗАЦИИ
// ============================================================================
export const OPTIMIZER_TASKS = {
    [GRID_LOAD_TASK.id]: GRID_LOAD_TASK,
    [GRID_ERROR_TASK.id]: GRID_ERROR_TASK,
    [PID_MAX_TEMP_TASK.id]: PID_MAX_TEMP_TASK,
    [PID_MIN_TEMP_TASK.id]: PID_MIN_TEMP_TASK
};

export const DEFAULT_TASK_ID = GRID_LOAD_TASK.id;

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

    const rawParams = paramOverrides || task.parameters;
    const resolvedParameters = {};

    for (const [key, range] of Object.entries(rawParams)) {
        const template = task.parameters[key];
        const rawMin = range.min ?? template?.min;
        const rawMax = range.max ?? template?.max;
        const rawStep = range.step ?? template?.step;

        let min = typeof rawMin === "function" ? rawMin(baseParams) : rawMin;
        const max = typeof rawMax === "function" ? rawMax(baseParams) : rawMax;
        const step = typeof rawStep === "function" ? rawStep(baseParams) : rawStep;

        if (Number.isFinite(step) && step > 0 && Number.isFinite(min)) {
            min = Math.ceil((min - 1e-12) / step) * step || 0;
        }

        resolvedParameters[key] = {
            ...range,
            path: template?.path || range.path,
            min,
            max,
            ...(Number.isFinite(step) && step > 0 ? { step } : {})
        };
    }

    return {
        ...task,
        parameters: resolvedParameters,
        settings: {
            ...task.settings,
            ...(settingsOverrides || {})
        }
    };
}

export function getAdaptiveOptimizerBudget(task) {
    const paramsObj = task?.parameters || {};
    const settings = task?.settings || {};
    const numParams = Math.max(1, Object.keys(paramsObj).length);
    const initPoints = Number.isFinite(settings.randomInitPoints)
        ? Math.max(1, Math.floor(settings.randomInitPoints))
        : Math.max(6, numParams * 4);
    const totalIterations = Number.isFinite(settings.totalBudgetIterations)
        ? Math.max(1, Math.floor(settings.totalBudgetIterations))
        : Math.max(80, numParams * 35 + 20);
    return { initPoints, totalIterations };
}
