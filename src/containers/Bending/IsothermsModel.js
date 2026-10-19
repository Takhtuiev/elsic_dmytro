// isothermsModel.js

const EPS = 0.001;

// Вынесенные чистые хелперы для предотвращения создания замыканий в циклах
const interpolateCoordinate = (t1, t2, c1, c2, target) => {
    const dt = t2 - t1;
    if (Math.abs(dt) < 0.001) return c1;
    return c1 + (target - t1) * (c2 - c1) / dt;
};

const crossesTarget = (t1, t2, targetTemp) =>
    Number.isFinite(t1) &&
    Number.isFinite(t2) &&
    ((t1 <= targetTemp && t2 >= targetTemp) || (t1 >= targetTemp && t2 <= targetTemp));

/**
 * Пакетный расчет нескольких изотерм за ОДИН проход по массиву температур T_flat
 * @param {Array<{targetTemp: number, key: string}>} targets - Массив целевых температур с ключами для идентификации
 * @param {Float32Array|Array<number>} T_flat - Плоский массив температур всей сетки
 * @param {Object} gridConfig - Конфигурация сетки (Nx, Ny, xCoordinatesMm, yCoordinatesMm)
 * @returns {Object} Объект, где ключи — это переданные key, а значения — массивы сегментов segmentsRight
 */
export const findMultipleIsothermsBatch = (targets, T_flat, gridConfig) => {
    const result = {};
    if (!targets?.length || !T_flat?.length || !gridConfig) return result;

    const { Nx, Ny, xCoordinatesMm, yCoordinatesMm } = gridConfig;
    if (Nx < 1 || Ny < 2 || T_flat.length < Nx * Ny) return result;

    const maxSemiWidth = yCoordinatesMm[Ny - 1];
    const lenTargets = targets.length;

    // Инициализируем структуры данных для каждой изотермы
    const states = new Array(lenTargets);
    for (let t = 0; t < lenTargets; t++) {
        const target = targets[t];
        result[target.key] = [];
        result[target.key].targetTemp = target.targetTemp;

        states[t] = {
            targetTemp: target.targetTemp,
            segmentsRight: result[target.key],
            currentSegment: [],
            lastValidI: -1
        };
    }

    // Хелпер добавления точки (инлайненный для скорости)
    const addPoint = (segment, point) => {
        if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
        const len = segment.length;
        if (len > 0) {
            const last = segment[len - 1];
            if (Math.abs(last[0] - point[0]) < EPS && Math.abs(last[1] - point[1]) < EPS) return;
        }
        segment.push(point);
    };

    // Хелпер для получения граничных точек
    const getEdgePoint = (i1, i2, targetTemp) => {
        if (i1 < 0 || i2 >= Nx) return null;
        const idx1_base = i1 * Ny;
        const idx2_base = i2 * Ny;
        const x1 = xCoordinatesMm[i1];
        const x2 = xCoordinatesMm[i2];

        // 1. Боковая граница
        const t1_side = T_flat[idx1_base + Ny - 1];
        const t2_side = T_flat[idx2_base + Ny - 1];
        if (crossesTarget(t1_side, t2_side, targetTemp)) {
            const sideY = interpolateCoordinate(t1_side, t2_side, x1, x2, targetTemp);
            if (Number.isFinite(sideY)) return [maxSemiWidth, sideY];
        }

        // 2. Центральная граница
        const t1_cent = T_flat[idx1_base];
        const t2_cent = T_flat[idx2_base];
        if (crossesTarget(t1_cent, t2_cent, targetTemp)) {
            const centerY = interpolateCoordinate(t1_cent, t2_cent, x1, x2, targetTemp);
            if (Number.isFinite(centerY)) return [0, centerY];
        }
        return null;
    };

    // Идем по строкам сетки (координата X)
    for (let i = 0; i < Nx; i++) {
        const offset = i * Ny;
        const xCoord = xCoordinatesMm[i];

        // Массив, в который соберем ширину для каждой изотермы на ТЕКУЩЕЙ строке i
        // Инициализируем null
        const widthsAtRow = new Array(lenTargets).fill(null);

        // Вложенный цикл по Y: считываем температуры ячеек ОДИН раз
        let t1 = T_flat[offset];
        for (let j = 0; j < Ny - 1; j++) {
            const t2 = T_flat[offset + j + 1];

            // Проверяем эту пару температур сразу для ВСЕХ изотерм
            for (let t = 0; t < lenTargets; t++) {
                // Если для этой изотермы на этой строке уже нашли ширину — пропускаем
                if (widthsAtRow[t] !== null) continue;

                const targetTemp = states[t].targetTemp;
                if (crossesTarget(t1, t2, targetTemp)) {
                    const width = interpolateCoordinate(t1, t2, yCoordinatesMm[j], yCoordinatesMm[j + 1], targetTemp);
                    if (Number.isFinite(width) && width >= 0) {
                        widthsAtRow[t] = width;
                    }
                }
            }
            t1 = t2;
        }

        // Теперь обрабатываем сегменты для каждой изотермы на основе полученных ширин
        for (let t = 0; t < lenTargets; t++) {
            const state = states[t];
            const width = widthsAtRow[t];

            if (width === null) {
                if (state.currentSegment.length > 0) {
                    if (state.lastValidI >= 0 && state.lastValidI < Nx - 1) {
                        addPoint(state.currentSegment, getEdgePoint(state.lastValidI, state.lastValidI + 1, state.targetTemp));
                    }
                    state.segmentsRight.push(state.currentSegment);
                    state.currentSegment = [];
                }
                state.lastValidI = -1;
                continue;
            }

            if (state.lastValidI !== i - 1 && state.currentSegment.length > 0) {
                state.segmentsRight.push(state.currentSegment);
                state.currentSegment = [];
            }

            if (state.currentSegment.length === 0 && i > 0) {
                addPoint(state.currentSegment, getEdgePoint(i - 1, i, state.targetTemp));
            }

            addPoint(state.currentSegment, [width, xCoord]);
            state.lastValidI = i;
        }
    }

    // Финализируем оставшиеся сегменты в самом конце
    for (let t = 0; t < lenTargets; t++) {
        const state = states[t];
        if (state.currentSegment.length > 0) {
            if (state.lastValidI >= 0 && state.lastValidI < Nx - 1) {
                addPoint(state.currentSegment, getEdgePoint(state.lastValidI, state.lastValidI + 1, state.targetTemp));
            }
            state.segmentsRight.push(state.currentSegment);
        }
    }

    return result;
};


