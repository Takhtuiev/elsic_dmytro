const ARC_RADIUS = 12, LABEL_OFFSET = 12, ANGLE_LABEL_OFFSET = 6, FONT_SIZE = 14;
const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-5;

const rotatePoint = (p, rad) => ({
    x: p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: p.x * Math.sin(rad) + p.y * Math.cos(rad)
});

const createPathData = (a, b) => ({
    a, b,
    sideAPath: a.map(p => `${p.x} ${p.y}`).join(" L "),
    sideBPath: b.map(p => `${p.x} ${p.y}`).join(" L "),
    fillPoints: [...a, ...[...b].reverse()].map(p => `${p.x},${p.y}`).join(" ")
});

// 1. ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ РАСЧЕТА РАЗМЕРА ПОЛКИ (СТРОГИЙ ПЕРПЕНДИКУЛЯР)
const calculateShelfLabel = (startPoint, endPoint, oppStartPoint, oppEndPoint, lengthText) => {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const len = Math.hypot(dx, dy);

    if (len <= EPSILON) return null;

    let angle = Math.atan2(dy, dx) * RAD_TO_DEG;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;

    const midX = (startPoint.x + endPoint.x) / 2;
    const midY = (startPoint.y + endPoint.y) / 2;

    const oppMidX = (oppStartPoint.x + oppEndPoint.x) / 2;
    const oppMidY = (oppStartPoint.y + oppEndPoint.y) / 2;

    let bx = -dy / len;
    let by = dx / len;

    const tX = midX - oppMidX;
    const tY = midY - oppMidY;

    if (bx * tX + by * tY < 0) {
        bx = -bx;
        by = -by;
    }

    const textHeight = FONT_SIZE;
    const halfH = textHeight / 2;
    const textRadius = Math.abs(by) * halfH;
    const totalOffset = LABEL_OFFSET + textRadius;

    return {
        text: `${lengthText}`,
        unit: "mm",
        x: midX + bx * totalOffset,
        y: midY + by * totalOffset,
        angle,
        fontSize: FONT_SIZE
    };
};

// 2. ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ РАСЧЕТА ДУГИ УГЛА (ВЫНОС СКВОЗЬ ТОЛЩИНУ МЕТАЛЛА)
const calculateBendAngle = (vertex, prevPoint, nextPoint, oppVertex, bendText) => {
    const v1 = { x: prevPoint.x - vertex.x, y: prevPoint.y - vertex.y };
    const v2 = { x: nextPoint.x - vertex.x, y: nextPoint.y - vertex.y };

    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);

    if (l1 <= EPSILON || l2 <= EPSILON) return null;

    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    const u2 = { x: v2.x / l2, y: v2.y / l2 };

    const p1 = { x: vertex.x + u1.x * ARC_RADIUS, y: vertex.y + u1.y * ARC_RADIUS };
    const p2 = { x: vertex.x + u2.x * ARC_RADIUS, y: vertex.y + u2.y * ARC_RADIUS };

    const tX = vertex.x - oppVertex.x;
    const tY = vertex.y - oppVertex.y;
    const tLen = Math.hypot(tX, tY);

    let bx = 0, by = 0;
    if (tLen > EPSILON) {
        bx = tX / tLen;
        by = tY / tLen;
    } else {
        bx = -u1.y;
        by = u1.x;
    }

    const strokeX = p2.x - p1.x;
    const strokeY = p2.y - p1.y;
    const sweep = (strokeX * by - strokeY * bx) < 0 ? 1 : 0;

    const textWidth = bendText.length * FONT_SIZE * 0.6;
    const textHeight = FONT_SIZE;
    const halfW = textWidth / 2;
    const halfH = textHeight / 2;
    const textRadius = Math.abs(bx) * halfW + Math.abs(by) * halfH;

    const totalOffset = ARC_RADIUS + ANGLE_LABEL_OFFSET + textRadius;

    return {
        text: bendText,
        x: vertex.x + bx * totalOffset,
        y: vertex.y + by * totalOffset,
        path: `M ${p1.x} ${p1.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${sweep} ${p2.x} ${p2.y}`,
        bx, by,
        fontSize: FONT_SIZE
    };
};

