import { useState, useEffect, useRef, useCallback } from "react";

// Base configuration for grid search space boundaries
const OPTIMIZER_BASE_CONFIG = {
    gridX:        { min: 0.05,  max: 0.85 },
    gridY:        { min: 0.15,  max: 2.50 },
    minGrid:      { min: 0.003, max: 0.15 },
    maxIter:      { min: 4,     max: 24   },
    tolerance:    { min: 0.001, max: 0.40 },
    maxDt:        { min: 0.05,  max: 4.0  },
    targetDt:     { min: 0.02,  max: 3.0  },
    growthFactor: { min: 1.01,  max: 1.40 },
    shrinkFactor: { min: 0.45,  max: 0.85 }
};

// Global settings configurations
const OPTIMIZER_SETTINGS = {
    optimizationObjective: 'minimize_load',
    maxErrorScore: 0.5,
    maxAllowedLoad: 500000,
    totalBudgetIterations: 50,
    randomInitPoints: 10
};

// Функция генерации штампа времени
function getTimestamp() {
    const now = new Date();
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return now.toLocaleTimeString('ru-RU', { hour12: false }) + `.${ms}`;
}

export function useGridOptimizer(state, setState) {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [logs, setLogs] = useState([]);

    const workerRef = useRef(null);
    const logsStaticRef = useRef([]);

    // Функция инициализации воркера
    const initWorker = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
        }

        workerRef.current = new Worker(
            new URL("./optimization.worker.js", import.meta.url),
            { type: "module" }
        );

        workerRef.current.onmessage = (e) => {
            const { status, data, percent, error, logMessage } = e.data;

            if (status === "progress_tick") {
                const totalSteps = logsStaticRef.current.filter(l => l.text.includes('🧠') || l.text.includes('🎲')).length;
                setLogs([
                    ...logsStaticRef.current,
                    {
                        text: `⏳ [Физический движок]: Выполнение симуляции на шаге ${totalSteps}... Прогресс: ${percent}%`,
                        timestamp: getTimestamp()
                    }
                ]);
                return;
            }

            if (status === "log_step" && logMessage) {
                logsStaticRef.current.push({
                    text: logMessage,
                    timestamp: getTimestamp()
                });
                setLogs([...logsStaticRef.current]);
                return;
            }

            // 3. Завершение работы алгоритма
            if (status === "success") {
                setIsOptimizing(false);
                setState(prev => ({
                    ...prev,
                    simulation: { ...prev.simulation, accuracyMode: data.optimalLimits }
                }));

                const limits = data.optimalLimits || {};
                const cfg = OPTIMIZER_BASE_CONFIG;
                const settings = OPTIMIZER_SETTINGS; // Доступ к глобальным настройкам оптимизатора

                // Переводим технический индификатор задачи на понятный инженерный язык
                const objectiveText = settings.optimizationObjective === 'minimize_load'
                    ? "МАКСИМАЛЬНАЯ СКОРОСТЬ (Минимизация вычислительной нагрузки сетки)"
                    : "МАКСИМАЛЬНАЯ ТОЧНОСТЬ (Минимизация оценочного критерия ошибки)";

                const finalSummary = [
                    ...logsStaticRef.current,
                    { text: `\n=======================================================`, timestamp: getTimestamp() },
                    { text: `🏆 [ОПТИМИЗАТОР]: ФИНАЛЬНЫЙ ТЕХНИЧЕСКИЙ ОТЧЕТ И СВЕДЕНИЯ`, timestamp: getTimestamp() },
                    { text: `=======================================================`, timestamp: getTimestamp() },
                    {
                        text: data.metrics.isFallbackActivated
                            ? `⚠️ КОМПРОМИСС: Ограничения не выполнены физически. Сработал сбалансированный фолбек.`
                            : `✅ УСПЕХ: Параметры сетки успешно подобраны под критерии модели.`,
                        timestamp: getTimestamp()
                    },
                    { text: `-------------------------------------------------------`, timestamp: getTimestamp() },
                    { text: `🎯 ИСХОДНЫЕ КРИТЕРИИ И ОГРАНИЧЕНИЯ ЗАДАЧИ:`, timestamp: getTimestamp() },
                    { text: `   🔹 Выполняемая задача:       ${objectiveText}`, timestamp: getTimestamp() },
                    { text: `   🔹 Лимит error score (max):  <= ${settings.maxErrorScore}`, timestamp: getTimestamp() },
                    { text: `   🔹 Лимит нагрузки (max):     <= ${settings.maxAllowedLoad.toLocaleString('ru-RU')} расчетных точек`, timestamp: getTimestamp() },
                    { text: `   🔹 Общий бюджет итераций:    ${settings.totalBudgetIterations} шагов (из них инициализация: ${settings.randomInitPoints})`, timestamp: getTimestamp() },
                    { text: `-------------------------------------------------------`, timestamp: getTimestamp() },
                    { text: `📊 ДОСТИГНУТЫЕ ПОКАЗАТЕЛИ ЭФФЕКТИВНОСТИ:`, timestamp: getTimestamp() },
                    { text: `   📈 Итоговый error score:      ${data.metrics.resultingErrorScore?.toFixed(3) ?? "—"}`, timestamp: getTimestamp() },
                    { text: `   ⚡ Вычислительная нагрузка:    ${data.metrics.achievedLoad.toLocaleString('ru-RU')} расчетных точек`, timestamp: getTimestamp() },
                    { text: `-------------------------------------------------------`, timestamp: getTimestamp() },
                    { text: `🛠️ ОПТИМАЛЬНАЯ КОНФИГУРАЦИЯ МАТЕМАТИЧЕСКОГО СОЛВЕРА:`, timestamp: getTimestamp() },
                    { text: `   🔹 gridX (Шаг по горизонтали):        ${limits.gridX?.toFixed(4)} мм  [в границах: ${cfg.gridX.min} .. ${cfg.gridX.max} мм]`, timestamp: getTimestamp() },
                    { text: `   🔹 gridY (Шаг по вертикали):          ${limits.gridY?.toFixed(4)} мм  [в границах: ${cfg.gridY.min} .. ${cfg.gridY.max} мм]`, timestamp: getTimestamp() },
                    { text: `   🔹 minGrid (Мин. предел ячейки):     ${limits.minGrid?.toFixed(4)} мм  [в границах: ${cfg.minGrid.min} .. ${cfg.minGrid.max} мм]`, timestamp: getTimestamp() },
                    { text: `   🔹 maxIter (Итераций петли Picard):   ${limits.maxIter} шагов  [в границах: ${cfg.maxIter.min} .. ${cfg.maxIter.max} шагов]`, timestamp: getTimestamp() },
                    { text: `   🔹 tolerance (Допуск сходимости):     ${limits.tolerance?.toFixed(5)} K  [в границах: ${cfg.tolerance.min} .. ${cfg.tolerance.max} K]`, timestamp: getTimestamp() },
                    { text: `   🔹 maxDt (Макс. шаг времени):         ${limits.maxDt?.toFixed(2)} с  [в границах: ${cfg.maxDt.min} .. ${cfg.maxDt.max} с]`, timestamp: getTimestamp() },
                    { text: `   🔹 targetDt (Целевой квант времени):  ${limits.targetDt?.toFixed(2)} с  [в границах: ${cfg.targetDt.min} .. ${cfg.targetDt.max} с]`, timestamp: getTimestamp() },
                    { text: `   🔹 growthFactor (Коэф. расширения):   ${limits.growthFactor?.toFixed(2)}  [в границах: ${cfg.growthFactor.min} .. ${cfg.growthFactor.max}]`, timestamp: getTimestamp() },
                    { text: `   🔹 shrinkFactor (Коэф. сжатия):       ${limits.shrinkFactor?.toFixed(2)}  [в границах: ${cfg.shrinkFactor.min} .. ${cfg.shrinkFactor.max}]`, timestamp: getTimestamp() },
                    { text: `=======================================================`, timestamp: getTimestamp() },
                    { text: `🏆 [Байесовский UI]: Тензоры сетки обновлены. Модель готова к запуску симуляции.`, timestamp: getTimestamp() }
                ];
                logsStaticRef.current = finalSummary;
                setLogs(finalSummary);
            } else if (status === "error") {
                setIsOptimizing(false);
                logsStaticRef.current.push({
                    text: `❌ [Байесовский UI]: Ошибка оптимизации: ${error}`,
                    timestamp: getTimestamp()
                });
                setLogs([...logsStaticRef.current]);
            }
        };
    }, [setState]);

    // Инициализируем воркер при первом монтировании
    useEffect(() => {
        initWorker();
        return () => workerRef.current?.terminate();
    }, [initWorker]);

    // ФУНКЦИЯ ПРИНУДИТЕЛЬНОЙ ОСТАНОВКИ ПОТОКА ВОРКЕРА
    const abortOptimization = useCallback(() => {
        if (!isOptimizing) return;

        setIsOptimizing(false);

        // Намертво убиваем поток вычислений воркера
        if (workerRef.current) {
            workerRef.current.terminate();
        }

        // Выводим в CLI системный лог о прерывании задачи пользователем
        const abortLog = {
            text: "🚨 [SYSTEM_CRIT]: Процесс байесовского подбора был принудительно прерван пользователем. Поток воркера сброшен.",
            timestamp: getTimestamp()
        };
        logsStaticRef.current.push(abortLog);
        setLogs([...logsStaticRef.current]);

        // Готовим чистый новый воркер для возможности повторного перезапуска задачи
        initWorker();
    }, [isOptimizing, initWorker]);

    const runOptimization = useCallback(() => {
        if (!workerRef.current) return;

        setIsOptimizing(true);
        setIsLogOpen(true);

        const initMsg = "🟢 [Байесовский подбор]: Запущена внешняя задача оптимизации пространства сеток...";
        const startLog = [{ text: initMsg, timestamp: getTimestamp() }];
        setLogs(startLog);
        logsStaticRef.current = startLog;

        const thickness = Number(state.geometry.thickness) || 0;

        workerRef.current.postMessage({
            baseParams: {
                thicknessMm: thickness,
                material: { ...state.material },
                machine: { ...state.machine },
                simulation: {
                    ...state.simulation,
                    widthHalfMm: state.simulation.widthHalfMm !== undefined
                        ? state.simulation.widthHalfMm
                        : (Number(state.geometry.width) / 2 || 20)
                }
            },
            options: {
                ...OPTIMIZER_SETTINGS,
                config: OPTIMIZER_BASE_CONFIG
            }
        });
    }, [state]);

    return {
        isOptimizing,
        runOptimization,
        abortOptimization, // Возвращаем функцию остановки наружу в интерфейс
        isLogOpen,
        setIsLogOpen,
        logs,
        openLogJournal: () => setIsLogOpen(true),
        hasLogs: logs.length > 0
    };
}
