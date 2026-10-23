import { useEffect, useState } from "react";

// Owns Worker lifecycle; the heating algorithm remains in heating.worker.js.
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

        const worker = new Worker(
            new URL("./heating.worker.js", import.meta.url),
            { type: "module" }
        );

        worker.onmessage = (event) => {
            if (isCancelled) return;
            const { type, percent, result2D: workerResult, geometryData, error } = event.data;

            if (type === "PROGRESS") {
                setProgress(percent);
                return;
            }

            if (error) {
                console.error("Worker error:", error);
            } else {
                setResult2D({ ...workerResult, geometryData });
                setProgress(100);
            }
            setIsCalculating(false);
        };

        worker.onerror = (error) => {
            if (isCancelled) return;
            console.error("Heating worker error:", error);
            setIsCalculating(false);
        };

        worker.postMessage({ profile: physicsProfile });

        return () => {
            isCancelled = true;
            worker.terminate();
        };
    }, [physicsProfile, validationError]);

    return { result2D, isCalculating, progress };
};