export const buildSymmetricIsothermGraph = (segmentsRight, name, phase, lineStyle = {}, gridConfig) => {
    if (!segmentsRight?.length || !gridConfig) return [];

    const baseProps = { showMarker: false, showPoints: false, ...lineStyle };
    const combinedIsothermPoints = [];

    // Замена .forEach на классический цикл для минимизации замыканий и оверхеда
    for (let s = 0; s < segmentsRight.length; s++) {
        const segRight = segmentsRight[s];
        const n = segRight.length;
        if (n === 0) return;

        const startsAtCenter = Math.abs(segRight[0][0]) < EPS;
        const endsAtCenter = Math.abs(segRight[n - 1][0]) < EPS;

        if (combinedIsothermPoints.length > 0) {
            combinedIsothermPoints.push(null);
        }

        // Вместо concat и slice пушим элементы напрямую в результирующий массив (нет лишней аллокации памяти)
        if (startsAtCenter) {
            for (let i = n - 1; i >= 0; i--) {
                combinedIsothermPoints.push([-segRight[i][0], segRight[i][1]]);
            }
            for (let i = 1; i < n; i++) {
                combinedIsothermPoints.push(segRight[i]);
            }
        } else if (endsAtCenter) {
            for (let i = 0; i < n; i++) {
                combinedIsothermPoints.push(segRight[i]);
            }
            for (let i = n - 2; i >= 0; i--) {
                combinedIsothermPoints.push([-segRight[i][0], segRight[i][1]]);
            }
        } else {
            for (let i = 0; i < n; i++) {
                combinedIsothermPoints.push([-segRight[i][0], segRight[i][1]]);
            }
            combinedIsothermPoints.push(null);
            for (let i = 0; i < n; i++) {
                combinedIsothermPoints.push(segRight[i]);
            }
        }
    }

    if (combinedIsothermPoints.length === 0) return [];
    return [{ name, phase, points: combinedIsothermPoints, ...baseProps }];
};

