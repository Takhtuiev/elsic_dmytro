import { useEffect, useState } from "react";

// Пауза после последнего изменения перед запуском расчёта: при наборе числа
// не запускается симуляция на каждую цифру
const DEBOUNCE_MS = 250;

// Owns Worker lifecycle; the heating algorithm remains in heating.worker.js.
// Предыдущий результат остаётся на экране, пока считается новый.
export const useHeatingSimulation = (physicsProfile, validationError) => {
    const [result2D, setResult2D] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!physicsProfile || validationError) {
            setResult2D(null);
            setIsCalculating(false);
            setProgress(0);
            return undefined;
        }

        setIsCalculating(true);
        setProgress(0);
        let isCancelled = false;
        let worker = null;

        const fail = (message) => {
            setResult2D({ status: { type: "error", message }, geometryData: null });
            setProgress(0);
            setIsCalculating(false);
        };

        const timer = setTimeout(() => {
            worker = new Worker(
                new URL("./heating.worker.js", import.meta.url),
                { type: "module" }
            );

            worker.onmessage = (event) => {
                if (isCancelled) return;
                const { type, percent, result2D: workerResult, geometryData, error } = event.data;

                if (type === "PROGRESS") {
                    setProgress(Math.round(percent));
                    return;
                }

                if (error || type === "ERROR") {
                    console.error("Heating worker error:", error);
                    fail(error || "Critical calculation error");
                } else {
                    // Успешный расчёт ("ok") или физическое предупреждение ("warn")
                    setResult2D(workerResult ? { ...workerResult, geometryData } : null);
                    setProgress(100);
                    setIsCalculating(false);
                }
                worker.terminate();
            };

            worker.onerror = (event) => {
                if (isCancelled) return;
                console.error("Heating worker error:", event);
                fail(event?.message || "Calculation worker failed");
                worker.terminate();
            };

            worker.postMessage({ profile: physicsProfile });
        }, DEBOUNCE_MS);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
            worker?.terminate();
        };
    }, [physicsProfile, validationError]);

    return { result2D, isCalculating, progress };
};
