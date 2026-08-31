import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { calculateBlankLength } from "./bendingCalculations";

function BendingProfilePreview({ profile, verticalShelf }) {
    const theme = useTheme();
    const blankLength = calculateBlankLength(profile);

    const VIEWBOX_WIDTH = 600;
    const VIEWBOX_HEIGHT = 450;
    const PADDING = 40;
    const BOTTOM_INFO_HEIGHT = 30;
    const MIN_LENGTH_FOR_DRAW = 20;

    const DIMENSION_FONT_SIZE = 12;
    const LENGTH_TEXT_OFFSET = 15;
    const ANGLE_RADIUS = 12;
    const ANGLE_TEXT_GAP = 6;

    const textColor = theme.palette.text.primary;
    const profileFill = theme.palette.action.hover;

    // Центральная линия
    const points = [];
    const segments = [];
    const bends = [];

    let x = 0, y = 0;
    let currentAngle = 0;

    points.push({ x, y });

    profile.shelves.forEach((shelf, index) => {
        const originalLength = Number(shelf.length);
        const length = originalLength > 0 ? originalLength : MIN_LENGTH_FOR_DRAW;
        const start = { x, y };
        const angleRad = currentAngle * Math.PI / 180;

        x += Math.cos(angleRad) * length;
        y -= Math.sin(angleRad) * length;

        const end = { x, y };
        points.push(end);

        segments.push({
            index,
            start,
            end,
            length: originalLength,
            side: shelf.side,
            angle: currentAngle,
        });

        if (profile.bends[index]) {
            const bend = profile.bends[index];
            const innerAngle = Number(bend.angle) || 0;

            bends.push({
                index,
                vertex: { x, y },
                innerAngle,
                direction: bend.direction,
                incomingAngle: currentAngle,
            });

            const turningAngle = 180 - innerAngle;

            if (bend.direction === "right") {
                currentAngle -= turningAngle;
            } else if (bend.direction === "left") {
                currentAngle += turningAngle;
            }
        }
    });

    // Направление выбранной полки
    let selectedShelfAngle = 0;

    for (let i = 0; i < verticalShelf - 1; i++) {
        const bend = profile.bends[i];
        if (!bend) continue;

        const turningAngle = 180 - Number(bend.angle || 0);

        if (bend.direction === "right") {
            selectedShelfAngle -= turningAngle;
        } else if (bend.direction === "left") {
            selectedShelfAngle += turningAngle;
        }
    }

    // Поворот схемы
    const TARGET_ANGLE = -90;
    const rotationAngle = TARGET_ANGLE - selectedShelfAngle;
    const rotationRad = rotationAngle * Math.PI / 180;

    const cosRotation = Math.cos(rotationRad);
    const sinRotation = Math.sin(rotationRad);

    const rotatePoint = point => ({
        x: point.x * cosRotation + point.y * sinRotation,
        y: -point.x * sinRotation + point.y * cosRotation,
    });

    const rotatedPoints = points.map(rotatePoint);

    const rotatedSegments = segments.map(segment => ({
        ...segment,
        start: rotatePoint(segment.start),
        end: rotatePoint(segment.end),
    }));

    const rotatedBends = bends.map(bend => ({
        ...bend,
        vertex: rotatePoint(bend.vertex),
    }));

    // Границы и масштаб
    const xs = rotatedPoints.map(p => p.x);
    const ys = rotatedPoints.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const profileWidth = maxX - minX;
    const profileHeight = maxY - minY;

    const availableWidth = VIEWBOX_WIDTH - PADDING * 2;
    const availableHeight =
        VIEWBOX_HEIGHT - PADDING * 2 - BOTTOM_INFO_HEIGHT;

    const scaleX = profileWidth > 0 ? availableWidth / profileWidth : 1;
    const scaleY = profileHeight > 0 ? availableHeight / profileHeight : 1;
    const scale = Math.max(0.05, Math.min(scaleX, scaleY, 5));

    const drawingWidth = profileWidth * scale;
    const drawingHeight = profileHeight * scale;

    const offsetX =
        PADDING + (availableWidth - drawingWidth) / 2;

    const offsetY =
        PADDING + (availableHeight - drawingHeight) / 2;

    const toSvg = point => ({
        x: offsetX + (point.x - minX) * scale,
        y: offsetY + (point.y - minY) * scale,
    });

    const svgPoints = rotatedPoints.map(toSvg);

    // Пересечение двух прямых
    const lineIntersection = (p1, p2, p3, p4) => {
        const denominator =
            (p1.x - p2.x) * (p3.y - p4.y) -
            (p1.y - p2.y) * (p3.x - p4.x);

        if (Math.abs(denominator) < 0.000001) return p2;

        const a = p1.x * p2.y - p1.y * p2.x;
        const b = p3.x * p4.y - p3.y * p4.x;

        return {
            x:
                (a * (p3.x - p4.x) -
                    (p1.x - p2.x) * b) /
                denominator,

            y:
                (a * (p3.y - p4.y) -
                    (p1.y - p2.y) * b) /
                denominator,
        };
    };

    // Нормаль к полке
    const getNormal = (start, end) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);

        if (!length) return { x: 0, y: 0 };

        return {
            x: -dy / length,
            y: dx / length,
        };
    };

    // Контур материала
    const halfThickness = Number(profile.thickness) / 2;
    const upperLines = [];
    const lowerLines = [];

    rotatedSegments.forEach(segment => {
        const normal = getNormal(segment.start, segment.end);

        upperLines.push({
            start: {
                x: segment.start.x + normal.x * halfThickness,
                y: segment.start.y + normal.y * halfThickness,
            },
            end: {
                x: segment.end.x + normal.x * halfThickness,
                y: segment.end.y + normal.y * halfThickness,
            },
        });

        lowerLines.push({
            start: {
                x: segment.start.x - normal.x * halfThickness,
                y: segment.start.y - normal.y * halfThickness,
            },
            end: {
                x: segment.end.x - normal.x * halfThickness,
                y: segment.end.y - normal.y * halfThickness,
            },
        });
    });

    // Апексы контура
    const upperContour = [];
    const lowerContour = [];

    if (upperLines.length) {
        upperContour.push(upperLines[0].start);
        lowerContour.push(lowerLines[0].start);

        for (let i = 0; i < upperLines.length - 1; i++) {
            upperContour.push(
                lineIntersection(
                    upperLines[i].start,
                    upperLines[i].end,
                    upperLines[i + 1].start,
                    upperLines[i + 1].end
                )
            );

            lowerContour.push(
                lineIntersection(
                    lowerLines[i].start,
                    lowerLines[i].end,
                    lowerLines[i + 1].start,
                    lowerLines[i + 1].end
                )
            );
        }

        upperContour.push(upperLines.at(-1).end);
        lowerContour.push(lowerLines.at(-1).end);
    }

    const profileContour = [
        ...upperContour,
        ...lowerContour.reverse(),
    ];

    const contourPath =
        profileContour.length > 1
            ? profileContour
                  .map(
                      (point, index) =>
                          `${index === 0 ? "M" : "L"} ${
    toSvg(point).x
} ${toSvg(point).y}`
                  )
                  .join(" ") + " Z"
            : "";

    // Размеры полок
    const lengthLabels = rotatedSegments.map(segment => {
        const start = toSvg(segment.start);
        const end = toSvg(segment.end);

        const middle = {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
        };

        const normal = getNormal(start, end);
        const direction = segment.side === "left" ? 1 : -1;

        const labelPoint = {
            x:
                middle.x +
                normal.x *
                    LENGTH_TEXT_OFFSET *
                    direction,

            y:
                middle.y +
                normal.y *
                    LENGTH_TEXT_OFFSET *
                    direction,
        };

        let textAngle =
            Math.atan2(
                end.y - start.y,
                end.x - start.x
            ) *
            180 /
            Math.PI;

        if (textAngle > 90 || textAngle < -90) {
            textAngle += 180;
        }

        return {
            ...segment,
            labelPoint,
            textAngle,
        };
    });

    // Нормализация
    const normalize = vector => {
        const length = Math.hypot(vector.x, vector.y);
        if (!length) return { x: 0, y: 0 };

        return {
            x: vector.x / length,
            y: vector.y / length,
        };
    };

    // Угловые размеры
    const angleDimensions = rotatedBends.map(bend => {
        const i = bend.index;
        const previousSegment = rotatedSegments[i];
        const nextSegment = rotatedSegments[i + 1];

        if (!previousSegment || !nextSegment) return null;

        const center = toSvg(bend.vertex);

        const v1 = normalize({
            x: previousSegment.start.x - previousSegment.end.x,
            y: previousSegment.start.y - previousSegment.end.y,
        });

        const v2 = normalize({
            x: nextSegment.end.x - nextSegment.start.x,
            y: nextSegment.end.y - nextSegment.start.y,
        });

        const startPoint = {
            x: center.x + v1.x * ANGLE_RADIUS,
            y: center.y + v1.y * ANGLE_RADIUS,
        };

        const endPoint = {
            x: center.x + v2.x * ANGLE_RADIUS,
            y: center.y + v2.y * ANGLE_RADIUS,
        };

        let bisector;

        if (Math.abs(bend.innerAngle - 180) < 0.001) {
            bisector =
                bend.direction === "right"
                    ? normalize({ x: v1.y, y: -v1.x })
                    : normalize({ x: -v1.y, y: v1.x });
        } else {
            bisector = normalize({
                x: v1.x + v2.x,
                y: v1.y + v2.y,
            });
        }

        const textRadius =
            ANGLE_RADIUS +
            ANGLE_TEXT_GAP +
            DIMENSION_FONT_SIZE / 2;

        const textPoint = {
            x: center.x + bisector.x * textRadius,
            y: center.y + bisector.y * textRadius,
        };

        const cross =
            v1.x * v2.y -
            v1.y * v2.x;

        return {
            ...bend,
            center,
            startPoint,
            endPoint,
            textPoint,
            sweepFlag: cross > 0 ? 1 : 0,
        };
    });

    return (
        <Paper
            elevation={2}
            sx={{
                p: 2,
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
            }}
        >
            <Typography variant="h6" sx={{ mb: 1 }}>
                Схема профиля
            </Typography>

            <Box sx={{ width: "100%", aspectRatio: "4 / 3" }}>
                <svg
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ color: textColor }}
                >
                    {/* Размеры полок */}
                    {lengthLabels.map((segment, index) => (
                        <text
                            key={`length-${index}`}
                            x={segment.labelPoint.x}
                            y={segment.labelPoint.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={DIMENSION_FONT_SIZE}
                            fill={textColor}
                            transform={`rotate(${segment.textAngle} ${segment.labelPoint.x} ${segment.labelPoint.y})`}
                        >
                            <tspan>{segment.length}</tspan>
                            <tspan
                                fontSize={DIMENSION_FONT_SIZE - 2}
                                dx="3"
                            >
                                mm
                            </tspan>
                        </text>
                    ))}

                    {/* Углы */}
                    {angleDimensions.map((bend, index) => {
                        if (!bend || bend.innerAngle <= 0) return null;

                        return (
                            <React.Fragment key={`angle-${index}`}>
                                <path
                                    d={`M ${bend.startPoint.x} ${bend.startPoint.y}
A ${ANGLE_RADIUS} ${ANGLE_RADIUS}
0 0 ${bend.sweepFlag}
${bend.endPoint.x} ${bend.endPoint.y}`}
                                    fill="none"
                                    stroke={textColor}
                                    strokeWidth="1"
                                />

                                <text
                                    x={bend.textPoint.x}
                                    y={bend.textPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={DIMENSION_FONT_SIZE}
                                    fill={textColor}
                                >
                                    {bend.innerAngle}°
                                </text>
                            </React.Fragment>
                        );
                    })}

                    {/* Контур материала */}
                    <path
                        d={contourPath}
                        fill={profileFill}
                        stroke={textColor}
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                    />


                    {/* Длина заготовки */}
                    <text
                        x={VIEWBOX_WIDTH / 2}
                        y={VIEWBOX_HEIGHT - 15}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12"
                        fill={textColor}
                    >
                        Materialstärke:{" "}
                        <tspan fontWeight="bold">
                            {Number(profile.thickness)}
                        </tspan>
                        {" mm | "}
                        Zuschnittlänge:{" "}
                        <tspan fontWeight="bold">
                            {blankLength.toFixed(2)}
                        </tspan>
                        {" mm"}
                    </text>
                </svg>
            </Box>
        </Paper>
    );
}

export default BendingProfilePreview;