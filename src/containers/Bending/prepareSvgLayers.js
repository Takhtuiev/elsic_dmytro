const ARC_RADIUS = 12,
    LABEL_OFFSET = 12,
    ANGLE_LABEL_OFFSET = 6,
    FONT_SIZE = 12;

const getLabelScale = (geometrySize, containerSize) => {
    if (
        !geometrySize?.width || geometrySize.width <= 0 ||
        !geometrySize?.height || geometrySize.height <= 0 ||
        !containerSize?.width || containerSize.width <= 0 ||
        !containerSize?.height || containerSize.height <= 0
    ) return 1;

    // Считаем коэффициент плотности (мм/px) для обеих осей
    const scaleX = geometrySize.width / containerSize.width;
    const scaleY = geometrySize.height / containerSize.height;

    // ИСПОЛЬЗУЕМ Math.max!
    // Нам нужен максимальный шаг масштабирования, чтобы компенсировать
    // ось, которая сильнее всего сжимает чертеж на экране.
    const maxScale = Math.max(scaleX, scaleY);

    // 1.15 — базовый множитель плотности.
    const optimalScale = maxScale * 1.15;

    return Math.min(
        2.5,
        // Нижний порог 0.6 спасет смартфоны от экстремального измельчения текста
        Math.max(0.6, optimalScale)
    );
};

const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-5;
const PADDING = 20;

const rotatePoint = (p, rad) => {
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return {
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos
    };
};

const createPathData = (a, b) => ({
    a,
    b,
    sideAPath: a.map(p => `${p.x} ${p.y}`).join(" L "),
    sideBPath: b.map(p => `${p.x} ${p.y}`).join(" L "),
    fillPoints: [...a, ...b.slice().reverse()]
        .map(p => `${p.x},${p.y}`)
        .join(" ")
});

const calculateShelfLabel = (
    startPoint,
    endPoint,
    oppStartPoint,
    oppEndPoint,
    lengthText,
    scale = 1
) => {
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

    const fontSize = FONT_SIZE * scale;
    const textRadius = Math.abs(by) * fontSize / 2;
    const offset = LABEL_OFFSET * scale + textRadius;

    return {
        text: `${lengthText}`,
        unit: "mm",
        x: midX + bx * offset,
        y: midY + by * offset,
        angle,
        fontSize
    };
};

const calculateBendAngle = (
    vertex,
    prevPoint,
    nextPoint,
    oppVertex,
    bendText,
    scale = 1
) => {
    const v1 = {
        x: prevPoint.x - vertex.x,
        y: prevPoint.y - vertex.y
    };

    const v2 = {
        x: nextPoint.x - vertex.x,
        y: nextPoint.y - vertex.y
    };

    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);

    if (l1 <= EPSILON || l2 <= EPSILON) return null;

    const u1 = {
        x: v1.x / l1,
        y: v1.y / l1
    };

    const u2 = {
        x: v2.x / l2,
        y: v2.y / l2
    };

    const arcRadius = ARC_RADIUS * scale;

    const p1 = {
        x: vertex.x + u1.x * arcRadius,
        y: vertex.y + u1.y * arcRadius
    };

    const p2 = {
        x: vertex.x + u2.x * arcRadius,
        y: vertex.y + u2.y * arcRadius
    };

    const tX = vertex.x - oppVertex.x;
    const tY = vertex.y - oppVertex.y;
    const tLen = Math.hypot(tX, tY);

    let bx, by;

    if (tLen > EPSILON) {
        bx = tX / tLen;
        by = tY / tLen;
    } else {
        bx = -u1.y;
        by = u1.x;
    }

    const strokeX = p2.x - p1.x;
    const strokeY = p2.y - p1.y;

    const sweep =
        strokeX * by - strokeY * bx < 0 ? 1 : 0;

    const fontSize = FONT_SIZE * scale;

    const textWidth =
        bendText.length * fontSize * 0.6;

    const halfW = textWidth / 2;
    const halfH = fontSize / 2;

    const textRadius =
        Math.abs(bx) * halfW +
        Math.abs(by) * halfH;

    const offset =
        arcRadius +
        ANGLE_LABEL_OFFSET * scale +
        textRadius;

    return {
        text: bendText,
        x: vertex.x + bx * offset,
        y: vertex.y + by * offset,
        path: `M ${p1.x} ${p1.y} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${p2.x} ${p2.y}`,
        bx,
        by,
        fontSize
    };
};

