import React, { memo, useMemo } from "react";
import { Paper, useTheme } from "@mui/material";

// --- Константы конфигурации ---
const GRID_STEP_C = 10;
const LABEL_DISTANCES = [5, 9, 13];
const LABEL_RAY_DISTANCE = 4;
const LABEL_ACCEPTABLE_SCORE = 30;
const Y_AXIS_LABEL_MIN_DISTANCE = 10;
const X_AXIS_LABEL_MIN_DISTANCE = 18;
const X_AXIS_LABEL_OFFSET = 5;
const Y_AXIS_LABEL_OFFSET = 5;
const LIMIT_RANGE_OPACITY = 0.06;

const LABEL_PENALTIES = {
    placedOverlap: 10000,
    placedNear: 50,
    curveOverlap: 5000,
    pointInside: 1000,

    leftOverflow: 3000,
    rightOverflow: 0,
    topOverflow: 200,
    bottomOverflow: 300,

    labelAreaOverflow: 10000,

    direction: 20,
    oppositeDirection: 100,
    rayDistance: 3,
    distance: 5,
    rayCross: 400,
    rayGraphCross: 2500,
};

const STATIC_DIRECTIONS = [
    { idx: 0, angle: 0, vx: 1, vy: 0 },
    { idx: 1, angle: 22.5, vx: 0.92387953251128, vy: 0.38268343236508 },
    { idx: 2, angle: 45, vx: 0.70710678118654, vy: 0.70710678118654 },
    { idx: 3, angle: 67.5, vx: 0.38268343236508, vy: 0.92387953236508 },
    { idx: 4, angle: 90, vx: 0, vy: 1 },
    { idx: 5, angle: 112.5, vx: -0.38268343251128, vy: 0.92387953236508 },
    { idx: 6, angle: 135, vx: -0.70710678118654, vy: 0.70710678118654 },
    { idx: 7, angle: 157.5, vx: -0.92387953251128, vy: 0.38268343236508 },
    { idx: 8, angle: 180, vx: -1, vy: 0 },
    { idx: 9, angle: -157.5, vx: -0.92387953251128, vy: -0.38268343236508 },
    { idx: 10, angle: -135, vx: -0.70710678118654, vy: -0.70710678118654 },
    { idx: 11, angle: -112.5, vx: -0.38268343251128, vy: -0.92387953236508 },
    { idx: 12, angle: -90, vx: 0, vy: -1 },
    { idx: 13, angle: -67.5, vx: 0.38268343251128, vy: -0.92387953236508 },
    { idx: 14, angle: -45, vx: 0.70710678118654, vy: -0.70710678118654 },
    { idx: 15, angle: -22.5, vx: 0.92387953236508, vy: -0.38268343236508 },
];

// --- Вспомогательные функции ---

const getLabelSize = (p, yAxisUnit = "°") => {
    const fontSize = 9;
    const text = `${Math.round(p.val)}${yAxisUnit}`;

    return {
        fontSize,
        textWidth: text.length * fontSize * 0.52,
        textHeight: fontSize,
    };
};

const getRectWidth = (rect) =>
    Math.max(0, rect.right - rect.left);

const getRectHeight = (rect) =>
    Math.max(0, rect.bottom - rect.top);

const getRectArea = (rect) =>
    getRectWidth(rect) * getRectHeight(rect);

const getRectDiagonal = (rect) =>
    Math.hypot(
        getRectWidth(rect),
        getRectHeight(rect)
    );

const getSegmentLength = (
    x1,
    y1,
    x2,
    y2
) =>
    Math.hypot(
        x2 - x1,
        y2 - y1
    );

const segmentIntersectsSegment = (
    x1,
    y1,
    x2,
    y2,
    x3,
    y3,
    x4,
    y4
) => {
    const cross = (
        ax,
        ay,
        bx,
        by
    ) =>
        ax * by - ay * bx;

    const rX = x2 - x1;
    const rY = y2 - y1;
    const sX = x4 - x3;
    const sY = y4 - y3;

    const denominator =
        cross(
            rX,
            rY,
            sX,
            sY
        );

    if (
        Math.abs(
            denominator
        ) < 0.00001
    ) {
        return false;
    }

    const qpx = x3 - x1;
    const qpy = y3 - y1;

    const t =
        cross(
            qpx,
            qpy,
            sX,
            sY
        ) /
        denominator;

    const u =
        cross(
            qpx,
            qpy,
            rX,
            rY
        ) /
        denominator;

    return (
        t >= 0 &&
        t <= 1 &&
        u >= 0 &&
        u <= 1
    );
};

const getRayToRectPerimeterDistance = (
    point,
    rect
) => {
    const centerX =
        (rect.left + rect.right) *
        0.5;

    const centerY =
        (rect.top + rect.bottom) *
        0.5;

    const rayX =
        centerX - point.x;

    const rayY =
        centerY - point.y;

    const rayLength =
        Math.hypot(
            rayX,
            rayY
        );

    if (
        rayLength < 0.00001
    ) {
        return 0;
    }

    const ux =
        rayX / rayLength;

    const uy =
        rayY / rayLength;

    let minT = Infinity;

    if (
        Math.abs(ux) >
        0.00001
    ) {
        const tLeft =
            (rect.left - point.x) /
            ux;

        if (tLeft >= 0) {
            const y =
                point.y +
                uy * tLeft;

            if (
                y >= rect.top - 0.1 &&
                y <= rect.bottom + 0.1
            ) {
                minT = Math.min(
                    minT,
                    tLeft
                );
            }
        }

        const tRight =
            (rect.right - point.x) /
            ux;

        if (tRight >= 0) {
            const y =
                point.y +
                uy * tRight;

            if (
                y >= rect.top - 0.1 &&
                y <= rect.bottom + 0.1
            ) {
                minT = Math.min(
                    minT,
                    tRight
                );
            }
        }
    }

    if (
        Math.abs(uy) >
        0.00001
    ) {
        const tTop =
            (rect.top - point.y) /
            uy;

        if (tTop >= 0) {
            const x =
                point.x +
                ux * tTop;

            if (
                x >= rect.left - 0.1 &&
                x <= rect.right + 0.1
            ) {
                minT = Math.min(
                    minT,
                    tTop
                );
            }
        }

        const tBottom =
            (rect.bottom - point.y) /
            uy;

        if (tBottom >= 0) {
            const x =
                point.x +
                ux * tBottom;

            if (
                x >= rect.left - 0.1 &&
                x <= rect.right + 0.1
            ) {
                minT = Math.min(
                    minT,
                    tBottom
                );
            }
        }
    }

    return Number.isFinite(minT)
        ? minT
        : rayLength;
};

const getSegmentRectOverlapRatio = (
    x1,
    y1,
    x2,
    y2,
    rect
) => {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (
        Math.hypot(dx, dy) <= 0
    ) {
        return 0;
    }

    let t0 = 0;
    let t1 = 1;

    const clip = (
        p,
        q
    ) => {
        if (
            Math.abs(p) <
            0.00001
        ) {
            return q >= 0;
        }

        const r = q / p;

        if (p < 0) {
            if (r > t1) {
                return false;
            }

            if (r > t0) {
                t0 = r;
            }
        } else {
            if (r < t0) {
                return false;
            }

            if (r < t1) {
                t1 = r;
            }
        }

        return true;
    };

    if (
        !clip(
            -dx,
            x1 - rect.left
        ) ||
        !clip(
            dx,
            rect.right - x1
        ) ||
        !clip(
            -dy,
            y1 - rect.top
        ) ||
        !clip(
            dy,
            rect.bottom - y1
        )
    ) {
        return 0;
    }

    return Math.max(
        0,
        t1 - t0
    );
};

const getRectOverlapRatio = (
    a,
    b
) => {
    const overlapWidth =
        Math.max(
            0,
            Math.min(
                a.right,
                b.right
            ) -
            Math.max(
                a.left,
                b.left
            )
        );

    if (
        overlapWidth <= 0
    ) {
        return 0;
    }

    const overlapHeight =
        Math.max(
            0,
            Math.min(
                a.bottom,
                b.bottom
            ) -
            Math.max(
                a.top,
                b.top
            )
        );

    if (
        overlapHeight <= 0
    ) {
        return 0;
    }

    const overlapArea =
        overlapWidth *
        overlapHeight;

    const aArea =
        getRectArea(a);

    const bArea =
        getRectArea(b);

    const referenceArea =
        Math.min(
            aArea,
            bArea
        );

    if (
        referenceArea <= 0
    ) {
        return 0;
    }

    return Math.min(
        1,
        overlapArea /
        referenceArea
    );
};