// 3. ВЫНЕСЕННАЯ ФУНКЦИЯ: ГЕОМЕТРИЧЕСКИЙ РАСЧЕТ СИНЕЙ ПОЛКИ ОТ ВНЕШНЕГО УГЛА
const calculateBlueRawData = (geometry, profile, firstBendIdx, viewMode, blueLength, rotatedSideA, rotatedSideB) => {
    if (firstBendIdx < 0 || blueLength <= 0) return null;

    const bendVertexIdx = firstBendIdx + 1;
    const isToEnd = viewMode === "toEnd";

    const bend = profile.bends?.[firstBendIdx];
    const shelf = geometry.shelvesData[isToEnd ? firstBendIdx + 1 : firstBendIdx];

    if (!bend || !shelf) return null;

    const isInnerRight = bend.direction === "right";
    const outerSideGeo = isInnerRight ? rotatedSideA : rotatedSideB;
    const innerSideGeo = isInnerRight ? rotatedSideB : rotatedSideA;

    const outerApex = outerSideGeo[bendVertexIdx];
    const innerApex = innerSideGeo[bendVertexIdx];

    const targetIdx = isToEnd ? bendVertexIdx + 1 : bendVertexIdx - 1;
    const d = outerSideGeo[targetIdx];

    if (!outerApex || !innerApex || !d) return null;

    const dx = d.x - outerApex.x;
    const dy = d.y - outerApex.y;
    const l = Math.hypot(dx, dy);

    if (l <= EPSILON) return null;

    const ux = dx / l;
    const uy = dy / l;
    const nx = -uy;
    const ny = ux;

    const tx = innerApex.x - outerApex.x;
    const ty = innerApex.y - outerApex.y;
    const sideSign = tx * nx + ty * ny >= 0 ? 1 : -1;
    const thickness = Number(profile.thickness) || 0;

    const outerEnd = { x: outerApex.x + ux * blueLength, y: outerApex.y + uy * blueLength };
    const innerEnd = {
        x: outerEnd.x + nx * sideSign * thickness,
        y: outerEnd.y + ny * sideSign * thickness
    };

    return {
        outerApex, innerApex, outerEnd, innerEnd,
        shelfIsTop: shelf.isTop,
        bendVertexIdx,
        outerSide: outerSideGeo,
        innerSide: innerSideGeo
    };
};

// 4. ВЫНЕСЕННАЯ ФУНКЦИЯ: СБОРКА СЛОЯ СИНЕЙ ПОЛКИ (ПЕРЕВОД В СКАЛЯР ЭКРАНА)
const buildBlueLayer = (blueRawData, profile, firstBendIdx, blueLength, rotatedSideA, rotatedSideB, cv) => {
    if (!blueRawData) return null;

    const a = [cv(blueRawData.outerApex), cv(blueRawData.outerEnd)];
    const b = [cv(blueRawData.innerApex), cv(blueRawData.innerEnd)];

    const scrA = rotatedSideA.map(cv);
    const scrB = rotatedSideB.map(cv);
    const idx = blueRawData.bendVertexIdx;
    const bend = (profile.bends || [])[firstBendIdx];

    let ang = null;
    if (bend) {
        const inner = bend.direction === "right";
        const pcFull = inner ? scrB : scrA;
        const ocFull = inner ? scrA : scrB;

        ang = calculateBendAngle(pcFull[idx], pcFull[idx - 1], pcFull[idx + 1], ocFull[idx], `${bend.angle}°`);
    }

    const lbl = calculateShelfLabel(a[0], a[1], b[0], b[1], blueLength);

    return {
        ...createPathData(a, b),
        labels: lbl ? [lbl] : [],
        angles: ang ? [ang] : [],
        strokeStartCap: false,
        strokeEndCap: true
    };
};

