/* eslint-disable no-restricted-globals */
import {
    buildIsobands,
    buildIsolines,
    buildSectionField,
    findHalfWidthAboveLevel
} from "./IsothermsModel";

/**
 * Генерирует массивы точек для графиков React-компонента на основе физики материала
 * и рассчитанного двумерного температурного профиля.
 */
export function prepareGeometryData(material, result2D, ui = {}) {
    const profileData = result2D?.temperatureProfile;
    if (!profileData) return null;

    const showVerticalSlice = ui.showVerticalSlice ?? true;
    const showHorizontalWidth = Boolean(ui.showHorizontalWidth);
    const showContours2D = Boolean(ui.showContours2D);
    const showTimeDynamics = Boolean(ui.showTimeDynamics);
    const showHeaterDynamics = ui.showHeaterDynamics ?? true;

    const { xCoordinatesMm, yCoordinatesMm, Nx, Ny, heating, pause } = profileData;
    const thickness = xCoordinatesMm[Nx - 1];
    const width = (yCoordinatesMm[Ny - 1] * 2);
    const matKFactor = material?.kFactor ?? 0;

    // Расчет дельта Т для вертикального среза прямо на месте
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
        if (showVerticalSlice) vertPointsHeating.push([xCoord, valH]);
        if (Number.isFinite(valH)) {
            if (valH > heatingMaxT) heatingMaxT = valH;
            if (valH < heatingMinT) heatingMinT = valH;
            hasValidH = true;
        }

        // Данные для фазы паузы (охлаждения)
        const valP = pause[idx];
        if (showVerticalSlice) vertPointsPause.push([xCoord, valP]);
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

    if (showHorizontalWidth && Ny > 1) {
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
    }

    // --- Гибочная зона: полуширина, на которой нейтральный слой (толщина × K) выше Tg после паузы ---
    // Температура берётся линейно между слоями сетки, а не в ближайшем слое
    const glassTransition = Number(material?.glassTransitionTemp);
    const finalXTgPauseValue = Number.isFinite(glassTransition)
        ? findHalfWidthAboveLevel(pause, Nx, Ny, xCoordinatesMm, yCoordinatesMm, thickness * matKFactor, glassTransition)
        : null;

    // --- CHART 4 (Contours & Polygons) ---
    let contourGraphsRaw = [];
    let fillPolygonsRaw = [];
    let fillPolygonsByPhase = { Heating: [], Pause: [] };

    if (showContours2D && Ny > 1 && Nx > 1) {
        const Tmin = Number(material?.minFormingTemp);
        const Tmax = Number(material?.maxFormingTemp);
        const Tdecomp = Number(material?.decompositionTemp);
        const levels = [
            { name: "Tg", value: glassTransition },
            { name: "T min", value: Tmin },
            { name: "T max", value: Tmax },
            { name: "Decomposition", value: Tdecomp }
        ].filter(l => Number.isFinite(l.value));

        const fields = {
            Heating: buildSectionField(heating, Nx, Ny, xCoordinatesMm, yCoordinatesMm),
            Pause: buildSectionField(pause, Nx, Ny, xCoordinatesMm, yCoordinatesMm)
        };

        // Изотермы обеих фаз: ломаные через null
        for (const phase of ["Heating", "Pause"]) {
            for (const level of levels) {
                const lines = buildIsolines(fields[phase], level.value);
                if (!lines.length) continue;
                const points = [];
                lines.forEach((line, k) => {
                    if (k) points.push(null);
                    for (const p of line) points.push(p);
                });
                contourGraphsRaw.push({ name: level.name, phase, points });
            }
        }

        // Зоны (полосы между изотермами, кольца через null) — для конца нагрева и после паузы
        const edges = [-Infinity, glassTransition, Tmin, Tmax, Tdecomp, Infinity];
        const zoneNames = ["Solid Plastic", "High Elastic", "Optimal Bending", "High Temperature", "Decomposition Risk"];
        const bands = zoneNames
            .map((key, k) => ({ key, lo: edges[k], hi: edges[k + 1] }))
            .filter(b => !Number.isNaN(b.lo) && !Number.isNaN(b.hi) && b.lo < b.hi);
        const buildZones = (field) => {
            const zoneRings = buildIsobands(field, bands);
            return bands
                .map(b => {
                    const rings = zoneRings.get(b.key) || [];
                    if (!rings.length) return null;
                    const points = [];
                    rings.forEach((ring, k) => {
                        if (k) points.push(null);
                        for (const p of ring) points.push(p);
                    });
                    return { name: b.key, lo: b.lo, hi: b.hi, points };
                })
                .filter(Boolean);
        };
        fillPolygonsByPhase = { Heating: buildZones(fields.Heating), Pause: buildZones(fields.Pause) };
        fillPolygonsRaw = fillPolygonsByPhase.Pause;
    }

    // --- CHART 2 (Time Dynamics) ---
    const graphsChart2Raw = [];
    if (showTimeDynamics && result2D.history) {
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

    // --- CHART 5 (Heater Dynamics) ---
    const graphsHeaterRaw = [];
    if (showHeaterDynamics && result2D.history?.topHeaterC && result2D.history?.bottomHeaterC) {
        const hist2D = result2D.history;
        const times = hist2D.time || [];
        const heatTimeSec = Number(result2D.heatingTimeSeconds || 0);

        const topHeaterPoints = [];
        const bottomHeaterPoints = [];

        for (let i = 0; i < times.length; i++) {
            const t = times[i];
            if (t <= heatTimeSec) {
                const topC = hist2D.topHeaterC[i];
                const botC = hist2D.bottomHeaterC[i];

                if (topC !== null && Number.isFinite(Number(topC))) {
                    topHeaterPoints.push([t, Number(topC)]);
                }
                if (botC !== null && Number.isFinite(Number(botC))) {
                    bottomHeaterPoints.push([t, Number(botC)]);
                }
            }
        }

        graphsHeaterRaw.push(
            { name: "Top Heater", points: topHeaterPoints, typeKey: "topHeater" },
            { name: "Bottom Heater", points: bottomHeaterPoints, typeKey: "bottomHeater" }
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
        fillPolygonsByPhase,
        graphsChart2Raw,
        graphsHeaterRaw,
        heatingDeltaT,
        pauseDeltaT
    };
}