export const buildIsothermFillPolygons = (fills, boundaryPoints = [], isotherms = [], heating, pause) => {
    if (!Array.isArray(boundaryPoints) || boundaryPoints.length < 4) return [];

    // Оптимизация 1: Поиск экстремумов за один проход вместо четырех .map()
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < boundaryPoints.length; i++) {
        const p = boundaryPoints[i];
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
    }

    const width = xMax - xMin;
    const height = yMax - yMin;
    const perimeter = 2 * (width + height);
    if (!(perimeter > 0)) return [];

    const toPerimeterPosition = point => {
        if (!point) return null;
        const x = point[0];
        const y = point[1];
        if (Math.abs(y - yMin) < EPS) return x - xMin;
        if (Math.abs(x - xMax) < EPS) return width + y - yMin;
        if (Math.abs(y - yMax) < EPS) return width + height + xMax - x;
        if (Math.abs(x - xMin) < EPS) return 2 * width + height + yMax - y;
        return null;
    };

    const samePoint = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

    const splitSegments = segments => {
        if (!Array.isArray(segments) || !segments.length) return [];
        if (Number.isFinite(segments[0])) segments = [segments];

        const result = [];
        for (let i = 0; i < segments.length; i++) {
            const item = segments[i];
            let segment = [];
            for (let j = 0; j < item.length; j++) {
                const pt = item[j];
                if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
                    if (segment.length >= 2) result.push(segment);
                    segment = [];
                } else {
                    segment.push(pt);
                }
            }
            if (segment.length >= 2) result.push(segment);
        }
        return result;
    };

    const closePolygon = points => {
        const result = [];
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            if (pt && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
                if (!result.length || !samePoint(result[result.length - 1], pt)) {
                    result.push([pt[0], pt[1]]);
                }
            }
        }
        if (result.length < 3) return null;
        if (!samePoint(result[0], result[result.length - 1])) {
            result.push([result[0][0], result[0][1]]);
        }
        return result.length >= 4 ? result : null;
    };

    const walkPerimeter = (start, direction, candidates, closurePoint) => {
        const startPos = toPerimeterPosition(start);
        if (startPos == null) return null;

        let selected = null;
        let minOffset = Infinity;

        for (let i = 0; i < candidates.length; i++) {
            const cand = candidates[i];
            if (!cand?.point) continue;
            const pos = cand.position ?? toPerimeterPosition(cand.point);
            if (pos == null) continue;

            const offset = direction > 0
                ? (pos - startPos + perimeter) % perimeter
                : (startPos - pos + perimeter) % perimeter;

            if (offset > EPS && offset < minOffset) {
                minOffset = offset;
                selected = { ...cand, position: pos, offset };
            }
        }

        if (closurePoint) {
            const closPos = toPerimeterPosition(closurePoint);
            if (closPos != null) {
                const offset = direction > 0
                    ? (closPos - startPos + perimeter) % perimeter
                    : (startPos - closPos + perimeter) % perimeter;
                if (offset > EPS && offset < minOffset) {
                    selected = { point: closurePoint, position: closPos, isClosure: true, offset };
                }
            }
        }

        if (!selected) return null;

        const intermediate = [];
        const cornerPositions = [0, width, width + height, 2 * width + height];
        const cornerCoords = [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]];

        for (let i = 0; i < 4; i++) {
            const offset = direction > 0
                ? (cornerPositions[i] - startPos + perimeter) % perimeter
                : (startPos - cornerPositions[i] + perimeter) % perimeter;
            if (offset > EPS && offset < selected.offset - EPS) {
                intermediate.push({ coords: cornerCoords[i], offset });
            }
        }
        intermediate.sort((a, b) => a.offset - b.offset);

        const path = [start];
        for (let i = 0; i < intermediate.length; i++) path.push(intermediate[i].coords);
        path.push(selected.point);

        return { ...selected, path };
    };

    const getBoundaryDirection = (point, minTemp, maxTemp, phase) => {
        const startPos = toPerimeterPosition(point);
        if (startPos == null || minTemp > maxTemp) return null;

        const temperatures = phase === "Heating" ? heating : pause;

        let bestDistanceForward = Infinity;
        let bestDistanceBackward = Infinity;
        let forwardSampleTemp = null;
        let backwardSampleTemp = null;

        for (let i = 0; i < boundaryPoints.length; i++) {
            const p = boundaryPoints[i];
            if (!Number.isFinite(p.position) || !Number.isInteger(p.index)) continue;
            const t = temperatures[p.index];
            if (!Number.isFinite(t) || Math.abs(t - maxTemp) <= EPS) continue;

            const distF = (p.position - startPos + perimeter) % perimeter;
            if (distF > EPS && distF < bestDistanceForward) {
                bestDistanceForward = distF;
                forwardSampleTemp = t;
            }

            const distB = (startPos - p.position + perimeter) % perimeter;
            if (distB > EPS && distB < bestDistanceBackward) {
                bestDistanceBackward = distB;
                backwardSampleTemp = t;
            }
        }

        const isOk = temp => temp !== null && temp < maxTemp && temp >= minTemp - EPS;
        const fOk = isOk(forwardSampleTemp);
        const bOk = isOk(backwardSampleTemp);

        if (fOk && !bOk) return 1;
        if (bOk && !fOk) return -1;
        return null;
    };

    const getIsothermSegments = (name, phase) => {
        if (!name) return [];
        for (let i = 0; i < isotherms.length; i++) {
            if (isotherms[i].name === name && isotherms[i].phase === phase) return isotherms[i].segments || [];
        }
        return [];
    };

    const result = [];

    fills.forEach(fill => {
        const phase = fill.phase ?? "Pause";
        const fromSegments = splitSegments(getIsothermSegments(fill.fromIsotherm, phase));
        const toSegments = splitSegments(getIsothermSegments(fill.toIsotherm, phase));
        if (!fromSegments.length && !toSegments.length) return;

        const allSegments = [];
        for (let i = 0; i < fromSegments.length; i++) allSegments.push({ graphName: "from", segment: fromSegments[i], used: false });
        for (let i = 0; i < toSegments.length; i++) allSegments.push({ graphName: "to", segment: toSegments[i], used: false });

        const addPolygon = points => {
            const polygon = closePolygon(points);
            if (!polygon) return;
            result.push({ name: fill.name, points: polygon, color: fill.color, opacity: fill.opacity ?? 0.15 });
        };

        // Оптимизация 2: Кэшируем эндпоинты в плоскую структуру для быстрого поиска связей вместо O(N^2)
        const getEndpoints = () => {
            const endpoints = [];
            for (let i = 0; i < allSegments.length; i++) {
                const item = allSegments[i];
                if (item.used) continue;
                endpoints.push({ item, endpointIndex: 0, point: item.segment[0] });
                endpoints.push({ item, endpointIndex: item.segment.length - 1, point: item.segment[item.segment.length - 1] });
            }
            return endpoints;
        };

        const findConnectedEndpoint = (point, excludedItems) => {
            const endpoints = getEndpoints();
            for (let i = 0; i < endpoints.length; i++) {
                const cand = endpoints[i];
                if (!excludedItems.has(cand.item) && samePoint(cand.point, point)) return cand;
            }
            return null;
        };

        allSegments.forEach(initialSegment => {
            if (initialSegment.used) return;

            const startPoint = initialSegment.segment[0];
            const chain = [...initialSegment.segment];
            const chainSegments = new Set([initialSegment]);

            let currentEndpoint = initialSegment.segment[initialSegment.segment.length - 1];
            let closed = false;

            while (chainSegments.size <= allSegments.length) {
                const connected = findConnectedEndpoint(currentEndpoint, chainSegments);
                if (connected) {
                    const nextItem = connected.item;
                    const nextSeg = nextItem.segment;
                    if (connected.endpointIndex === 0) {
                        for (let i = 1; i < nextSeg.length; i++) chain.push(nextSeg[i]);
                    } else {
                        for (let i = nextSeg.length - 2; i >= 0; i--) chain.push(nextSeg[i]);
                    }
                    chainSegments.add(nextItem);
                    currentEndpoint = chain[chain.length - 1];

                    if (samePoint(currentEndpoint, startPoint)) { closed = true; break; }
                    continue;
                }

                if (toPerimeterPosition(currentEndpoint) == null) break;

                const direction = getBoundaryDirection(currentEndpoint, fill.minTemp, fill.maxTemp, phase);
                if (direction == null) break;

                const endpoints = getEndpoints();
                const candidates = [];
                for (let i = 0; i < endpoints.length; i++) {
                    const c = endpoints[i];
                    if (!chainSegments.has(c.item) && !samePoint(c.point, currentEndpoint)) {
                        const pos = toPerimeterPosition(c.point);
                        if (pos !== null) candidates.push({ ...c, position: pos });
                    }
                }

                const next = walkPerimeter(currentEndpoint, direction, candidates, startPoint);
                if (!next) break;

                for (let i = 1; i < next.path.length; i++) chain.push(next.path[i]);

                if (next.isClosure) {
                    closed = samePoint(chain[chain.length - 1], startPoint);
                    break;
                }

                const nextItem = next.item;
                if (!nextItem || chainSegments.has(nextItem)) break;

                const nextSeg = nextItem.segment;
                if (next.endpointIndex === 0) {
                    for (let i = 1; i < nextSeg.length; i++) chain.push(nextSeg[i]);
                } else {
                    for (let i = nextSeg.length - 2; i >= 0; i--) chain.push(nextSeg[i]);
                }
                chainSegments.add(nextItem);
                currentEndpoint = chain[chain.length - 1];

                if (samePoint(currentEndpoint, startPoint)) { closed = true; break; }
            }

            if (closed) {
                addPolygon(chain);
                chainSegments.forEach(item => { item.used = true; });
            }
        });
    });

    return result;
};