// ГЛАВНЫЙ ЭКСПОРТНЫЙ МЕТОД
export const prepareSvgLayers = (geometry, profile, VW, VH, PADDING, referenceBend) => {
    if (!geometry.sideA?.length) return null;

    const firstBendIdx = Number(referenceBend?.index ?? -1);
    const viewMode = profile.bendViewMode || "toEnd";
    const totalShelves = geometry.shelvesData.length;
    const blueLength = Number(referenceBend?.length) || 0;

    let rotationAngle = 0;
    if (firstBendIdx >= 0) {
        const i = viewMode === "toEnd" ? firstBendIdx + 1 : firstBendIdx;
        const s = geometry.shelvesData[i];
        if (s) rotationAngle = viewMode === "toEnd" ? s.angleRad : s.angleRad + Math.PI;
    }

    let rotatedSideA = geometry.sideA.map(p => rotatePoint(p, rotationAngle));
    let rotatedSideB = geometry.sideB.map(p => rotatePoint(p, rotationAngle));

    if (firstBendIdx >= 0) {
        const v = rotatedSideA[firstBendIdx + 1];
        const n = rotatedSideA[viewMode === "toEnd" ? firstBendIdx : firstBendIdx + 2];
        if (v && n && n.y - v.y > 0) {
            rotatedSideA = rotatedSideA.map(p => ({ ...p, y: -p.y }));
            rotatedSideB = rotatedSideB.map(p => ({ ...p, y: -p.y }));
        }
    }

    // Расчет сырых данных для синей полки вынесен в отдельную чистую функцию
    const blueRawData = calculateBlueRawData(geometry, profile, firstBendIdx, viewMode, blueLength, rotatedSideA, rotatedSideB);

    const allPts = [
        ...rotatedSideA, ...rotatedSideB,
        ...(blueRawData ? [blueRawData.outerEnd, blueRawData.innerEnd] : [])
    ];

    const minX = Math.min(...allPts.map(p => p.x));
    const maxX = Math.max(...allPts.map(p => p.x));
    const minY = Math.min(...allPts.map(p => p.y));
    const maxY = Math.max(...allPts.map(p => p.y));

    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const scale = Math.min((VW - PADDING * 2) / w, (VH - PADDING * 2) / h);
    const ox = (VW - w * scale) / 2;
    const oy = (VH - h * scale) / 2;

    const cv = p => ({
        x: ox + (p.x - minX) * scale,
        y: oy + (p.y - minY) * scale
    });

    const buildLayer = (start, end) => {
        const a = rotatedSideA.slice(start, end + 1).map(cv);
        const b = rotatedSideB.slice(start, end + 1).map(cv);
        const fullA = rotatedSideA.map(cv);
        const fullB = rotatedSideB.map(cv);

        const labels = [];
        const angles = [];
        const profileBends = profile.bends || [];

        geometry.shelvesData.slice(start, end).forEach((sh, j) => {
            const g = start + j;
            const cur = sh.isTop ? a : b;
            const opp = sh.isTop ? b : a;

            const lbl = calculateShelfLabel(cur[j], cur[j + 1], opp[j], opp[j + 1], sh.length);
            if (lbl) labels.push(lbl);

            const bend = profileBends[g];
            if (bend && g !== firstBendIdx) {
                const inner = bend.direction === "right";
                const pcFull = inner ? fullB : fullA;
                const ocFull = inner ? fullA : fullB;
                const vertexIdx = g + 1;

                const ang = calculateBendAngle(
                    pcFull[vertexIdx],     // vertex
                    pcFull[vertexIdx - 1], // prevPoint
                    pcFull[vertexIdx + 1], // nextPoint
                    ocFull[vertexIdx],     // oppVertex (ИСПРАВЛЕНО: строго текущий индекс вершины)
                    `${bend.angle}°`       // bendText
                );
                if (ang) angles.push(ang);
            }
        });

        return {
            ...createPathData(a, b),
            labels, angles,
            strokeStartCap: start === 0,
            strokeEndCap: end === totalShelves
        };
    };

    let activeStart = 0;
    let activeEnd = totalShelves;
    let ghostStart = -1;
    let ghostEnd = -1;

    if (firstBendIdx >= 0) {
        if (viewMode === "toEnd") {
            activeEnd = firstBendIdx + 1;
            ghostStart = firstBendIdx + 1;
            ghostEnd = totalShelves;
        } else {
            ghostStart = 0;
            ghostEnd = firstBendIdx + 1;
            activeStart = firstBendIdx + 1;
        }
    }

    // Сборка основных геометрий слоёв (черный контур)
    const activeData = buildLayer(activeStart, activeEnd);

    // Сборка фонового контура (серый "призрак")
    const ghostData = ghostStart >= 0
        ? buildLayer(ghostStart, ghostEnd)
        : null;

    // Сборка финального слоя синей полки с размером и синхронизированной дугой угла
    const blueData = buildBlueLayer(
        blueRawData,
        profile,
        firstBendIdx,
        blueLength,
        rotatedSideA,
        rotatedSideB,
        cv
    );

    return {
        activeData,
        ghostData,
        blueData
    };
};
