export const OPTIMIZER_BASE_CONFIG = {
    // 📐 Пространственная сетка: Срезаем опасную микро-сетку
    gridX:        { min: 0.02,   max: 0.50, label: "gridX (Thickness step)",   unit: "mm",    digits: 4 },
    gridY:        { min: 0.1,   max: 1.50, label: "gridY (Width step)",       unit: "mm",    digits: 4 }, // Минимум 0.15 мм вместо 0.001
    minGrid:      { min: 0.010,  max: 0.4, label: "minGrid (Min grid cell)",  unit: "mm",    digits: 4 }, // Защита от ячеек в 3 микрона

    // 🎯 Допуск сходимости: Защита от бесконечного Пикара
    tolerance:    { min: 0.0005,  max: 0.5, label: "tolerance (Conv. tolerance)", unit: "K",     digits: 5 }, // Не даем опускаться до 0.001 K

    // ⏱️ Временная сетка: Защита от зависания и "майнинга" шагов времени
    maxDt:        { min: 0.10,   max: 4.00, label: "maxDt (Max time step)",    unit: "s",     digits: 2 }, // Меньше 0.3 с делать нельзя
    targetDt:     { min: 0.10,   max: 3.00, label: "targetDt (Target dt quant)", unit: "s",    digits: 2 }, // Меньше 0.15 с делать нельзя

    // 📈 Адаптивный шаг во времени
    growthFactor: { min: 1.05,   max: 1.8,  label: "growthFactor (Time expand)", unit: "",      digits: 3 }, // Быстрый выход из тяжелых зон
    shrinkFactor: { min: 0.20,   max: 0.9, label: "shrinkFactor (Time shrink)", unit: "",      digits: 2 }
};

export const OPTIMIZER_SETTINGS = {
    optimizationObjective: 'minimize_load',  // minimize_load , minimize_error
    maxErrorScore: 0.50,
    maxAllowedLoad: 25000000,
    randomInitPoints: 24,
    totalBudgetIterations: 200,
    earlyAbortLoadMultiplier: 2
};
