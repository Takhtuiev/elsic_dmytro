export const ENABLE_DIAGNOSTIC_LOGS = true;

export function createDiagnosticLogger() {
    if (!ENABLE_DIAGNOSTIC_LOGS) {
        return {
            log: () => {},
            getText: () => null
        };
    }

    const lines = [];

    return {
        log: payload => {
            lines.push(JSON.stringify(payload));
        },
        getText: () => (lines.length > 0 ? lines.join("\n") : null)
    };
}

export async function downloadDiagnosticLog(logText) {
    if (!ENABLE_DIAGNOSTIC_LOGS || !logText) return;

    try {
        await fetch("/__save-optimizer-log", {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: logText
        });
    } catch (err) {
        console.error("Failed to save the diagnostic log to the project:", err);
    }
}