const calculateBlueRawData = (
    geometry,
    profile,
    firstBendIdx,
    viewMode,
    blueLength,
    rotatedSideA,
    rotatedSideB
) => {
    if (firstBendIdx < 0 || blueLength <= 0) return null;

    const bendVertexIdx = firstBendIdx + 1;
    const isToEnd = viewMode === "toEnd";
    const bend = profile.bends?.[firstBendIdx];

    if (!bend) return null;

    const isInnerRight = bend.direction === "right";

    const outerApex = isInnerRight
        ? rotatedSideA[bendVertexIdx]
        : rotatedSideB[bendVertexIdx];

    const targetIdx = isToEnd
        ? bendVertexIdx + 1
        : bendVertexIdx - 1;

    const targetPoint = isInnerRight
        ? rotatedSideA[targetIdx]
        : rotatedSideB[targetIdx];

    if (!outerApex || !targetPoint) return null;

    const dx = targetPoint.x - outerApex.x;
    const dy = targetPoint.y - outerApex.y;
    const len = Math.hypot(dx, dy);

    if (len <= EPSILON) return null;

    const ux = dx / len;
    const uy = dy / len;

    const nx = -uy;
    const ny = ux;

    const thickness = Number(profile.thickness) || 0;

    const innerApex = isInnerRight
        ? rotatedSideB[bendVertexIdx]
        : rotatedSideA[bendVertexIdx];

    const tx = innerApex.x - outerApex.x;
    const ty = innerApex.y - outerApex.y;

    const sideSign =
        tx * nx + ty * ny >= 0 ? 1 : -1;

    const outerEnd = {
        x: outerApex.x + ux * blueLength,
        y: outerApex.y + uy * blueLength
    };

    const innerEnd = {
        x: outerEnd.x + nx * sideSign * thickness,
        y: outerEnd.y + ny * sideSign * thickness
    };

    return {
        endPointA: isInnerRight ? outerEnd : innerEnd,
        endPointB: isInnerRight ? innerEnd : outerEnd,
        lengthSide: isInnerRight ? "A" : "B"
    };
};

const addPointToBounds = (bounds, p) => {
    if (!p) return;

    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.minY = Math.min(bounds.minY, p.y);
    bounds.maxY = Math.max(bounds.maxY, p.y);
};

const addTextToBounds = (bounds, text) => {
    if (!text) return;

    const fontSize =
        Number(text.fontSize) || FONT_SIZE;

    const value =
        `${text.text ?? ""}${text.unit ?? ""}`;

    const width =
        value.length * fontSize * 0.6;

    const height = fontSize;

    const angle =
        (Number(text.angle) || 0) *
        Math.PI / 180;

    const halfW = width / 2;
    const halfH = height / 2;

    const rx =
        Math.abs(Math.cos(angle)) * halfW +
        Math.abs(Math.sin(angle)) * halfH;

    const ry =
        Math.abs(Math.sin(angle)) * halfW +
        Math.abs(Math.cos(angle)) * halfH;

    bounds.minX =
        Math.min(bounds.minX, text.x - rx);

    bounds.maxX =
        Math.max(bounds.maxX, text.x + rx);

    bounds.minY =
        Math.min(bounds.minY, text.y - ry);

    bounds.maxY =
        Math.max(bounds.maxY, text.y + ry);
};

const addAngleToBounds = (bounds, angle) => {
    if (!angle) return;

    const fontSize =
        Number(angle.fontSize) || FONT_SIZE;

    const width =
        `${angle.text ?? ""}`.length *
        fontSize * 0.6;

    const halfW = width / 2;
    const halfH = fontSize / 2;

    bounds.minX =
        Math.min(bounds.minX, angle.x - halfW);

    bounds.maxX =
        Math.max(bounds.maxX, angle.x + halfW);

    bounds.minY =
        Math.min(bounds.minY, angle.y - halfH);

    bounds.maxY =
        Math.max(bounds.maxY, angle.y + halfH);
};

const addLayerToBounds = (bounds, layer) => {
    if (!layer) return;

    layer.a?.forEach(p =>
        addPointToBounds(bounds, p)
    );

    layer.b?.forEach(p =>
        addPointToBounds(bounds, p)
    );

    layer.labels?.forEach(label =>
        addTextToBounds(bounds, label)
    );

    layer.angles?.forEach(angle =>
        addAngleToBounds(bounds, angle)
    );
};