const getRectGapPenalty = (
    a,
    b
) => {
    const overlapRatio =
        getRectOverlapRatio(
            a,
            b
        );

    if (
        overlapRatio > 0
    ) {
        return (
            overlapRatio *
            LABEL_PENALTIES.placedOverlap
        );
    }

    const gapX =
        Math.max(
            b.left - a.right,
            a.left - b.right,
            0
        );

    const gapY =
        Math.max(
            b.top - a.bottom,
            a.top - b.bottom,
            0
        );

    return gapX < 4 &&
    gapY < 4
        ? LABEL_PENALTIES.placedNear
        : 0;
};

const getCurveOverlap = (
    graph,
    rect,
    xs,
    ys
) => {
    const curve = graph.points;
    let totalPixelsInside = 0;

    // Кешируем границы прямоугольника метки для быстрого доступа
    const rLeft = rect.left;
    const rRight = rect.right;
    const rTop = rect.top;
    const rBottom = rect.bottom;

    // Предварительно вычисляем экранные координаты для первой точки
    let x1 = xs(curve[0][0]);
    let y1 = ys(curve[0][1]);

    for (let i = 0; i < curve.length - 1; i++) {
        // Вычисляем координаты следующей точки
        const x2 = xs(curve[i + 1][0]);
        const y2 = ys(curve[i + 1][1]);

        // --- БЫСТРАЯ ПРОВЕРКА (Bounding Box Check) ---
        // Ищем минимальные и максимальные границы текущего сегмента
        const segLeft = x1 < x2 ? x1 : x2;
        const segRight = x1 > x2 ? x1 : x2;
        const segTop = y1 < y2 ? y1 : y2;
        const segBottom = y1 > y2 ? y1 : y2;

        // Если Bounding Box сегмента не пересекается с Bounding Box метки — пропускаем
        if (
            segRight < rLeft ||
            segLeft > rRight ||
            segBottom < rTop ||
            segTop > rBottom
        ) {
            // Переносим координаты для следующей итерации
            x1 = x2;
            y1 = y2;
            continue;
        }

        // --- ТЯЖЕЛЫЕ ВЫЧИСЛЕНИЯ (выполняются только при пересечении BB) ---
        const length = Math.hypot(x2 - x1, y2 - y1);

        if (length > 0) {
            totalPixelsInside +=
                length *
                getSegmentRectOverlapRatio(
                    x1,
                    y1,
                    x2,
                    y2,
                    rect
                );
        }

        // Переносим координаты для следующей итерации
        x1 = x2;
        y1 = y2;
    }

    return totalPixelsInside;
};

const getCurveOverlapPenalty = (
    overlapPixels,
    rect
) => {
    if (
        overlapPixels <= 0
    ) {
        return 0;
    }

    const referenceLength =
        getRectDiagonal(
            rect
        );

    if (
        referenceLength <= 0
    ) {
        return 0;
    }

    const overlapRatio =
        Math.min(
            1,
            overlapPixels /
            referenceLength
        );

    return (
        overlapRatio *
        LABEL_PENALTIES.curveOverlap
    );
};

const getSegmentRectOverlapPenalty = (
    overlapPixels,
    rect,
    penalty
) => {
    if (
        overlapPixels <= 0
    ) {
        return 0;
    }

    const referenceLength =
        getRectDiagonal(
            rect
        );

    if (
        referenceLength <= 0
    ) {
        return 0;
    }

    return (
        Math.min(
            1,
            overlapPixels /
            referenceLength
        ) * penalty
    );
};

const getOverflowRatio = (
    rect,
    side,
    boundary
) => {
    let overflow = 0;
    let reference = 0;

    if (side === "left") {
        overflow = Math.max(
            0,
            boundary - rect.left
        );

        reference =
            getRectWidth(rect);
    }

    if (side === "right") {
        overflow = Math.max(
            0,
            rect.right - boundary
        );

        reference =
            getRectWidth(rect);
    }

    if (side === "top") {
        overflow = Math.max(
            0,
            boundary - rect.top
        );

        reference =
            getRectHeight(rect);
    }

    if (side === "bottom") {
        overflow = Math.max(
            0,
            rect.bottom - boundary
        );

        reference =
            getRectHeight(rect);
    }

    if (
        reference <= 0
    ) {
        return 0;
    }

    return Math.min(
        1,
        overflow / reference
    );
};

const getOverflowPenalty = (
    rect,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom
) => {
    const leftRatio =
        getOverflowRatio(
            rect,
            "left",
            plotLeft
        );

    const rightRatio =
        getOverflowRatio(
            rect,
            "right",
            plotRight
        );

    const topRatio =
        getOverflowRatio(
            rect,
            "top",
            plotTop
        );

    const bottomRatio =
        getOverflowRatio(
            rect,
            "bottom",
            plotBottom
        );

    return (
        leftRatio *
        LABEL_PENALTIES.leftOverflow +
        rightRatio *
        LABEL_PENALTIES.rightOverflow +
        topRatio *
        LABEL_PENALTIES.topOverflow +
        bottomRatio *
        LABEL_PENALTIES.bottomOverflow
    );
};

const buildLimitData = ({
                            axis,
                            lines,
                            ranges,
                            mapValue,
                            minValue,
                            maxValue,
                            plotStart,
                            plotEnd,
                        }) => {
    const limitLines = [
        ...(Array.isArray(lines)
            ? lines
            : []),
        ...(Array.isArray(ranges)
            ? ranges.flatMap(
                (range) => [
                    {
                        value:
                        range.from,
                        color:
                        range.color,
                    },
                    {
                        value:
                        range.to,
                        color:
                        range.color,
                    },
                ]
            )
            : []),
    ].filter(
        (line) =>
            typeof line?.value ===
            "number" &&
            Number.isFinite(
                line.value
            )
    );

    const limitRanges =
        Array.isArray(ranges)
            ? ranges.filter(
                (range) =>
                    typeof range?.from ===
                    "number" &&
                    typeof range?.to ===
                    "number" &&
                    Number.isFinite(
                        range.from
                    ) &&
                    Number.isFinite(
                        range.to
                    ) &&
                    range.from !==
                    range.to
            )
            : [];

    const lineData =
        limitLines
            .map(
                (
                    line,
                    index
                ) => {
                    const coordinate =
                        mapValue(
                            line.value
                        );

                    return {
                        ...line,
                        index,
                        x:
                            axis ===
                            "x"
                                ? coordinate
                                : undefined,
                        y:
                            axis ===
                            "y"
                                ? coordinate
                                : undefined,
                        visible:
                            Number.isFinite(
                                coordinate
                            ) &&
                            line.value >=
                            minValue &&
                            line.value <=
                            maxValue,
                    };
                }
            )
            .filter(
                (line) =>
                    line.visible
            );

    const rangeData =
        limitRanges
            .map(
                (
                    range,
                    index
                ) => {
                    const lowValue =
                        Math.min(
                            range.from,
                            range.to
                        );

                    const highValue =
                        Math.max(
                            range.from,
                            range.to
                        );

                    const rawStart =
                        mapValue(
                            lowValue
                        );

                    const rawEnd =
                        mapValue(
                            highValue
                        );

                    const start =
                        Math.max(
                            plotStart,
                            Math.min(
                                plotEnd,
                                Math.min(
                                    rawStart,
                                    rawEnd
                                )
                            )
                        );

                    const end =
                        Math.max(
                            plotStart,
                            Math.min(
                                plotEnd,
                                Math.max(
                                    rawStart,
                                    rawEnd
                                )
                            )
                        );

                    return {
                        ...range,
                        index,
                        lowValue,
                        highValue,
                        start,
                        end,
                        visible:
                            lowValue <=
                            maxValue &&
                            highValue >=
                            minValue,
                    };
                }
            )
            .filter(
                (range) =>
                    range.visible &&
                    range.end >
                    range.start
            );

    return {
        lines: lineData,
        ranges: rangeData,
    };
};

const makePath = (
    graph,
    xs,
    ys
) => {
    const points =
        graph.points;

    let d =
        `M ${xs(points[0][0])} ${ys(points[0][1])}`;

    for (
        let i = 0;
        i < points.length - 1;
        i++
    ) {
        const p0 =
            points[
                i > 0
                    ? i - 1
                    : 0
                ];

        const p1 =
            points[i];

        const p2 =
            points[i + 1];

        const p3 =
            points[
                Math.min(
                    i + 2,
                    points.length - 1
                )
                ];

        const x0 = xs(p0[0]);
        const x1 = xs(p1[0]);
        const x2 = xs(p2[0]);
        const x3 = xs(p3[0]);

        const y0 = ys(p0[1]);
        const y1 = ys(p1[1]);
        const y2 = ys(p2[1]);
        const y3 = ys(p3[1]);

        d +=
            ` C ` +
            `${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ` +
            `${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ` +
            `${x2},${y2}`;
    }

    return d;
};

