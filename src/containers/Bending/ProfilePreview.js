import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { calculateBlankLength } from "./Calculations";

function ProfilePreview({ profile, verticalShelf }) {
    const theme = useTheme();
    const blankLength = calculateBlankLength(profile);

    const VIEWBOX_WIDTH = 600, VIEWBOX_HEIGHT = 450;
    const PADDING = 40, BOTTOM_INFO_HEIGHT = 30, MIN_LENGTH_FOR_DRAW = 20;
    const TEXT_VERTICAL_CORRECTION = 1.3;
    const DIMENSION_FONT_SIZE = 12, LENGTH_TEXT_OFFSET = 4;
    const ANGLE_RADIUS = 12, ANGLE_TEXT_GAP = 0;

    const textColor = theme.palette.text.primary;
    const profileFill = theme.palette.action.hover;

    // Построение осевой линии
    const points = [], segments = [], bends = [];
    let x = 0, y = 0, currentAngle = 0;
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
            angle: currentAngle
        });

        if (profile.bends[index]) {
            const bend = profile.bends[index];
            const innerAngle = Number(bend.angle) || 0;

            bends.push({
                index,
                vertex: { x, y },
                innerAngle,
                direction: bend.direction,
                incomingAngle: currentAngle
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

    const rotationRad =
        (TARGET_ANGLE - selectedShelfAngle) * Math.PI / 180;

    const cosRotation = Math.cos(rotationRad);
    const sinRotation = Math.sin(rotationRad);

    const rotatePoint = point => ({
        x: point.x * cosRotation + point.y * sinRotation,
        y: -point.x * sinRotation + point.y * cosRotation
    });

    const rotatedPoints = points.map(rotatePoint);

    const rotatedSegments = segments.map(segment => ({
        ...segment,
        start: rotatePoint(segment.start),
        end: rotatePoint(segment.end)
    }));

    const rotatedBends = bends.map(bend => ({
        ...bend,
        vertex: rotatePoint(bend.vertex)
    }));

    // Масштабирование и центрирование
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

    const scaleX =
        profileWidth > 0
            ? availableWidth / profileWidth
            : 1;

    const scaleY =
        profileHeight > 0
            ? availableHeight / profileHeight
            : 1;

    const scale = Math.max(
        0.05,
        Math.min(scaleX, scaleY, 5)
    );

    const drawingWidth = profileWidth * scale;
    const drawingHeight = profileHeight * scale;

    const offsetX =
        PADDING +
        (availableWidth - drawingWidth) / 2;

    const offsetY =
        PADDING +
        (availableHeight - drawingHeight) / 2;

    const toSvg = point => ({
        x: offsetX + (point.x - minX) * scale,
        y: offsetY + (point.y - minY) * scale
    });

    // Геометрия
    const getNormal = (start, end) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);

        return length
            ? {
                x: -dy / length,
                y: dx / length
            }
            : {
                x: 0,
                y: 0
            };
    };

    const normalize = vector => {
        const length = Math.hypot(vector.x, vector.y);

        return length
            ? {
                x: vector.x / length,
                y: vector.y / length
            }
            : {
                x: 0,
                y: 0
            };
    };

    /*
     * Определяет расстояние от центра прямоугольника текста
     * до его края в заданном направлении.
     *
     * width  — ширина текста
     * height — высота текста
     * direction — направление от центра текста
     */
    const getTextRectProjection = (width, height, direction) => {
        const dir = normalize(direction);

        return (
            (width / 2) * Math.abs(dir.x) +
            (height / 2) * Math.abs(dir.y)
        );
    };

    const lineIntersection = (p1, p2, p3, p4) => {
        const denominator =
            (p1.x - p2.x) * (p3.y - p4.y) -
            (p1.y - p2.y) * (p3.x - p4.x);

        if (Math.abs(denominator) < 0.000001) {
            return p2;
        }

        const a =
            p1.x * p2.y -
            p1.y * p2.x;

        const b =
            p3.x * p4.y -
            p3.y * p4.x;

        return {
            x:
                (
                    a * (p3.x - p4.x) -
                    (p1.x - p2.x) * b
                ) / denominator,

            y:
                (
                    a * (p3.y - p4.y) -
                    (p1.y - p2.y) * b
                ) / denominator
        };
    };

    // Контур материала
    const halfThickness = Number(profile.thickness) / 2;

    const upperLines = [];
    const lowerLines = [];

    rotatedSegments.forEach(segment => {
        const normal = getNormal(
            segment.start,
            segment.end
        );

        upperLines.push({
            start: {
                x:
                    segment.start.x +
                    normal.x * halfThickness,

                y:
                    segment.start.y +
                    normal.y * halfThickness
            },

            end: {
                x:
                    segment.end.x +
                    normal.x * halfThickness,

                y:
                    segment.end.y +
                    normal.y * halfThickness
            }
        });

        lowerLines.push({
            start: {
                x:
                    segment.start.x -
                    normal.x * halfThickness,

                y:
                    segment.start.y -
                    normal.y * halfThickness
            },

            end: {
                x:
                    segment.end.x -
                    normal.x * halfThickness,

                y:
                    segment.end.y -
                    normal.y * halfThickness
            }
        });
    });

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

        upperContour.push(
            upperLines.at(-1).end
        );

        lowerContour.push(
            lowerLines.at(-1).end
        );
    }

    const profileContour = [
        ...upperContour,
        ...lowerContour.reverse()
    ];

    const contourPath =
        profileContour.length > 1
            ? profileContour
                .map((point, index) =>
                    `${index === 0 ? "M" : "L"} ${toSvg(point).x} ${toSvg(point).y}`
                )
                .join(" ") + " Z"
            : "";

    // =========================================================
    // Размеры полок
    // =========================================================
    const lengthLabels = rotatedSegments.map(segment => {
        const start = toSvg(segment.start);
        const end = toSvg(segment.end);

        const middle = {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2
        };

        const normal = getNormal(start, end);

        // Направление наружу от материала
        const direction = segment.side === "left" ? 1 : -1;

        const textHalfHeight = DIMENSION_FONT_SIZE / 2;

        const labelOffset =
            halfThickness * scale +
            textHalfHeight +
            LENGTH_TEXT_OFFSET;

        const labelPoint = {
            x: middle.x + normal.x * labelOffset * direction,
            y: middle.y + normal.y * labelOffset * direction
        };

        let textAngle =
            Math.atan2(
                end.y - start.y,
                end.x - start.x
            ) * 180 / Math.PI;

        // Текст никогда не должен быть вверх ногами
        if (textAngle > 90 || textAngle < -90) {
            textAngle += 180;
        }

        return {
            ...segment,
            labelPoint,
            textAngle
        };
    });

    // =========================================================
    // Размеры углов
    // =========================================================
    const angleDimensions = rotatedBends.map(bend => {
        const i = bend.index;

        const previousSegment =
            rotatedSegments[i];

        const nextSegment =
            rotatedSegments[i + 1];

        if (!previousSegment || !nextSegment) {
            return null;
        }

        const innerAngle =
            Number(bend.innerAngle);

        const centerLineVertex =
            bend.vertex;

        const v1 = normalize({
            x:
                previousSegment.start.x -
                previousSegment.end.x,

            y:
                previousSegment.start.y -
                previousSegment.end.y
        });

        const v2 = normalize({
            x:
                nextSegment.end.x -
                nextSegment.start.x,

            y:
                nextSegment.end.y -
                nextSegment.start.y
        });

        // =====================================================
        // 180° — внутренний периметр является параллельной линией
        // =====================================================
        if (Math.abs(innerAngle - 180) < 0.001) {
            const tangent = v1;

            const normal =
                bend.direction === "right"
                    ? {
                        x: tangent.y,
                        y: -tangent.x
                    }
                    : {
                        x: -tangent.y,
                        y: tangent.x
                    };

            const innerVertex = {
                x:
                    centerLineVertex.x +
                    normal.x * halfThickness,

                y:
                    centerLineVertex.y +
                    normal.y * halfThickness
            };

            const center = toSvg(innerVertex);

            const radius =
                ANGLE_RADIUS * scale;

            const startPoint = {
                x:
                    center.x +
                    tangent.x * radius,

                y:
                    center.y +
                    tangent.y * radius
            };

            const endPoint = {
                x:
                    center.x -
                    tangent.x * radius,

                y:
                    center.y -
                    tangent.y * radius
            };

            /*
             * Размер текста угла
             */
            const textWidth =
                (String(bend.innerAngle).length + 1) *
                DIMENSION_FONT_SIZE *
                0.65;

            const textHeight =
                DIMENSION_FONT_SIZE;

            /*
             * Край прямоугольника текста
             * в направлении normal.
             */
            const textRectOffset =
                getTextRectProjection(
                    textWidth,
                    textHeight,
                    normal
                );

            const textRadius =
                radius +
                ANGLE_TEXT_GAP * scale +
                textRectOffset;

            /*
             * Центр текста находится
             * на нормали.
             */
            const textPoint = {
                x:
                    center.x +
                    normal.x * textRadius,

                y:
                    center.y +
                    normal.y * textRadius
            };

            return {
                ...bend,
                center,
                startPoint,
                endPoint,
                textPoint,
                sweepFlag:
                    bend.direction === "right"
                        ? 0
                        : 1
            };
        }

        // =====================================================
        // Внутренние грани двух полок
        // =====================================================
        const normal1 = getNormal(
            previousSegment.start,
            previousSegment.end
        );

        const normal2 = getNormal(
            nextSegment.start,
            nextSegment.end
        );

        /*
         * Биссектриса внутреннего угла
         */
        const bisector = normalize({
            x: v1.x + v2.x,
            y: v1.y + v2.y
        });

        const side1 =
            Math.sign(
                bisector.x * normal1.x +
                bisector.y * normal1.y
            ) || 1;

        const side2 =
            Math.sign(
                bisector.x * normal2.x +
                bisector.y * normal2.y
            ) || 1;

        const innerLine1 = {
            start: {
                x:
                    previousSegment.start.x +
                    normal1.x *
                    halfThickness *
                    side1,

                y:
                    previousSegment.start.y +
                    normal1.y *
                    halfThickness *
                    side1
            },

            end: {
                x:
                    previousSegment.end.x +
                    normal1.x *
                    halfThickness *
                    side1,

                y:
                    previousSegment.end.y +
                    normal1.y *
                    halfThickness *
                    side1
            }
        };

        const innerLine2 = {
            start: {
                x:
                    nextSegment.start.x +
                    normal2.x *
                    halfThickness *
                    side2,

                y:
                    nextSegment.start.y +
                    normal2.y *
                    halfThickness *
                    side2
            },

            end: {
                x:
                    nextSegment.end.x +
                    normal2.x *
                    halfThickness *
                    side2,

                y:
                    nextSegment.end.y +
                    normal2.y *
                    halfThickness *
                    side2
            }
        };

        /*
         * Вершина внутреннего угла
         */
        const innerVertex = lineIntersection(
            innerLine1.start,
            innerLine1.end,
            innerLine2.start,
            innerLine2.end
        );

        /*
         * Это центр дуги.
         */
        const center = toSvg(innerVertex);

        const radius =
            ANGLE_RADIUS * scale;

        const edge1 = normalize({
            x:
                innerLine1.start.x -
                innerLine1.end.x,

            y:
                innerLine1.start.y -
                innerLine1.end.y
        });

        const edge2 = normalize({
            x:
                innerLine2.end.x -
                innerLine2.start.x,

            y:
                innerLine2.end.y -
                innerLine2.start.y
        });

        const startPoint = {
            x:
                center.x +
                edge1.x * radius,

            y:
                center.y +
                edge1.y * radius
        };

        const endPoint = {
            x:
                center.x +
                edge2.x * radius,

            y:
                center.y +
                edge2.y * radius
        };

        // =====================================================
        // Прямоугольник текста угла
        // =====================================================
        const textWidth =
            (String(bend.innerAngle).length + 1) *
            DIMENSION_FONT_SIZE *
            0.65;

        const textHeight =
            DIMENSION_FONT_SIZE;

        /*
         * Здесь самое главное:
         *
         * определяем расстояние от ЦЕНТРА текста
         * до его КРАЯ по направлению биссектрисы.
         *
         * Поэтому центр текста остаётся
         * точно на биссектрисе.
         */
        const textRectOffset =
            getTextRectProjection(
                textWidth,
                textHeight,
                bisector
            );

        /*
         * От центра дуги:
         *
         * radius
         * +
         * gap
         * +
         * расстояние до края текста
         */
        const textRadius =
            radius +
            ANGLE_TEXT_GAP * scale +
            textRectOffset;

        /*
         * Центр текстового прямоугольника.
         * Он находится на биссектрисе.
         */
        const textPoint = {
            x:
                center.x +
                bisector.x * textRadius,

            y:
                center.y +
                bisector.y * textRadius
        };

        const cross =
            edge1.x * edge2.y -
            edge1.y * edge2.x;

        return {
            ...bend,
            center,
            startPoint,
            endPoint,
            textPoint,
            sweepFlag:
                cross > 0 ? 1 : 0
        };
    });


    return (
        <Paper
            elevation={2}
            sx={{
                p: 2,
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box"
            }}
        >
            <Typography
                variant="h6"
                sx={{ mb: 1 }}
            >
                Схема профиля
            </Typography>

            <Box
                sx={{
                    width: "100%",
                    aspectRatio: "4 / 3"
                }}
            >
                <svg
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                        color: textColor
                    }}
                >

                    {/* Размеры полок */}
                    {lengthLabels.map((segment, index) => (
                        <text
                            key={`length-${index}`}
                            x={segment.labelPoint.x}
                            y={segment.labelPoint.y + TEXT_VERTICAL_CORRECTION }
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={DIMENSION_FONT_SIZE}
                            fill={textColor}
                            transform={`
rotate(
    ${segment.textAngle}
${segment.labelPoint.x}
${segment.labelPoint.y}
)
`}
                        >
                            <tspan>
                                {segment.length}
                            </tspan>

                            <tspan
                                fontSize={
                                    DIMENSION_FONT_SIZE - 2
                                }
                                dx="3"
                            >
                                mm
                            </tspan>
                        </text>
                    ))}

                    {/* Углы */}
                    {angleDimensions.map((bend, index) => {
                        if (
                            !bend ||
                            bend.innerAngle <= 0
                        ) {
                            return null;
                        }

                        const radius =
                            ANGLE_RADIUS * scale;

                        return (
                            <React.Fragment
                                key={`angle-${index}`}
                            >
                                {/* Дуга */}
                                <path
                                    d={`
M
${bend.startPoint.x}
${bend.startPoint.y}

A
${radius}
${radius}
0
0
${bend.sweepFlag}

${bend.endPoint.x}
${bend.endPoint.y}
`}
                                    fill="none"
                                    stroke={textColor}
                                    strokeWidth="0.8"
                                />

                                {/* Текст угла */}
                                <text
                                    x={bend.textPoint.x}
                                    y={bend.textPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={
                                        DIMENSION_FONT_SIZE
                                    }
                                    fill={textColor}
                                >
                                    {bend.innerAngle}°
                                </text>
                            </React.Fragment>
                        );
                    })}

                    {/* Материал */}
                    <path
                        d={contourPath}
                        fill={profileFill}
                        stroke={textColor}
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                    />

                    {/* Информация */}
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

export default ProfilePreview;