export const buildLayer = ({
                               start,
                               end,
                               ctxSideA,
                               ctxSideB,
                               ctxShelves,
                               ctxBends,
                               showCutAngle = false,
                               labelScale = 1
                           }) => {
    const a = ctxSideA.slice(start, end + 1);
    const b = ctxSideB.slice(start, end + 1);

    const labels = [];
    const angles = [];
    const ctxTotalShelves = ctxShelves.length;

    ctxShelves.slice(start, end).forEach((shelf, j) => {
        const g = start + j;

        const current = shelf.isTop ? a : b;
        const opposite = shelf.isTop ? b : a;

        const label = calculateShelfLabel(
            current[j],
            current[j + 1],
            opposite[j],
            opposite[j + 1],
            shelf.length,
            labelScale
        );

        if (label) labels.push(label);

        const currentBend = ctxBends[g];

        if (!currentBend) return;

        const inner =
            currentBend.direction === "right";

        const profileSide =
            inner ? b : a;

        const oppositeSide =
            inner ? a : b;

        const vertexIdx = j + 1;

        if (
            !profileSide[vertexIdx] ||
            !profileSide[vertexIdx - 1] ||
            !profileSide[vertexIdx + 1] ||
            !oppositeSide[vertexIdx]
        ) {
            return;
        }

        const angle = calculateBendAngle(
            profileSide[vertexIdx],
            profileSide[vertexIdx - 1],
            profileSide[vertexIdx + 1],
            oppositeSide[vertexIdx],
            `${currentBend.angle}°`,
            labelScale
        );

        if (angle) angles.push(angle);
    });

    if (showCutAngle) {
        const cutIndex =
            start > 0 ? start : end;

        const bendIndex = cutIndex - 1;
        const cutBend = ctxBends[bendIndex];

        if (
            cutBend &&
            ctxSideA[cutIndex - 1] &&
            ctxSideA[cutIndex] &&
            ctxSideA[cutIndex + 1] &&
            ctxSideB[cutIndex]
        ) {
            const inner =
                cutBend.direction === "right";

            const profileSide =
                inner ? ctxSideB : ctxSideA;

            const oppositeSide =
                inner ? ctxSideA : ctxSideB;

            const angle = calculateBendAngle(
                profileSide[cutIndex],
                profileSide[cutIndex - 1],
                profileSide[cutIndex + 1],
                oppositeSide[cutIndex],
                `${cutBend.angle}°`,
                labelScale
            );

            if (angle) angles.push(angle);
        }
    }

    return {
        ...createPathData(a, b),
        labels,
        angles,
        strokeStartCap: start === 0,
        strokeEndCap: end === ctxTotalShelves
    };
};