const getOrderedDirections = (
    p,
    graphData,
    isPlotRightEdgeCheck,
    ys
) => {
    const currentGraph =
        graphData[
            p.graphIndex
            ];

    const currentCurve =
        currentGraph.points;

    const isLeftEdge =
        p.id === 0;

    const isRightEdge =
        isPlotRightEdgeCheck(p);

    let preferredAngle = 0;

    if (
        !isLeftEdge &&
        !isRightEdge
    ) {
        const prevY =
            ys(
                currentCurve[
                p.id - 1
                    ][1]
            );

        const nextY =
            ys(
                currentCurve[
                p.id + 1
                    ][1]
            );

        const isPeak =
            p.y < prevY &&
            p.y < nextY;

        const isPit =
            p.y > prevY &&
            p.y > nextY;

        preferredAngle =
            isPeak
                ? -90
                : isPit
                    ? 90
                    : 0;
    }

    return [
        ...STATIC_DIRECTIONS,
    ].sort(
        (a, b) => {
            let diffA =
                Math.abs(
                    a.angle -
                    preferredAngle
                );

            let diffB =
                Math.abs(
                    b.angle -
                    preferredAngle
                );

            if (diffA > 180) {
                diffA =
                    360 - diffA;
            }

            if (diffB > 180) {
                diffB =
                    360 - diffB;
            }

            return (
                diffA - diffB
            );
        }
    );
};

// --- Основной компонент ---