export const buildSymmetricFillPolygons = polygons => {
    if (!Array.isArray(polygons)) return [];
    const result = [];

    for (let i = 0; i < polygons.length; i++) {
        const poly = polygons[i];
        if (!poly.points || poly.points.length === 0) {
            result.push(poly);
            continue;
        }

        const pts = poly.points;
        const n = pts.length;

        const isClosed = n >= 2 &&
            Math.abs(pts[0][0] - pts[n - 1][0]) < 0.001 &&
            Math.abs(pts[0][1] - pts[n - 1][1]) < 0.001;

        const coreLen = isClosed ? n - 1 : n;

        let touchesCenter = false;
        for (let j = 0; j < coreLen; j++) {
            if (pts[j] !== null && Math.abs(pts[j][0]) < 0.001) {
                touchesCenter = true;
                break;
            }
        }

        if (touchesCenter) {
            const combinedPoints = [];
            // Разворачиваем и зеркалим налету (без лишнего выделения памяти)
            for (let j = coreLen - 1; j >= 0; j--) {
                const pt = pts[j];
                combinedPoints.push(pt === null ? null : [-pt[0], pt[1]]);
            }
            for (let j = 0; j < coreLen; j++) {
                combinedPoints.push(pts[j]);
            }

            const uniquePoints = [];
            for (let j = 0; j < combinedPoints.length; j++) {
                const pt = combinedPoints[j];
                if (pt === null) {
                    uniquePoints.push(null);
                    continue;
                }

                const uLen = uniquePoints.length;
                if (uLen > 0) {
                    const last = uniquePoints[uLen - 1];
                    if (last !== null &&
                        Math.abs(last[0] - pt[0]) < 0.001 &&
                        Math.abs(last[1] - pt[1]) < 0.001) {
                        continue;
                    }
                }
                uniquePoints.push(pt);
            }

            if (isClosed && uniquePoints.length >= 3) {
                const first = uniquePoints[0];
                const last = uniquePoints[uniquePoints.length - 1];
                if (Math.abs(first[0] - last[0]) > 0.001 || Math.abs(first[1] - last[1]) > 0.001) {
                    uniquePoints.push([first[0], first[1]]);
                }
            }

            result.push({ ...poly, points: uniquePoints });
        } else {
            // Оптимизация 3: Строим левые точки «на лету» без метода .map()
            const leftPoints = new Array(n);
            for (let j = 0; j < n; j++) {
                const pt = pts[j];
                leftPoints[j] = pt === null ? null : [-pt[0], pt[1]];
            }

            result.push({ ...poly, points: leftPoints });
            result.push(poly);
        }
    }

    return result;
};