export const prepareSvgLayers = (
    geometry,
    profile,
    containerSize
) => {

    if (!geometry.sideA?.length) return null;

    const shelves = geometry.shelvesData;
    const totalShelves = shelves.length;
    const bends = profile.bends || [];

    const firstBendIdx =
        Number(profile.referenceBend?.index ?? -1);

    const viewMode =
        profile.bendViewMode || "toEnd";

    const blueLength =
        Number(profile.referenceBend?.length) || 0;

    const verticalShelfIdx =
        Number(profile.verticalShelf ?? 1) - 1;

    let rotationAngle = 0;

    if (firstBendIdx >= 0) {
        const shelfIdx =
            viewMode === "toEnd"
                ? firstBendIdx + 1
                : firstBendIdx;

        const shelf = shelves[shelfIdx];

        if (shelf) {
            rotationAngle =
                viewMode === "toEnd"
                    ? shelf.angleRad
                    : shelf.angleRad + Math.PI;
        }
    } else {
        const p1 =
            geometry.sideA[verticalShelfIdx];

        const p2 =
            geometry.sideA[verticalShelfIdx + 1];

        if (p1 && p2) {
            rotationAngle =
                -Math.PI / 2 -
                Math.atan2(
                    p2.y - p1.y,
                    p2.x - p1.x
                );
        }
    }

    let rotatedSideA =
        geometry.sideA.map(p =>
            rotatePoint(p, rotationAngle)
        );

    let rotatedSideB =
        geometry.sideB.map(p =>
            rotatePoint(p, rotationAngle)
        );

    if (firstBendIdx >= 0) {
        const vertex =
            rotatedSideA[firstBendIdx + 1];

        const next =
            rotatedSideA[
                viewMode === "toEnd"
                    ? firstBendIdx
                    : firstBendIdx + 2
                ];

        if (
            vertex &&
            next &&
            next.y - vertex.y > 0
        ) {
            rotatedSideA =
                rotatedSideA.map(p => ({
                    ...p,
                    y: -p.y
                }));

            rotatedSideB =
                rotatedSideB.map(p => ({
                    ...p,
                    y: -p.y
                }));
        }
    }

    const allPoints = [
        ...rotatedSideA,
        ...rotatedSideB
    ];

    const minDetailX =
        Math.min(...allPoints.map(p => p.x));

    const maxDetailX =
        Math.max(...allPoints.map(p => p.x));

    const minDetailY =
        Math.min(...allPoints.map(p => p.y));

    const maxDetailY =
        Math.max(...allPoints.map(p => p.y));

    const detailSize = {
        width: maxDetailX - minDetailX,
        height: maxDetailY - minDetailY
    };

    const labelScale =
        getLabelScale(detailSize, containerSize);

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

    const activeData = buildLayer({
        start: activeStart,
        end: activeEnd,
        ctxSideA: rotatedSideA,
        ctxSideB: rotatedSideB,
        ctxShelves: shelves,
        ctxBends: bends,
        labelScale
    });

    const ghostData =
        ghostStart >= 0
            ? buildLayer({
                start: ghostStart,
                end: ghostEnd,
                ctxSideA: rotatedSideA,
                ctxSideB: rotatedSideB,
                ctxShelves: shelves,
                ctxBends: bends,
                labelScale
            })
            : null;

    let blueData = null;

    const blueRaw = calculateBlueRawData(
        geometry,
        profile,
        firstBendIdx,
        viewMode,
        blueLength,
        rotatedSideA,
        rotatedSideB
    );

    if (blueRaw) {
        const i = firstBendIdx + 1;

        const bendA = rotatedSideA[i];
        const bendB = rotatedSideB[i];

        const adjacentA =
            viewMode === "toEnd"
                ? rotatedSideA[i - 1]
                : rotatedSideA[i + 1];

        const adjacentB =
            viewMode === "toEnd"
                ? rotatedSideB[i - 1]
                : rotatedSideB[i + 1];

        if (
            bendA &&
            bendB &&
            adjacentA &&
            adjacentB
        ) {
            const isToEnd =
                viewMode === "toEnd";

            const blueSideA = isToEnd
                ? [
                    adjacentA,
                    bendA,
                    blueRaw.endPointA
                ]
                : [
                    blueRaw.endPointA,
                    bendA,
                    adjacentA
                ];

            const blueSideB = isToEnd
                ? [
                    adjacentB,
                    bendB,
                    blueRaw.endPointB
                ]
                : [
                    blueRaw.endPointB,
                    bendB,
                    adjacentB
                ];

            const adjacentShelf =
                shelves[firstBendIdx];

            const blueShelf = {
                ...shelves[firstBendIdx + 1],
                length: blueLength,
                isTop:
                    blueRaw.lengthSide === "A"
            };

            const blueShelves = isToEnd
                ? [adjacentShelf, blueShelf]
                : [blueShelf, adjacentShelf];

            const blueBends = [
                bends[firstBendIdx]
            ];

            blueData = buildLayer({
                start: isToEnd ? 1 : 0,
                end: isToEnd ? 2 : 1,
                ctxSideA: blueSideA,
                ctxSideB: blueSideB,
                ctxShelves: blueShelves,
                ctxBends: blueBends,
                showCutAngle: true,
                labelScale
            });

            if (blueData) {
                blueData.strokeStartCap = !isToEnd;
                blueData.strokeEndCap = isToEnd;
            }
        }
    }

    const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    };

    if (activeData) {
        addLayerToBounds(bounds, activeData);
    }

    if (ghostData) {
        addLayerToBounds(bounds, ghostData);
    }

    if (blueData) {
        addLayerToBounds(bounds, blueData);
    }

    const viewBox = [
        bounds.minX - PADDING,
        bounds.minY - PADDING,
        bounds.maxX - bounds.minX + PADDING * 2,
        bounds.maxY - bounds.minY + PADDING * 2
    ].join(" ");

    return {
        activeData,
        ghostData,
        blueData,
        viewBox
    };
};