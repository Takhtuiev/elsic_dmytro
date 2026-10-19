/* eslint-disable no-restricted-globals */
import { simulate2DHeating } from "./heating2DModel";
import {
    buildIsothermFillPolygons,
    buildSymmetricFillPolygons,
    buildSymmetricIsothermGraph,
    findMultipleIsothermsBatch
} from "./IsothermsModel";

function prepareGeometryData(profile, result2D) {
    const profileData = result2D?.temperatureProfile;
    if (!profileData) return null;

    const { xCoordinatesMm, yCoordinatesMm, Nx, Ny, heating, pause } = profileData;
    const thickness = xCoordinatesMm[Nx - 1] || Number(profile?.thickness || 0);
    const width = (yCoordinatesMm[Ny - 1] * 2) || Number(profile?.width || 0);
    const matKFactor = profile?.material?.kFactor ?? 0;

    // Расчет дельта Т для вертикального среза прямо на месте
    // --- ИСПРАВЛЕННЫЙ БЛОК: Глобальный расчет экстремумов для DeltaT ---
    // --- ИСПРАВЛЕННЫЙ БЛОК: Расчет DeltaT и точек Графика 1 строго для центра Y = 0 ---
    let heatingMaxT = -Infinity, heatingMinT = Infinity;
    let pauseMaxT = -Infinity, pauseMinT = Infinity;
    let hasValidH = false, hasValidP = false;

    const vertPointsHeating = [];
    const vertPointsPause = [];
    const targetYIdx = 0; // Индекс геометрического центра детали по ширине

    for (let i = 0; i < Nx; i++) {
        const xCoord = xCoordinatesMm[i];
        const idx = i * Ny + targetYIdx;

        // Данные для фазы нагрева
        const valH = heating[idx];
        vertPointsHeating.push([xCoord, valH]);
        if (Number.isFinite(valH)) {
            if (valH > heatingMaxT) heatingMaxT = valH;
            if (valH < heatingMinT) heatingMinT = valH;
            hasValidH = true;
        }

        // Данные для фазы паузы (охлаждения)
        const valP = pause[idx];
        vertPointsPause.push([xCoord, valP]);
        if (Number.isFinite(valP)) {
            if (valP > pauseMaxT) pauseMaxT = valP;
            if (valP < pauseMinT) pauseMinT = valP;
            hasValidP = true;
        }
    }

    const heatingDeltaT = hasValidH ? (heatingMaxT - heatingMinT) : null;
    const pauseDeltaT = hasValidP ? (pauseMaxT - pauseMinT) : null;

    // --- CHART 3 (Horizontal Width) ---
    const rawHorTopH = [], rawHorMidH = [], rawHorBotH = [];
    const rawHorTopP = [], rawHorMidP = [], rawHorBotP = [];
    const midXIdx = Math.floor(Nx / 2);
    const botXIdx = Nx - 1;

    for (let j = Ny - 1; j > 0; j--) {
        const yCoord = yCoordinatesMm[j];
        if (yCoord > 0) {
            const negY = -yCoord;
            rawHorTopH.push([negY, heating[j]]);
            rawHorMidH.push([negY, heating[midXIdx * Ny + j]]);
            rawHorBotH.push([negY, heating[botXIdx * Ny + j]]);
            rawHorTopP.push([negY, pause[j]]);
            rawHorMidP.push([negY, pause[midXIdx * Ny + j]]);
            rawHorBotP.push([negY, pause[botXIdx * Ny + j]]);
        }
    }
    for (let j = 0; j < Ny; j++) {
        const yCoord = yCoordinatesMm[j];
        rawHorTopH.push([yCoord, heating[j]]);
        rawHorMidH.push([yCoord, heating[midXIdx * Ny + j]]);
        rawHorBotH.push([yCoord, heating[botXIdx * Ny + j]]);
        rawHorTopP.push([yCoord, pause[j]]);
        rawHorMidP.push([yCoord, pause[midXIdx * Ny + j]]);
        rawHorBotP.push([yCoord, pause[botXIdx * Ny + j]]);
    }

    // --- ИСПРАВЛЕННЫЙ РАСЧЕТ: Точка перехода Tg на нейтральной линии (учитывая K-Factor) ---
    const glassTransition = Number(profile?.material?.glassTransitionTemp);
    let yTgPause = null; // 🌟 ИСПРАВЛЕНО: Переименовано в yTgPause, так как ищем координату по ширине (Y)

    if (Number.isFinite(glassTransition)) {
        // Находим слой по толщине, максимально близкий к нейтральной линии изгиба (X)
        const targetXValue = thickness * matKFactor;
        let closestXIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < Nx; i++) {
            const diff = Math.abs(xCoordinatesMm[i] - targetXValue);
            if (diff < minDiff) {
                minDiff = diff;
                closestXIdx = i;
            }
        }

        // Проверяем изменение температуры по ширине (Y) на уровне нейтральной линии
        const rowOffset = closestXIdx * Ny;
        for (let j = 0; j < Ny - 1; j++) {
            const t1 = pause[rowOffset + j];
            const t2 = pause[rowOffset + j + 1];
            if ((t1 >= glassTransition && t2 <= glassTransition) || (t1 <= glassTransition && t2 >= glassTransition)) {
                const y1 = yCoordinatesMm[j];
                const y2 = yCoordinatesMm[j + 1];
                if (Math.abs(t2 - t1) < 1e-5) {
                    yTgPause = y1;
                } else {
                    yTgPause = y1 + (glassTransition - t1) * (y2 - y1) / (t2 - t1);
                }
                break;
            }
        }
    }
    // 🌟 Передаем корректное имя в возвращаемый объект воркера
    const finalXTgPauseValue = (yTgPause !== null && yTgPause <= width / 2) ? yTgPause : null;


    // --- CHART 4 (Contours & Polygons) ---
    const Tmin = Number(profile?.material?.minFormingTemp);
    const Tmax = Number(profile?.material?.maxFormingTemp);
    const Tdecomp = Number(profile?.material?.decompositionTemp);
    const gridConfig = { Nx, Ny, xCoordinatesMm, yCoordinatesMm };

    const boundaryPoints = (() => {
        const points = [];
        const maxWidth = yCoordinatesMm[Ny - 1];
        const maxThickness = xCoordinatesMm[Nx - 1];
        const addPoint = (i, j, pos) => {
            const index = i * Ny + j;
            points.push({ x: yCoordinatesMm[j], y: xCoordinatesMm[i], temperature: pause[index], index, position: pos });
        };
        for (let j = 0; j < Ny; j++) addPoint(0, j, yCoordinatesMm[j]);
        for (let i = 1; i < Nx; i++) addPoint(i, Ny - 1, maxWidth + xCoordinatesMm[i]);
        for (let j = Ny - 2; j >= 0; j--) addPoint(Nx - 1, j, maxWidth + maxThickness + maxWidth - yCoordinatesMm[j]);
        for (let i = Nx - 2; i > 0; i--) addPoint(i, 0, 2 * maxWidth + maxThickness + maxThickness - xCoordinatesMm[i]);
        return points;
    })();

    const heatingTargets = [{ targetTemp: glassTransition, key: "tg" }, { targetTemp: Tmin, key: "tmin" }, { targetTemp: Tmax, key: "tmax" }, { targetTemp: Tdecomp, key: "tdecomp" }];
    const pauseTargets = [{ targetTemp: glassTransition, key: "tg" }, { targetTemp: Tmin, key: "tmin" }, { targetTemp: Tmax, key: "tmax" }, { targetTemp: Tdecomp, key: "tdecomp" }];

    const heatingBatch = findMultipleIsothermsBatch(heatingTargets, heating, gridConfig);
    const pauseBatch = findMultipleIsothermsBatch(pauseTargets, pause, gridConfig);

    const isotherms = [
        { name: "Tg", phase: "Heating", segments: heatingBatch.tg, style: {} },
        { name: "T min", phase: "Heating", segments: heatingBatch.tmin, style: {} },
        { name: "T max", phase: "Heating", segments: heatingBatch.tmax, style: {} },
        { name: "Decomposition", phase: "Heating", segments: heatingBatch.tdecomp, style: {} },
        { name: "Tg", phase: "Pause", segments: pauseBatch.tg, style: {} },
        { name: "T min", phase: "Pause", segments: pauseBatch.tmin, style: {} },
        { name: "T max", phase: "Pause", segments: pauseBatch.tmax, style: {} },
        { name: "Decomposition", phase: "Pause", segments: pauseBatch.tdecomp, style: {} },
    ];

    const contourGraphsRaw = isotherms.flatMap(({ name, phase, segments, style }) => {
        const rawLines = buildSymmetricIsothermGraph(segments, name, phase, style, gridConfig);
        return rawLines.map(g => ({
            name: g.name,
            phase: g.phase,
            points: g.points
        }));
    });

    const polygonFillsConfig = [
        { name: "Solid Plastic", fromIsotherm: "Tg", toIsotherm: null, minTemp: -Infinity, maxTemp: glassTransition, phase: "Pause" },
        { name: "High Elastic", fromIsotherm: "Tg", toIsotherm: "T min", minTemp: glassTransition, maxTemp: Tmin, phase: "Pause" },
        { name: "Optimal Bending", fromIsotherm: "T min", toIsotherm: "T max", minTemp: Tmin, maxTemp: Tmax, phase: "Pause" },
        { name: "High Temperature", fromIsotherm: "T max", toIsotherm: "Decomposition", minTemp: Tmax, maxTemp: Tdecomp, phase: "Pause" },
        { name: "Decomposition Risk", fromIsotherm: "Decomposition", toIsotherm: null, minTemp: Tdecomp, maxTemp: Infinity, phase: "Heating" }
    ];

    const fillPolygonsRaw = buildSymmetricFillPolygons(
        buildIsothermFillPolygons(polygonFillsConfig, boundaryPoints, isotherms, heating, pause)
    );

    // --- CHART 2 (Time Dynamics) ---
    const graphsChart2Raw = [];
    if (result2D.history) {
        const hist2D = result2D.history;
        const times = hist2D.time || [];
        const heatTimeSec = Number(result2D.heatingTimeSeconds || 0);

        const heatFront = [], heatCenter = [], heatBack = [];
        const coolFront = [], coolCenter = [], coolBack = [];
        let lastHeatPoint = null;

        for (let i = 0; i < times.length; i++) {
            const t = times[i];
            const fC = Number(hist2D.frontSurfaceC[i]);
            const cC = Number(hist2D.centerC[i]);
            const bC = Number(hist2D.backSurfaceC[i]);

            if (t <= heatTimeSec) {
                heatFront.push([t, fC]);
                heatCenter.push([t, cC]);
                heatBack.push([t, bC]);
                lastHeatPoint = [t, fC, cC, bC];
            } else {
                if (coolFront.length === 0 && lastHeatPoint !== null) {
                    coolFront.push([lastHeatPoint[0], lastHeatPoint[1]]);
                    coolCenter.push([lastHeatPoint[0], lastHeatPoint[2]]);
                    coolBack.push([lastHeatPoint[0], lastHeatPoint[3]]);
                }
                coolFront.push([t, fC]);
                coolCenter.push([t, cC]);
                coolBack.push([t, bC]);
            }
        }

        graphsChart2Raw.push(
            { name: "Front Surface (2D) - Heating", points: heatFront, typeKey: "frontHeat" },
            { name: "Center (2D) - Heating", points: heatCenter, typeKey: "centerHeat" },
            { name: "Back Surface (2D) - Heating", points: heatBack, typeKey: "backHeat" },
            { name: "Front Surface (2D) - Cooling", points: coolFront, typeKey: "frontCool" },
            { name: "Center (2D) - Cooling", points: coolCenter, typeKey: "centerCool" },
            { name: "Back Surface (2D) - Cooling", points: coolBack, typeKey: "backCool" }
        );
    }

    return {
        thickness,
        width,
        matKFactor,
        xCoordinatesMm,
        finalXTgPauseValue,
        vertPointsHeating,
        vertPointsPause,
        rawHorTopH, rawHorMidH, rawHorBotH,
        rawHorTopP, rawHorMidP, rawHorBotP,
        contourGraphsRaw,
        fillPolygonsRaw,
        graphsChart2Raw,
        heatingDeltaT,
        pauseDeltaT
    };
}

self.onmessage = (event) => {
    const { profile } = event.data;

    if (!profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
        self.postMessage({ type: "SUCCESS", result2D: null, geometryData: null });
        return;
    }

    try {
        const result2D = simulate2DHeating({
            thicknessMm: profile.thickness,
            material: profile.material,
            machine: profile.machine,
            simulation: profile.simulation,
            storeHistory: profile.simulation?.recordHistory ?? false,
            onProgress: (percent) => {
                self.postMessage({ type: "PROGRESS", percent });
            }
        });

        const geometryData = prepareGeometryData(profile, result2D);

        // Используем Transferable Objects для мгновенного переноса буферов Float32Array без глубокого копирования
        const transfers = [];
        if (result2D?.temperatureProfile?.heating?.buffer) {
            transfers.push(result2D.temperatureProfile.heating.buffer);
        }
        if (result2D?.temperatureProfile?.pause?.buffer) {
            transfers.push(result2D.temperatureProfile.pause.buffer);
        }

        self.postMessage({ type: "SUCCESS", result2D, geometryData }, transfers);
    } catch (error) {
        self.postMessage({ type: "ERROR", error: error.message, result2D: null, geometryData: null });
    }
};