const SvgLineChart = memo(
    ({ chart }) => {
        const theme =
            useTheme();

        const chartData =
            useMemo(
                () => {
                    if (
                        !chart ||
                        !Array.isArray(
                            chart.graphs
                        ) ||
                        !chart.graphs.length
                    ) {
                        return null;
                    }

                    const xAxis =
                        chart.axes?.x ||
                        {};

                    const yAxis =
                        chart.axes?.y ||
                        {};

                    const axes = {
                        x:
                            xAxis.unit ||
                            "mm",
                        y:
                            yAxis.unit ||
                            "°C",
                    };

                    const showPoints =
                        chart.showPoints !==
                        false;

                    const showLabels =
                        chart.showLabels !==
                        false;

                    const graphs =
                        chart.graphs
                            .filter(
                                (
                                    graph
                                ) =>
                                    Array.isArray(
                                        graph?.points
                                    ) &&
                                    graph.points
                                        .length >=
                                    2
                            )
                            .map(
                                (
                                    graph,
                                    index
                                ) => ({
                                    ...graph,
                                    index,
                                    points:
                                        graph.points
                                            .filter(
                                                (
                                                    point
                                                ) =>
                                                    Array.isArray(
                                                        point
                                                    ) &&
                                                    point.length >=
                                                    2 &&
                                                    Number.isFinite(
                                                        point[0]
                                                    ) &&
                                                    Number.isFinite(
                                                        point[1]
                                                    )
                                            )
                                            .map(
                                                (
                                                    point
                                                ) => [
                                                    Number(
                                                        point[0]
                                                    ),
                                                    Number(
                                                        point[1]
                                                    ),
                                                ]
                                            ),
                                    color:
                                        graph.color ||
                                        theme
                                            .palette
                                            .text
                                            .primary,
                                    opacity:
                                        typeof graph.opacity ===
                                        "number"
                                            ? Math.max(
                                                0,
                                                Math.min(
                                                    1,
                                                    graph.opacity
                                                )
                                            )
                                            : 1,
                                    lineWidth:
                                        typeof graph.lineWidth ===
                                        "number" &&
                                        graph.lineWidth >
                                        0
                                            ? graph.lineWidth
                                            : 2,
                                    showMarker:
                                        graph.showMarker !==
                                        false,
                                })
                            )
                            .filter(
                                (
                                    graph
                                ) =>
                                    graph.points
                                        .length >=
                                    2
                            );

                    if (
                        !graphs.length
                    ) {
                        return null;
                    }

                    const width =
                        300;

                    const height =
                        150;

                    const pad = {
                        left: 26,
                        right: 26,
                        top: 22,
                        bottom: 22,
                    };

                    const wPlot =
                        width -
                        pad.left -
                        pad.right;

                    const hPlot =
                        height -
                        pad.top -
                        pad.bottom;

                    const graphXRanges =
                        graphs.map(
                            (
                                graph
                            ) => {
                                const xValues =
                                    graph.points.map(
                                        (
                                            p
                                        ) =>
                                            p[0]
                                    );

                                return {
                                    start:
                                        Math.min(
                                            ...xValues
                                        ),
                                    end:
                                        Math.max(
                                            ...xValues
                                        ),
                                };
                            }
                        );

                    const xMin =
                        Math.min(
                            ...graphXRanges.map(
                                (
                                    r
                                ) =>
                                    r.start
                            )
                        );

                    const xMax =
                        Math.max(
                            ...graphXRanges.map(
                                (
                                    r
                                ) =>
                                    r.end
                            )
                        );

                    const xDelta =
                        xMax -
                        xMin ||
                        1;

                    const xs =
                        (x) =>
                            pad.left +
                            ((x -
                                    xMin) /
                                xDelta) *
                            wPlot;

                    const xCenter =
                        xs(
                            (xMin +
                                xMax) *
                            0.5
                        );

                    const allValues =
                        graphs.flatMap(
                            (
                                graph
                            ) =>
                                graph.points.map(
                                    (
                                        p
                                    ) =>
                                        p[1]
                                )
                        );

                    const yRanges =
                        Array.isArray(
                            yAxis.ranges
                        )
                            ? yAxis.ranges
                            : [];

                    const rangeValues = [
                        ...allValues,
                        ...yRanges.flatMap(
                            (
                                r
                            ) => [
                                r.from,
                                r.to,
                            ]
                        ),
                    ].filter(
                        Number.isFinite
                    );

                    if (
                        !rangeValues.length
                    ) {
                        return null;
                    }

                    let tMin =
                        Math.floor(
                            Math.min(
                                ...rangeValues
                            ) /
                            GRID_STEP_C
                        ) *
                        GRID_STEP_C;

                    let tMax =
                        Math.ceil(
                            Math.max(
                                ...rangeValues
                            ) /
                            GRID_STEP_C
                        ) *
                        GRID_STEP_C;

                    if (
                        tMax ===
                        tMin
                    ) {
                        tMin -=
                            GRID_STEP_C;

                        tMax +=
                            GRID_STEP_C;
                    }

                    const tDelta =
                        tMax - tMin;

                    const ys =
                        (t) =>
                            pad.top +
                            ((tMax -
                                    t) /
                                tDelta) *
                            hPlot;

                    const yLimits =
                        buildLimitData({
                            axis: "y",
                            lines:
                            yAxis.lines,
                            ranges:
                            yAxis.ranges,
                            mapValue: ys,
                            minValue: tMin,
                            maxValue: tMax,
                            plotStart:
                            pad.top,
                            plotEnd:
                                pad.top +
                                hPlot,
                        });

                    const xLimits =
                        buildLimitData({
                            axis: "x",
                            lines:
                            xAxis.lines,
                            ranges:
                            xAxis.ranges,
                            mapValue: xs,
                            minValue: xMin,
                            maxValue: xMax,
                            plotStart:
                            pad.left,
                            plotEnd:
                                pad.left +
                                wPlot,
                        });

                    const yLimitLineData =
                        yLimits.lines;

                    const yLimitRangeData =
                        yLimits.ranges;

                    const xLimitLineData =
                        xLimits.lines;

                    const xLimitRangeData =
                        xLimits.ranges;

                    const yLimitValues = [
                        ...(Array.isArray(
                            yAxis.lines
                        )
                            ? yAxis.lines.map(
                                (
                                    l
                                ) =>
                                    l.value
                            )
                            : []),
                        ...yRanges.flatMap(
                            (
                                r
                            ) => [
                                r.from,
                                r.to,
                            ]
                        ),
                    ];

                    const isSpecialTemperature =
                        (t) =>
                            yLimitValues.some(
                                (
                                    v
                                ) =>
                                    Number.isFinite(
                                        v
                                    ) &&
                                    Math.abs(
                                        v -
                                        t
                                    ) <
                                    0.1
                            );

                    const graphData =
                        graphs.map(
                            (
                                graph
                            ) => {
                                const points =
                                    graph.points;

                                let minIdx =
                                    0;

                                let maxIdx =
                                    0;

                                let minV =
                                    Infinity;

                                let maxV =
                                    -Infinity;

                                for (
                                    let i = 0;
                                    i <
                                    points.length;
                                    i++
                                ) {
                                    const v =
                                        points[
                                            i
                                            ][1];

                                    if (
                                        v <
                                        minV
                                    ) {
                                        minV =
                                            v;
                                        minIdx =
                                            i;
                                    }

                                    if (
                                        v >
                                        maxV
                                    ) {
                                        maxV =
                                            v;
                                        maxIdx =
                                            i;
                                    }
                                }

                                return {
                                    ...graph,
                                    minIdx,
                                    maxIdx,
                                    minV,
                                    maxV,
                                    path:
                                        makePath(
                                            graph,
                                            xs,
                                            ys
                                        ),
                                };
                            }
                        );

                    const isPlotRightEdge =
                        (p) => {
                            const graph =
                                graphData[
                                    p.graphIndex
                                    ];

                            if (
                                !graph
                            ) {
                                return false;
                            }

                            const point =
                                graph.points[
                                    p.id
                                    ];

                            if (
                                !point
                            ) {
                                return false;
                            }

                            return (
                                Math.abs(
                                    point[0] -
                                    xMax
                                ) <
                                1e-6
                            );
                        };

                    const makeLabels =
                        (graph) => {
                            const points =
                                graph.points;

                            const lastId =
                                points.length -
                                1;

                            const raw = [
                                {
                                    id:
                                    graph.maxIdx,
                                    val:
                                    graph.maxV,
                                    p: 4,
                                },
                                {
                                    id:
                                    graph.minIdx,
                                    val:
                                    graph.minV,
                                    p: 4,
                                },
                                {
                                    id: 0,
                                    val:
                                        points[
                                            0
                                            ][1],
                                    p: 2,
                                },
                                {
                                    id:
                                    lastId,
                                    val:
                                        points[
                                            lastId
                                            ][1],
                                    p: 2,
                                },
                            ];

                            const result =
                                [];

                            const seen =
                                new Set();

                            raw.sort(
                                (
                                    a,
                                    b
                                ) =>
                                    b.p -
                                    a.p
                            );

                            for (
                                const p of
                                raw
                                ) {
                                if (
                                    seen.has(
                                        p.id
                                    )
                                ) {
                                    continue;
                                }

                                seen.add(
                                    p.id
                                );

                                const point =
                                    points[
                                        p.id
                                        ];

                                const pointX =
                                    xs(
                                        point[
                                            0
                                            ]
                                    );

                                const pointY =
                                    ys(
                                        p.val
                                    );

                                const isOrigin =
                                    Math.abs(
                                        pointX -
                                        pad.left
                                    ) <
                                    0.01 &&
                                    Math.abs(
                                        pointY -
                                        (height -
                                            pad.bottom)
                                    ) <
                                    0.01;

                                if (
                                    isOrigin
                                ) {
                                    continue;
                                }

                                result.push({
                                    ...p,
                                    type:
                                        graph.index ===
                                        0
                                            ? "main"
                                            : "cooldown",
                                    graphIndex:
                                    graph.index,
                                    order:
                                        p.id ===
                                        0 ||
                                        p.id ===
                                        lastId
                                            ? 0
                                            : 1,
                                    color:
                                    graph.color,
                                    opacity:
                                    graph.opacity,
                                    x:
                                    pointX,
                                    y:
                                    pointY,
                                });
                            }

                            return result;
                        };

                    const labels =
                        showLabels
                            ? graphData
                                .filter(
                                    (
                                        g
                                    ) =>
                                        g.showMarker
                                )
                                .flatMap(
                                    (
                                        g
                                    ) =>
                                        makeLabels(
                                            g
                                        )
                                )
                            : [];

                    const sortedLabels =
                        [
                            ...labels,
                        ].sort(
                            (
                                a,
                                b
                            ) => {
                                const getPriority =
                                    (
                                        p
                                    ) =>
                                        isPlotRightEdge(
                                            p
                                        )
                                            ? 0
                                            : p.id ===
                                            0
                                                ? 1
                                                : 2;

                                const aP =
                                    getPriority(
                                        a
                                    );

                                const bP =
                                    getPriority(
                                        b
                                    );

                                return aP !==
                                bP
                                    ? aP -
                                    bP
                                    : a.y -
                                    b.y ||
                                    a.graphIndex -
                                    b.graphIndex;
                            }
                        );

                    const plotTop =
                        pad.top;

                    const plotBottom =
                        height -
                        pad.bottom;

                    const plotLeft =
                        pad.left;

                    const plotRight =
                        width -
                        pad.right;

                    const createEvaluator =
                        (
                            p,
                            externalPlaced = []
                        ) => {
                            const {
                                textWidth,
                                textHeight,
                            } =
                                getLabelSize(
                                    p,
                                    axes.y
                                );

                            const halfWidth =
                                textWidth /
                                2;

                            const currentGraph =
                                graphData[
                                    p.graphIndex
                                    ];

                            const currentCurve =
                                currentGraph.points;

                            const isLeftEdge =
                                p.id === 0;

                            const isStrictlyAtLeftBorder =
                                isLeftEdge &&
                                Math.abs(
                                    p.x -
                                    plotLeft
                                ) <
                                0.1;

                            const isRightEdge =
                                isPlotRightEdge(
                                    p
                                );

                            const otherGraphs =
                                graphData.filter(
                                    (
                                        g
                                    ) =>
                                        g.index !==
                                        p.graphIndex
                                );

                            const orderedDirections =
                                getOrderedDirections(
                                    p,
                                    graphData,
                                    isPlotRightEdge,
                                    ys
                                );

                            const preferredDirection =
                                orderedDirections[
                                    0
                                    ] || {
                                    angle: 0,
                                    vx: 1,
                                    vy: 0,
                                };

                            const normalizeAngle =
                                (
                                    angle
                                ) =>
                                    ((
                                            angle %
                                            360
                                        ) +
                                        360) %
                                    360;

                            const getAngleDiff =
                                (
                                    a,
                                    b
                                ) => {
                                    let diff =
                                        Math.abs(
                                            normalizeAngle(
                                                a
                                            ) -
                                            normalizeAngle(
                                                b
                                            )
                                        );

                                    if (
                                        diff >
                                        180
                                    ) {
                                        diff =
                                            360 -
                                            diff;
                                    }

                                    return diff;
                                };

                            const preferredAngle =
                                normalizeAngle(
                                    preferredDirection.angle
                                );

                            const oppositeAngle =
                                normalizeAngle(
                                    preferredAngle +
                                    180
                                );

                            const getCandidatePhase =
                                (
                                    direction
                                ) => {
                                    const diffFromPreferred =
                                        getAngleDiff(
                                            direction.angle,
                                            preferredAngle
                                        );

                                    const diffFromOpposite =
                                        getAngleDiff(
                                            direction.angle,
                                            oppositeAngle
                                        );

                                    if (
                                        diffFromPreferred <=
                                        90
                                    ) {
                                        return {
                                            phase:
                                                "preferred",
                                            rotation:
                                            diffFromPreferred,
                                            oppositePenalty:
                                                0,
                                        };
                                    }

                                    if (
                                        diffFromOpposite <=
                                        90
                                    ) {
                                        return {
                                            phase:
                                                "opposite",
                                            rotation:
                                            diffFromOpposite,
                                            oppositePenalty:
                                            LABEL_PENALTIES.oppositeDirection,
                                        };
                                    }

                                    return null;
                                };

                            const getCandidate =
                                (
                                    direction,
                                    distance
                                ) => {
                                    const dx =
                                        direction.vx *
                                        distance;

                                    const dy =
                                        direction.vy *
                                        distance;

                                    let textAnchor =
                                        "middle";

                                    if (
                                        isStrictlyAtLeftBorder &&
                                        dx > 0.01
                                    ) {
                                        textAnchor =
                                            "start";
                                    }

                                    if (
                                        isRightEdge
                                    ) {
                                        textAnchor =
                                            dx >=
                                            0
                                                ? "start"
                                                : "end";
                                    }

                                    const tx =
                                        p.x +
                                        dx;

                                    const ty =
                                        p.y +
                                        dy;

                                    let left;
                                    let right;

                                    if (
                                        textAnchor ===
                                        "start"
                                    ) {
                                        left =
                                            tx;

                                        right =
                                            tx +
                                            textWidth;
                                    } else if (
                                        textAnchor ===
                                        "end"
                                    ) {
                                        right =
                                            tx;

                                        left =
                                            tx -
                                            textWidth;
                                    } else {
                                        left =
                                            tx -
                                            halfWidth;

                                        right =
                                            tx +
                                            halfWidth;
                                    }

                                    return {
                                        angleDeg:
                                        direction.angle,
                                        dx,
                                        dy,
                                        labelCenter:
                                            {
                                                x:
                                                tx,
                                                y:
                                                ty,
                                            },
                                        textAnchor,
                                        rect: {
                                            left:
                                                left -
                                                1,
                                            right:
                                                right +
                                                1,
                                            top:
                                                ty -
                                                textHeight /
                                                2 -
                                                0.5,
                                            bottom:
                                                ty +
                                                textHeight /
                                                2 +
                                                0.5,
                                        },
                                    };
                                };

                            const evaluateCandidate =
                                (
                                    direction,
                                    distance,
                                    directionRank,
                                    distanceRank,
                                    bestScore = Infinity
                                ) => {
                                    const candidate =
                                        getCandidate(
                                            direction,
                                            distance
                                        );

                                    if (
                                        !candidate
                                    ) {
                                        return null;
                                    }

                                    const {
                                        rect,
                                        labelCenter,
                                    } =
                                        candidate;

                                    const phaseInfo =
                                        getCandidatePhase(
                                            direction
                                        );

                                    if (
                                        !phaseInfo
                                    ) {
                                        return null;
                                    }

                                    const {
                                        rotation,
                                        oppositePenalty,
                                    } =
                                        phaseInfo;

                                    // 1. Направление и расстояние

                                    const penaltyDirection =
                                        (rotation /
                                            22.5) *
                                        LABEL_PENALTIES.direction;

                                    const penaltyOppositeDirection =
                                        oppositePenalty;

                                    const rayDistance =
                                        getRayToRectPerimeterDistance(
                                            p,
                                            rect
                                        );

                                    const penaltyRayDistance =
                                        Math.pow(
                                            Math.max(
                                                0,
                                                rayDistance -
                                                6
                                            ),
                                            2
                                        ) *
                                        LABEL_PENALTIES.rayDistance;

                                    const penaltyDistanceRank =
                                        distanceRank *
                                        LABEL_PENALTIES.distance;

                                    let score =
                                        penaltyDirection +
                                        penaltyOppositeDirection +
                                        penaltyRayDistance +
                                        penaltyDistanceRank;

                                    if (
                                        score >=
                                        bestScore
                                    ) {
                                        return null;
                                    }

                                    // 2. ПРОПОРЦИОНАЛЬНЫЙ выход
                                    // за границы графика

                                    const penaltyOverflow =
                                        getOverflowPenalty(
                                            rect,
                                            plotLeft,
                                            plotRight,
                                            plotTop,
                                            plotBottom
                                        );

                                    score +=
                                        penaltyOverflow;

                                    if (
                                        score >=
                                        bestScore
                                    ) {
                                        return null;
                                    }

                                    // 2.1 ПРОПОРЦИОНАЛЬНЫЙ
                                    // выход за SVG

                                    const visibleWidth =
                                        Math.max(
                                            0,
                                            Math.min(
                                                rect.right,
                                                width
                                            ) -
                                            Math.max(
                                                rect.left,
                                                0
                                            )
                                        );

                                    const visibleHeight =
                                        Math.max(
                                            0,
                                            Math.min(
                                                rect.bottom,
                                                height
                                            ) -
                                            Math.max(
                                                rect.top,
                                                0
                                            )
                                        );

                                    const totalArea =
                                        getRectArea(
                                            rect
                                        );

                                    const visibleArea =
                                        visibleWidth *
                                        visibleHeight;

                                    const overflowRatio =
                                        totalArea >
                                        0
                                            ? Math.min(
                                                1,
                                                Math.max(
                                                    0,
                                                    1 -
                                                    visibleArea /
                                                    totalArea
                                                )
                                            )
                                            : 0;

                                    const penaltyLabelAreaOverflow =
                                        overflowRatio *
                                        LABEL_PENALTIES.labelAreaOverflow;

                                    score +=
                                        penaltyLabelAreaOverflow;

                                    if (
                                        score >=
                                        bestScore
                                    ) {
                                        return null;
                                    }

                                    // 3. Точка внутри метки

                                    let penaltyPointInside =
                                        0;

                                    if (
                                        p.x >=
                                        rect.left &&
                                        p.x <=
                                        rect.right &&
                                        p.y >=
                                        rect.top &&
                                        p.y <=
                                        rect.bottom
                                    ) {
                                        penaltyPointInside =
                                            LABEL_PENALTIES.pointInside;
                                    }

                                    score +=
                                        penaltyPointInside;

                                    if (
                                        score >=
                                        bestScore
                                    ) {
                                        return null;
                                    }

                                    // 4. ПРОПОРЦИОНАЛЬНОЕ
                                    // наложение собственного графика

                                    let ownSegmentOverlapPixels =
                                        0;

                                    const selfStart =
                                        Math.max(
                                            0,
                                            p.id -
                                            1
                                        );

                                    const selfEnd =
                                        Math.min(
                                            currentCurve.length -
                                            2,
                                            p.id +
                                            1
                                        );

                                    for (
                                        let i =
                                            selfStart;
                                        i <=
                                        selfEnd;
                                        i++
                                    ) {
                                        const x1 =
                                            xs(
                                                currentCurve[
                                                    i
                                                    ][0]
                                            );

                                        const y1 =
                                            ys(
                                                currentCurve[
                                                    i
                                                    ][1]
                                            );

                                        const x2 =
                                            xs(
                                                currentCurve[
                                                i +
                                                1
                                                    ][0]
                                            );

                                        const y2 =
                                            ys(
                                                currentCurve[
                                                i +
                                                1
                                                    ][1]
                                            );

                                        const segmentLength =
                                            getSegmentLength(
                                                x1,
                                                y1,
                                                x2,
                                                y2
                                            );

                                        if (
                                            segmentLength <=
                                            0
                                        ) {
                                            continue;
                                        }

                                        ownSegmentOverlapPixels +=
                                            segmentLength *
                                            getSegmentRectOverlapRatio(
                                                x1,
                                                y1,
                                                x2,
                                                y2,
                                                rect
                                            );
                                    }

                                    if (
                                        ownSegmentOverlapPixels >
                                        0
                                    ) {
                                        const penalty =
                                            getSegmentRectOverlapPenalty(
                                                ownSegmentOverlapPixels,
                                                rect,
                                                LABEL_PENALTIES.curveOverlap
                                            );

                                        score +=
                                            penalty;

                                        if (
                                            score >=
                                            bestScore
                                        ) {
                                            return null;
                                        }
                                    }

                                    // 5. Наложение размещённых меток

                                    for (
                                        const q of
                                        externalPlaced
                                        ) {
                                        const penalty =
                                            getRectGapPenalty(
                                                rect,
                                                q
                                            );

                                        if (
                                            penalty >
                                            0
                                        ) {
                                            score +=
                                                penalty;

                                            if (
                                                score >=
                                                bestScore
                                            ) {
                                                return null;
                                            }
                                        }
                                    }

                                    // 6. Пересечение выносок

                                    for (
                                        const placedLabel of
                                        externalPlaced
                                        ) {
                                        const placedCenter =
                                            {
                                                x:
                                                    (
                                                        placedLabel.left +
                                                        placedLabel.right
                                                    ) *
                                                    0.5,
                                                y:
                                                    (
                                                        placedLabel.top +
                                                        placedLabel.bottom
                                                    ) *
                                                    0.5,
                                            };

                                        if (
                                            segmentIntersectsSegment(
                                                p.x,
                                                p.y,
                                                labelCenter.x,
                                                labelCenter.y,
                                                placedLabel.x,
                                                placedLabel.y,
                                                placedCenter.x,
                                                placedCenter.y
                                            )
                                        ) {
                                            score +=
                                                LABEL_PENALTIES.rayCross /
                                                10;

                                            if (
                                                score >=
                                                bestScore
                                            ) {
                                                return null;
                                            }
                                        }
                                    }

                                    // 7. Пересечение выноски
                                    // с чужим графиком

                                    for (
                                        const otherGraph of
                                        otherGraphs
                                        ) {
                                        const otherCurve =
                                            otherGraph.points;

                                        let rayCrosses =
                                            false;

                                        for (
                                            let i =
                                                0;
                                            i <
                                            otherCurve.length -
                                            1;
                                            i++
                                        ) {
                                            if (
                                                segmentIntersectsSegment(
                                                    p.x,
                                                    p.y,
                                                    labelCenter.x,
                                                    labelCenter.y,
                                                    xs(
                                                        otherCurve[
                                                            i
                                                            ][0]
                                                    ),
                                                    ys(
                                                        otherCurve[
                                                            i
                                                            ][1]
                                                    ),
                                                    xs(
                                                        otherCurve[
                                                        i +
                                                        1
                                                            ][0]
                                                    ),
                                                    ys(
                                                        otherCurve[
                                                        i +
                                                        1
                                                            ][1]
                                                    )
                                                )
                                            ) {
                                                rayCrosses =
                                                    true;

                                                break;
                                            }
                                        }

                                        if (
                                            rayCrosses
                                        ) {
                                            score +=
                                                LABEL_PENALTIES.rayGraphCross;

                                            if (
                                                score >=
                                                bestScore
                                            ) {
                                                return null;
                                            }

                                            break;
                                        }
                                    }

                                    // 8. ПРОПОРЦИОНАЛЬНОЕ
                                    // наложение собственного графика

                                    const ownOverlapPixels =
                                        getCurveOverlap(
                                            currentGraph,
                                            rect,
                                            xs,
                                            ys
                                        );

                                    if (
                                        ownOverlapPixels >
                                        0
                                    ) {
                                        const penalty =
                                            getCurveOverlapPenalty(
                                                ownOverlapPixels,
                                                rect
                                            );

                                        score +=
                                            penalty;

                                        if (
                                            score >=
                                            bestScore
                                        ) {
                                            return null;
                                        }
                                    }

                                    // 9. ПРОПОРЦИОНАЛЬНОЕ
                                    // наложение чужих графиков

                                    for (
                                        const otherGraph of
                                        otherGraphs
                                        ) {
                                        const otherOverlapPixels =
                                            getCurveOverlap(
                                                otherGraph,
                                                rect,
                                                xs,
                                                ys
                                            );

                                        if (
                                            otherOverlapPixels >
                                            0
                                        ) {
                                            const penalty =
                                                getCurveOverlapPenalty(
                                                    otherOverlapPixels,
                                                    rect
                                                );

                                            score +=
                                                penalty;

                                            if (
                                                score >=
                                                bestScore
                                            ) {
                                                return null;
                                            }
                                        }
                                    }

                                    return {
                                        candidate,
                                        score,
                                    };
                                };

                            const candidateOptions =
                                [];

                            for (
                                let dIdx =
                                    0;
                                dIdx <
                                orderedDirections.length;
                                dIdx++
                            ) {
                                const direction =
                                    orderedDirections[
                                        dIdx
                                        ];

                                const phaseInfo =
                                    getCandidatePhase(
                                        direction
                                    );

                                if (
                                    !phaseInfo
                                ) {
                                    continue;
                                }

                                for (
                                    let distIdx =
                                        0;
                                    distIdx <
                                    LABEL_DISTANCES.length;
                                    distIdx++
                                ) {
                                    const baseDistance =
                                        LABEL_DISTANCES[
                                            distIdx
                                            ];

                                    const angle =
                                        Math.abs(
                                            direction.angle
                                        ) %
                                        90;

                                    const angleDistance =
                                        Math.min(
                                            angle,
                                            90 -
                                            angle
                                        );

                                    const distance =
                                        baseDistance +
                                        LABEL_RAY_DISTANCE *
                                        (
                                            1 -
                                            angleDistance /
                                            45
                                        );

                                    candidateOptions.push(
                                        {
                                            direction,
                                            distance,
                                            directionRank:
                                            dIdx,
                                            distanceRank:
                                            distIdx,
                                        }
                                    );
                                }
                            }

                            return {
                                p,
                                textWidth,
                                textHeight,
                                candidateOptions,
                                evaluateCandidate,
                                getCandidate,
                            };
                        };

                    const getFallback =
                        (
                            p,
                            evaluator
                        ) => {
                            const {
                                getCandidate,
                            } =
                                evaluator;

                            const currentGraph =
                                graphData[
                                    p.graphIndex
                                    ];

                            const currentCurve =
                                currentGraph.points;

                            const isRightEdge =
                                isPlotRightEdge(
                                    p
                                );

                            let fallback;

                            if (
                                isRightEdge
                            ) {
                                const relativeY =
                                    p.y /
                                    height;

                                fallback =
                                    relativeY <
                                    0.33
                                        ? STATIC_DIRECTIONS[
                                            15
                                            ]
                                        : relativeY >
                                        0.66
                                            ? STATIC_DIRECTIONS[
                                                1
                                                ]
                                            : STATIC_DIRECTIONS[
                                                0
                                                ];
                            } else {
                                const prevY =
                                    p.id >
                                    0
                                        ? ys(
                                            currentCurve[
                                            p.id -
                                            1
                                                ][1]
                                        )
                                        : null;

                                const nextY =
                                    p.id <
                                    currentCurve.length -
                                    1
                                        ? ys(
                                            currentCurve[
                                            p.id +
                                            1
                                                ][1]
                                        )
                                        : null;

                                const isPeak =
                                    prevY !==
                                    null &&
                                    nextY !==
                                    null &&
                                    p.y <
                                    prevY &&
                                    p.y <
                                    nextY;

                                const isPit =
                                    prevY !==
                                    null &&
                                    nextY !==
                                    null &&
                                    p.y >
                                    prevY &&
                                    p.y >
                                    nextY;

                                fallback =
                                    isPeak
                                        ? STATIC_DIRECTIONS[
                                            12
                                            ]
                                        : isPit
                                            ? STATIC_DIRECTIONS[
                                                4
                                                ]
                                            : STATIC_DIRECTIONS[
                                                12
                                                ];
                            }

                            return (
                                getCandidate(
                                    fallback,
                                    12
                                ) || {
                                    dx:
                                        fallback.vx *
                                        12,
                                    dy:
                                        fallback.vy *
                                        12,
                                    textAnchor:
                                        isRightEdge
                                            ? "start"
                                            : "middle",
                                    rect: {
                                        left:
                                            p.x +
                                            fallback.vx *
                                            12 -
                                            (
                                                isRightEdge
                                                    ? 0
                                                    : evaluator.textWidth *
                                                    0.5
                                            ) -
                                            1,

                                        right:
                                            p.x +
                                            fallback.vx *
                                            12 +
                                            (
                                                isRightEdge
                                                    ? evaluator.textWidth
                                                    : evaluator.textWidth *
                                                    0.5
                                            ) +
                                            1,

                                        top:
                                            p.y +
                                            fallback.vy *
                                            12 -
                                            evaluator.textHeight /
                                            2 -
                                            0.5,

                                        bottom:
                                            p.y +
                                            fallback.vy *
                                            12 +
                                            evaluator.textHeight /
                                            2 +
                                            0.5,
                                    },
                                }
                            );
                        };

                    const placed = [];

                    const addPlaced =
                        (
                            p,
                            candidate,
                            score
                        ) =>
                            placed.push({
                                ...p,
                                dx:
                                candidate.dx,
                                dy:
                                candidate.dy,
                                score,
                                left:
                                candidate
                                    .rect
                                    .left,
                                right:
                                candidate
                                    .rect
                                    .right,
                                top:
                                candidate
                                    .rect
                                    .top,
                                bottom:
                                candidate
                                    .rect
                                    .bottom,
                                textAnchor:
                                candidate.textAnchor,
                            });

                    for (
                        const p of
                        sortedLabels
                        ) {
                        const evaluator =
                            createEvaluator(
                                p,
                                placed
                            );

                        let best =
                            null;

                        let bestScore =
                            Infinity;

                        for (
                            const option of
                            evaluator.candidateOptions
                            ) {
                            const result =
                                evaluator.evaluateCandidate(
                                    option.direction,
                                    option.distance,
                                    option.directionRank,
                                    option.distanceRank,
                                    bestScore
                                );

                            if (
                                !result
                            ) {
                                continue;
                            }

                            if (
                                result.score <
                                bestScore
                            ) {
                                best =
                                    result.candidate;

                                bestScore =
                                    result.score;
                            }

                            if (
                                bestScore <=
                                LABEL_ACCEPTABLE_SCORE
                            ) {
                                break;
                            }
                        }

                        if (
                            !best
                        ) {
                            best =
                                getFallback(
                                    p,
                                    evaluator
                                );

                            bestScore =
                                Infinity;
                        }

                        addPlaced(
                            p,
                            best,
                            bestScore
                        );
                    }

                    const yAxisLabels =
                        yLimitLineData.map(
                            (
                                line
                            ) => ({
                                type: "limit",
                                index:
                                line.index,
                                value:
                                line.value,
                                y:
                                line.y,
                                color:
                                    line.color ||
                                    theme
                                        .palette
                                        .text
                                        .secondary,
                            })
                        );

                    yAxisLabels.sort(
                        (
                            a,
                            b
                        ) =>
                            a.y -
                            b.y
                    );

                    for (
                        let i = 1;
                        i <
                        yAxisLabels.length;
                        i++
                    ) {
                        yAxisLabels[
                            i
                            ].y =
                            Math.max(
                                yAxisLabels[
                                    i
                                    ].y,
                                yAxisLabels[
                                i - 1
                                    ].y +
                                Y_AXIS_LABEL_MIN_DISTANCE
                            );
                    }

                    if (
                        yAxisLabels.length
                    ) {
                        const last =
                            yAxisLabels.length -
                            1;

                        const bottom =
                            height -
                            pad.bottom +
                            3;

                        yAxisLabels[
                            last
                            ].y =
                            Math.min(
                                yAxisLabels[
                                    last
                                    ].y,
                                bottom
                            );

                        for (
                            let i =
                                last -
                                1;
                            i >= 0;
                            i--
                        ) {
                            yAxisLabels[
                                i
                                ].y =
                                Math.min(
                                    yAxisLabels[
                                        i
                                        ].y,
                                    yAxisLabels[
                                    i + 1
                                        ].y -
                                    Y_AXIS_LABEL_MIN_DISTANCE
                                );
                        }
                    }

                    for (
                        const label of
                        yAxisLabels
                        ) {
                        label.y =
                            Math.max(
                                pad.top +
                                3,
                                label.y
                            );
                    }

                    const xAxisLabels =
                        xLimitLineData.map(
                            (
                                line
                            ) => ({
                                type: "limit",
                                index:
                                line.index,
                                value:
                                line.value,
                                x:
                                line.x,
                                color:
                                    line.color ||
                                    theme
                                        .palette
                                        .text
                                        .secondary,
                            })
                        );

                    xAxisLabels.sort(
                        (
                            a,
                            b
                        ) =>
                            a.x -
                            b.x
                    );

                    for (
                        let i = 1;
                        i <
                        xAxisLabels.length;
                        i++
                    ) {
                        xAxisLabels[
                            i
                            ].x =
                            Math.max(
                                xAxisLabels[
                                    i
                                    ].x,
                                xAxisLabels[
                                i - 1
                                    ].x +
                                X_AXIS_LABEL_MIN_DISTANCE
                            );
                    }

                    if (
                        xAxisLabels.length
                    ) {
                        const last =
                            xAxisLabels.length -
                            1;

                        const right =
                            width -
                            pad.right;

                        xAxisLabels[
                            last
                            ].x =
                            Math.min(
                                xAxisLabels[
                                    last
                                    ].x,
                                right
                            );

                        for (
                            let i =
                                last -
                                1;
                            i >= 0;
                            i--
                        ) {
                            xAxisLabels[
                                i
                                ].x =
                                Math.min(
                                    xAxisLabels[
                                        i
                                        ].x,
                                    xAxisLabels[
                                    i + 1
                                        ].x -
                                    X_AXIS_LABEL_MIN_DISTANCE
                                );
                        }
                    }

                    for (
                        const label of
                        xAxisLabels
                        ) {
                        label.x =
                            Math.max(
                                pad.left,
                                label.x
                            );
                    }

                    const linesCount =
                        Math.floor(
                            (tMax -
                                tMin) /
                            GRID_STEP_C
                        ) + 1;

                    const gridLinesY =
                        [];

                    for (
                        let i = 0;
                        i <
                        linesCount;
                        i++
                    ) {
                        const t =
                            tMin +
                            i *
                            GRID_STEP_C;

                        gridLinesY.push({
                            id: t,
                            y: ys(t),
                            isSpecial:
                                isSpecialTemperature(
                                    t
                                ),
                        });
                    }

                    const hasLimitAtY =
                        (y) =>
                            yLimitLineData.some(
                                (
                                    line
                                ) =>
                                    Math.abs(
                                        y -
                                        line.y
                                    ) <=
                                    8
                            ) ||
                            yLimitRangeData.some(
                                (
                                    range
                                ) =>
                                    Math.abs(
                                        y -
                                        range.start
                                    ) <=
                                    8 ||
                                    Math.abs(
                                        y -
                                        range.end
                                    ) <=
                                    8
                            );

                    const hasLimitAtX =
                        (x) =>
                            xLimitLineData.some(
                                (
                                    line
                                ) =>
                                    Math.abs(
                                        x -
                                        line.x
                                    ) <=
                                    8
                            ) ||
                            xLimitRangeData.some(
                                (
                                    range
                                ) =>
                                    Math.abs(
                                        x -
                                        range.start
                                    ) <=
                                    8 ||
                                    Math.abs(
                                        x -
                                        range.end
                                    ) <=
                                    8
                            );

                    return {
                        width,
                        height,
                        pad,
                        wPlot,
                        hPlot,
                        xMin,
                        xMax,
                        xCenter,
                        tMin,
                        tMax,
                        gridLinesY,
                        yLimitLineData,
                        yLimitRangeData,
                        xLimitLineData,
                        xLimitRangeData,
                        yTopEdge:
                            ys(tMax),
                        yBottomEdge:
                            ys(tMin),
                        graphData,
                        placed,
                        yAxisLabels,
                        xAxisLabels,
                        axes,
                        hasLimitAtY,
                        hasLimitAtX,
                        showPoints,
                        showLabels,
                        borderColor:
                            chart.status
                                ?.type ===
                            "error"
                                ? theme
                                    .palette
                                    .error
                                    .main
                                : chart.status
                                    ?.type ===
                                "warning"
                                    ? theme
                                        .palette
                                        .warning
                                        .main
                                    : theme
                                        .palette
                                        .divider,
                    };
                },
                [chart, theme]
            );

        if (!chartData) {
            return null;
        }

        const {
            width,
            height,
            pad,
            wPlot,
            hPlot,
            xMin,
            xMax,
            tMin,
            tMax,
            gridLinesY,
            yLimitLineData,
            yLimitRangeData,
            xLimitLineData,
            xLimitRangeData,
            yTopEdge,
            yBottomEdge,
            graphData,
            placed,
            yAxisLabels,
            xAxisLabels,
            axes,
            hasLimitAtY,
            hasLimitAtX,
            showPoints,
            showLabels,
            borderColor,
        } = chartData;

        return (
            <Paper
                sx={{
                    border: "1px solid",
                    borderColor,
                    p: 0.5,
                    fontFamily:
                        '"Roboto Mono","SF Mono",monospace',
                    boxShadow:
                        "none",
                }}
            >
                <svg
                    width={width}
                    height={height}
                    style={{
                        display:
                            "block",
                    }}
                    shapeRendering="geometricPrecision"
                >
                    {xLimitRangeData.map(
                        (
                            range
                        ) => (
                            <rect
                                key={`x-limit-range-${range.index}`}
                                x={
                                    range.start
                                }
                                y={
                                    pad.top
                                }
                                width={Math.max(
                                    0,
                                    range.end -
                                    range.start
                                )}
                                height={
                                    hPlot
                                }
                                fill={
                                    range.color
                                }
                                opacity={
                                    LIMIT_RANGE_OPACITY
                                }
                            />
                        )
                    )}

                    {yLimitRangeData.map(
                        (
                            range
                        ) => (
                            <rect
                                key={`y-limit-range-${range.index}`}
                                x={
                                    pad.left
                                }
                                y={
                                    range.start
                                }
                                width={
                                    wPlot
                                }
                                height={Math.max(
                                    0,
                                    range.end -
                                    range.start
                                )}
                                fill={
                                    range.color
                                }
                                opacity={
                                    LIMIT_RANGE_OPACITY
                                }
                            />
                        )
                    )}

                    {gridLinesY.map(
                        (
                            {
                                id,
                                y,
                                isSpecial,
                            },
                            i
                        ) =>
                            i > 0 &&
                            !isSpecial && (
                                <line
                                    key={
                                        id
                                    }
                                    x1={
                                        pad.left
                                    }
                                    y1={
                                        y
                                    }
                                    x2={
                                        width -
                                        pad.right
                                    }
                                    y2={
                                        y
                                    }
                                    stroke={
                                        theme
                                            .palette
                                            .divider
                                    }
                                    strokeWidth={
                                        1
                                    }
                                    strokeDasharray="4 2"
                                />
                            )
                    )}

                    {xLimitLineData.map(
                        (
                            line
                        ) => (
                            <line
                                key={`x-limit-line-${line.index}`}
                                x1={
                                    line.x
                                }
                                y1={
                                    pad.top
                                }
                                x2={
                                    line.x
                                }
                                y2={
                                    height -
                                    pad.bottom
                                }
                                stroke={
                                    line.color ||
                                    theme
                                        .palette
                                        .text
                                        .secondary
                                }
                                strokeWidth={
                                    1
                                }
                                strokeDasharray="4 2"
                                opacity=".5"
                            />
                        )
                    )}

                    <line
                        x1={
                            width -
                            pad.right
                        }
                        y1={
                            pad.top
                        }
                        x2={
                            width -
                            pad.right
                        }
                        y2={
                            height -
                            pad.bottom
                        }
                        stroke={
                            theme
                                .palette
                                .divider
                        }
                        strokeWidth={
                            1
                        }
                        strokeDasharray="4 2"
                    />

                    <line
                        x1={
                            pad.left
                        }
                        y1={
                            pad.top
                        }
                        x2={
                            pad.left
                        }
                        y2={
                            height -
                            pad.bottom
                        }
                        stroke={
                            theme
                                .palette
                                .text
                                .secondary
                        }
                        strokeWidth={
                            1
                        }
                        opacity=".55"
                    />

                    <line
                        x1={
                            pad.left
                        }
                        y1={
                            height -
                            pad.bottom
                        }
                        x2={
                            width -
                            pad.right
                        }
                        y2={
                            height -
                            pad.bottom
                        }
                        stroke={
                            theme
                                .palette
                                .text
                                .secondary
                        }
                        strokeWidth={
                            1
                        }
                        opacity=".55"
                    />

                    {yLimitLineData.map(
                        (
                            line
                        ) =>
                            Math.abs(
                                line.value -
                                tMin
                            ) !==
                            0 && (
                                <line
                                    key={`y-limit-line-${line.index}`}
                                    x1={
                                        pad.left
                                    }
                                    y1={
                                        line.y
                                    }
                                    x2={
                                        width -
                                        pad.right
                                    }
                                    y2={
                                        line.y
                                    }
                                    stroke={
                                        line.color ||
                                        theme
                                            .palette
                                            .text
                                            .secondary
                                    }
                                    strokeWidth={
                                        1
                                    }
                                    strokeDasharray="4 2"
                                    opacity=".5"
                                />
                            )
                    )}

                    {yAxisLabels.map(
                        (
                            label
                        ) => (
                            <text
                                key={`y-limit-label-${label.index}`}
                                x={
                                    pad.left -
                                    Y_AXIS_LABEL_OFFSET
                                }
                                y={
                                    label.y
                                }
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize={
                                    8
                                }
                                fontWeight="bold"
                                fill={
                                    label.color
                                }
                            >
                                {Number(
                                    label.value
                                ).toFixed(
                                    0
                                )}
                                {
                                    axes.y
                                }
                            </text>
                        )
                    )}

                    {xAxisLabels.map(
                        (
                            label
                        ) => (
                            <text
                                key={`x-limit-label-${label.index}`}
                                x={
                                    label.x
                                }
                                y={
                                    height -
                                    pad.bottom +
                                    X_AXIS_LABEL_OFFSET
                                }
                                textAnchor="middle"
                                dominantBaseline="hanging"
                                fontSize={
                                    8
                                }
                                fontWeight="bold"
                                fill={
                                    label.color
                                }
                            >
                                {Number(
                                    label.value
                                )
                                    .toFixed(
                                        1
                                    )
                                    .replace(
                                        /\.?0+$/,
                                        ""
                                    )}
                                {
                                    axes.x
                                }
                            </text>
                        )
                    )}

                    {graphData.map(
                        (
                            graph
                        ) => (
                            <path
                                key={`path-${graph.index}`}
                                d={
                                    graph.path
                                }
                                fill="none"
                                stroke={
                                    graph.color
                                }
                                strokeWidth={
                                    graph.lineWidth
                                }
                                opacity={
                                    graph.opacity
                                }
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )
                    )}

                    {showPoints &&
                        placed.map(
                            (
                                p
                            ) => {
                                const graph =
                                    graphData[
                                        p.graphIndex
                                        ];

                                const isMin =
                                    p.id ===
                                    graph.minIdx;

                                const isMax =
                                    p.id ===
                                    graph.maxIdx;

                                return (
                                    <g
                                        key={`${p.graphIndex}-${p.type}-${p.id}`}
                                    >
                                        <circle
                                            cx={
                                                p.x
                                            }
                                            cy={
                                                p.y
                                            }
                                            r={Math.max(
                                                2.5,
                                                graph.lineWidth *
                                                1.5
                                            )}
                                            fill={
                                                isMin
                                                    ? theme
                                                        .palette
                                                        .info
                                                        .main
                                                    : isMax
                                                        ? theme
                                                            .palette
                                                            .error
                                                            .main
                                                        : p.color
                                            }
                                            stroke={
                                                theme
                                                    .palette
                                                    .background
                                                    .paper
                                            }
                                            strokeWidth={
                                                1
                                            }
                                            opacity={
                                                p.opacity
                                            }
                                        />

                                        {showLabels && (
                                            <text
                                                x={
                                                    p.x +
                                                    p.dx
                                                }
                                                y={
                                                    p.y +
                                                    p.dy
                                                }
                                                textAnchor={
                                                    p.textAnchor
                                                }
                                                dominantBaseline="middle"
                                                fontSize={
                                                    9
                                                }
                                                fontWeight="bold"
                                                fill={
                                                    p.color
                                                }
                                                opacity={
                                                    p.opacity
                                                }
                                            >
                                                {Math.round(
                                                    p.val
                                                )}
                                                {
                                                    axes.y
                                                }
                                            </text>
                                        )}
                                    </g>
                                );
                            }
                        )}

                    {!hasLimitAtY(
                        yTopEdge
                    ) && (
                        <text
                            x={
                                pad.left -
                                Y_AXIS_LABEL_OFFSET
                            }
                            y={
                                yTopEdge +
                                3
                            }
                            textAnchor="end"
                            fontSize={
                                8.5
                            }
                            fill={
                                theme
                                    .palette
                                    .text
                                    .secondary
                            }
                        >
                            {tMax}
                            {axes.y}
                        </text>
                    )}

                    {!hasLimitAtY(
                        yBottomEdge
                    ) && (
                        <text
                            x={
                                pad.left -
                                Y_AXIS_LABEL_OFFSET
                            }
                            y={
                                yBottomEdge +
                                3
                            }
                            textAnchor="end"
                            fontSize={
                                8.5
                            }
                            fill={
                                theme
                                    .palette
                                    .text
                                    .secondary
                            }
                        >
                            {tMin}
                            {axes.y}
                        </text>
                    )}

                    {!hasLimitAtX(
                        pad.left
                    ) && (
                        <text
                            x={
                                pad.left
                            }
                            y={
                                height -
                                pad.bottom +
                                X_AXIS_LABEL_OFFSET
                            }
                            textAnchor="middle"
                            dominantBaseline="hanging"
                            fontSize={
                                8.5
                            }
                            fill={
                                theme
                                    .palette
                                    .text
                                    .secondary
                            }
                        >
                            {xMin.toFixed(
                                0
                            )}
                            {axes.x}
                        </text>
                    )}

                    {!hasLimitAtX(
                        width -
                        pad.right
                    ) && (
                        <text
                            x={
                                width -
                                pad.right
                            }
                            y={
                                height -
                                pad.bottom +
                                X_AXIS_LABEL_OFFSET
                            }
                            textAnchor="middle"
                            dominantBaseline="hanging"
                            fontSize={
                                8.5
                            }
                            fill={
                                theme
                                    .palette
                                    .text
                                    .secondary
                            }
                        >
                            {xMax.toFixed(
                                0
                            )}
                            {axes.x}
                        </text>
                    )}
                </svg>
            </Paper>
        );
    }
);

SvgLineChart.displayName =
    "SvgLineChart";

export default SvgLineChart;