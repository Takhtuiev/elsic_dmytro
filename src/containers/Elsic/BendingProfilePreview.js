import React from "react";
import {
    Box,
    Paper,
    Typography,
} from "@mui/material";


function BendingProfilePreview({
    profile,
    verticalShelf = 3,
}) {

    // =====================================================
    // Настройки
    // =====================================================

    const VIEWBOX_WIDTH = 600;
    const VIEWBOX_HEIGHT = 450;

    const PADDING = 30;

    const MIN_LENGTH_FOR_DRAW = 20;

    // Размер текста всех размеров
    const DIMENSION_FONT_SIZE = 12;

    // Смещение текста размера полки
    const LENGTH_TEXT_OFFSET = 15;

    // Радиус дуги обозначения внутреннего угла
    const ANGLE_RADIUS = 12;

    // Расстояние текста угла от дуги
    const ANGLE_TEXT_GAP = 6;


    // =====================================================
    // Построение профиля
    // =====================================================

    const points = [];
    const segments = [];
    const bends = [];

    let x = 0;
    let y = 0;

    // =====================================================
    // Накопленный угол направления текущей полки
    // =====================================================

    let currentAngle = 0;


    points.push({
        x,
        y,
    });


    // =====================================================
    // Полки + гибки
    // =====================================================

    profile.shelves.forEach(
        (shelf, index) => {

            const originalLength =
                Number(shelf.length);


            const length =
                originalLength > 0
                    ? originalLength
                    : MIN_LENGTH_FOR_DRAW;


            // -------------------------------------------------
            // Начало полки
            // -------------------------------------------------

            const start = {
                x,
                y,
            };


            // -------------------------------------------------
            // Направление текущей полки
            // -------------------------------------------------

            const angleRad =
                currentAngle *
                Math.PI /
                180;


            // -------------------------------------------------
            // Конец полки
            // -------------------------------------------------

            x +=
                Math.cos(angleRad) *
                length;


            y -=
                Math.sin(angleRad) *
                length;


            const end = {
                x,
                y,
            };


            points.push(end);


            // -------------------------------------------------
            // Сохраняем полку
            // -------------------------------------------------

            segments.push({

                index,

                start,

                end,

                length:
                    originalLength,

                side:
                    shelf.side,

                angle:
                    currentAngle,
            });


            // =================================================
            // Гибка после полки
            // =================================================

            if (
                profile.bends[index]
            ) {

                const bend =
                    profile.bends[index];


                // -------------------------------------------------
                // ВАЖНО:
                //
                // bend.angle — внутренний угол
                // между двумя полками.
                // -------------------------------------------------

                const innerAngle =
                    Number(
                        bend.angle
                    ) || 0;


                // -------------------------------------------------
                // Вершина гибки
                // -------------------------------------------------

                const vertex = {
                    x,
                    y,
                };


                bends.push({

                    index,

                    vertex,

                    innerAngle,

                    direction:
                        bend.direction,

                    incomingAngle:
                        currentAngle,
                });


                // =================================================
                // Изменение направления
                //
                // Внутренний угол != угол поворота.
                //
                // turningAngle =
                //     180 - innerAngle
                // =================================================

                const turningAngle =
                    180 -
                    innerAngle;


                // =================================================
                // Учитываем направление гибки
                // =================================================

                if (
                    bend.direction ===
                    "right"
                ) {

                    currentAngle -=
                        turningAngle;

                } else if (
                    bend.direction ===
                    "left"
                ) {

                    currentAngle +=
                        turningAngle;
                }
            }
        }
    );


    // =====================================================
    // Расчёт угла выбранной полки
    // =====================================================

    /*
        Здесь заново суммируем все предыдущие гибки.

        Для полки №1:
            нет предыдущих гибок -> 0°

        Для полки №2:
            учитывается bend[0]

        Для полки №3:
            учитываются bend[0] + bend[1]

        И т.д.
    */

    let selectedShelfAngle = 0;


    for (
        let i = 0;
        i < verticalShelf - 1;
        i++
    ) {

        const bend =
            profile.bends[i];


        if (!bend) {
            continue;
        }


        const innerAngle =
            Number(
                bend.angle
            ) || 0;


        const turningAngle =
            180 -
            innerAngle;


        if (
            bend.direction ===
            "right"
        ) {

            selectedShelfAngle -=
                turningAngle;

        } else if (
            bend.direction ===
            "left"
        ) {

            selectedShelfAngle +=
                turningAngle;
        }
    }


    // =====================================================
    // Целевое направление выбранной полки
    //
    // 0°  -> вправо
    // 90° -> вверх
    // =====================================================

    const TARGET_ANGLE = -90;


    // =====================================================
    // Общий поворот всей схемы
    // =====================================================

    /*
        Хотим получить:

        selectedShelfAngle +
        rotationAngle =
        90°

        Поэтому:

        rotationAngle =
            90° -
            selectedShelfAngle
    */

    const rotationAngle =
        TARGET_ANGLE -
        selectedShelfAngle;


    // =====================================================
    // Поворот всей геометрии
    // =====================================================

    const rotationRad =
        rotationAngle *
        Math.PI /
        180;


    const cosRotation =
        Math.cos(
            rotationRad
        );


    const sinRotation =
        Math.sin(
            rotationRad
        );


    // =====================================================
    // Поворот точки
    //
    // ВАЖНО:
    //
    // SVG имеет Y вниз.
    //
    // Поэтому здесь используется матрица,
    // соответствующая нашей системе углов:
    //
    // 0°  -> вправо
    // 90° -> вверх
    // =====================================================

    const rotatePoint = (
        point
    ) => {

        return {

            x:
                point.x *
                cosRotation +
                point.y *
                sinRotation,

            y:
                -point.x *
                sinRotation +
                point.y *
                cosRotation,
        };
    };


    // =====================================================
    // Поворачиваем профиль
    // =====================================================

    const rotatedPoints =
        points.map(
            rotatePoint
        );


    // =====================================================
    // Поворачиваем полки
    // =====================================================

    const rotatedSegments =
        segments.map(
            (segment) => ({

                ...segment,

                start:
                    rotatePoint(
                        segment.start
                    ),

                end:
                    rotatePoint(
                        segment.end
                    ),
            })
        );


    // =====================================================
    // Поворачиваем гибки
    // =====================================================

    const rotatedBends =
        bends.map(
            (bend) => ({

                ...bend,

                vertex:
                    rotatePoint(
                        bend.vertex
                    ),
            })
        );


    // =====================================================
    // Границы профиля
    // =====================================================

    const xs =
        rotatedPoints.map(
            (point) => point.x
        );


    const ys =
        rotatedPoints.map(
            (point) => point.y
        );


    const minX =
        Math.min(...xs);


    const maxX =
        Math.max(...xs);


    const minY =
        Math.min(...ys);


    const maxY =
        Math.max(...ys);


    const profileWidth =
        maxX -
        minX;


    const profileHeight =
        maxY -
        minY;


    // =====================================================
    // Автомасштабирование
    // =====================================================

    const availableWidth =
        VIEWBOX_WIDTH -
        PADDING * 2;


    const availableHeight =
        VIEWBOX_HEIGHT -
        PADDING * 2;


    const scaleX =
        profileWidth > 0
            ? availableWidth /
              profileWidth
            : 1;


    const scaleY =
        profileHeight > 0
            ? availableHeight /
              profileHeight
            : 1;


    let scale =
        Math.min(
            scaleX,
            scaleY
        );


    scale =
        Math.min(
            scale,
            5
        );


    scale =
        Math.max(
            scale,
            0.05
        );


    // =====================================================
    // Перевод координат в SVG
    // =====================================================

    const toSvg = (
        point
    ) => ({

        x:
            PADDING +
            (point.x - minX) *
            scale,

        y:
            PADDING +
            (point.y - minY) *
            scale,
    });


    const svgPoints =
        rotatedPoints.map(
            toSvg
        );


    // =====================================================
    // Polyline
    // =====================================================

    const pointsString =
        svgPoints
            .map(
                (point) =>
                    `${point.x},${point.y}`
            )
            .join(" ");


    // =====================================================
    // Перпендикуляр
    // =====================================================

    const getPerpendicular = (
        start,
        end
    ) => {

        const dx =
            end.x -
            start.x;


        const dy =
            end.y -
            start.y;


        const length =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        if (
            length === 0
        ) {

            return {
                x: 0,
                y: 0,
            };
        }


        return {

            x:
                -dy /
                length,

            y:
                dx /
                length,
        };
    };


    // =====================================================
    // Нормализация вектора
    // =====================================================

    const normalize = (
        vector
    ) => {

        const length =
            Math.sqrt(
                vector.x *
                    vector.x +
                vector.y *
                    vector.y
            );


        if (
            length === 0
        ) {

            return {
                x: 0,
                y: 0,
            };
        }


        return {

            x:
                vector.x /
                length,

            y:
                vector.y /
                length,
        };
    };


    // =====================================================
    // Размеры полок
    // =====================================================

    const lengthLabels =
        rotatedSegments.map(
            (segment) => {

                const start =
                    toSvg(
                        segment.start
                    );


                const end =
                    toSvg(
                        segment.end
                    );


                const middle = {

                    x:
                        (
                            start.x +
                            end.x
                        ) / 2,

                    y:
                        (
                            start.y +
                            end.y
                        ) / 2,
                };


                const perpendicular =
                    getPerpendicular(
                        start,
                        end
                    );


                const direction =
                    segment.side ===
                    "left"
                        ? 1
                        : -1;


                const labelPoint = {

                    x:
                        middle.x +
                        perpendicular.x *
                        LENGTH_TEXT_OFFSET *
                        direction,

                    y:
                        middle.y +
                        perpendicular.y *
                        LENGTH_TEXT_OFFSET *
                        direction,
                };


                let textAngle =
                    Math.atan2(
                        end.y -
                            start.y,

                        end.x -
                            start.x
                    ) *
                    180 /
                    Math.PI;


                if (
                    textAngle > 90 ||
                    textAngle < -90
                ) {

                    textAngle +=
                        180;
                }


                return {

                    ...segment,

                    labelPoint,

                    textAngle,
                };
            }
        );


    // =====================================================
    // Дуги внутренних углов
    // =====================================================

    const angleDimensions =
        rotatedBends.map(
            (bend) => {

                const bendIndex =
                    bend.index;


                const previousSegment =
                    rotatedSegments[
                        bendIndex
                    ];


                const nextSegment =
                    rotatedSegments[
                        bendIndex + 1
                    ];


                if (
                    !previousSegment ||
                    !nextSegment
                ) {

                    return null;
                }


                // -------------------------------------------------
                // Центр угла
                // -------------------------------------------------

                const center =
                    toSvg(
                        bend.vertex
                    );


                // =================================================
                // Вектор от вершины назад
                // по первой полке
                // =================================================

                const v1 =
                    normalize({

                        x:
                            previousSegment
                                .start.x -
                            previousSegment
                                .end.x,

                        y:
                            previousSegment
                                .start.y -
                            previousSegment
                                .end.y,
                    });


                // =================================================
                // Вектор от вершины
                // по второй полке
                // =================================================

                const v2 =
                    normalize({

                        x:
                            nextSegment
                                .end.x -
                            nextSegment
                                .start.x,

                        y:
                            nextSegment
                                .end.y -
                            nextSegment
                                .start.y,
                    });


                // =================================================
                // Начало дуги
                // =================================================

                const startPoint = {

                    x:
                        center.x +
                        v1.x *
                        ANGLE_RADIUS,

                    y:
                        center.y +
                        v1.y *
                        ANGLE_RADIUS,
                };


                // =================================================
                // Конец дуги
                // =================================================

                const endPoint = {

                    x:
                        center.x +
                        v2.x *
                        ANGLE_RADIUS,

                    y:
                        center.y +
                        v2.y *
                        ANGLE_RADIUS,
                };


                // =================================================
                // Биссектриса внутреннего угла
                // =================================================

                let bisector =
                    normalize({

                        x:
                            v1.x +
                            v2.x,

                        y:
                            v1.y +
                            v2.y,
                    });


                // -------------------------------------------------
                // Защита для 180°
                // -------------------------------------------------

                if (
                    Math.abs(
                        bisector.x
                    ) < 0.0001 &&
                    Math.abs(
                        bisector.y
                    ) < 0.0001
                ) {

                    bisector = {

                        x: 0,

                        y: -1,
                    };
                }


                // =================================================
                // Положение текста
                // =================================================

                const textRadius =
                    ANGLE_RADIUS +
                    ANGLE_TEXT_GAP +
                    DIMENSION_FONT_SIZE /
                    2;


                const textPoint = {

                    x:
                        center.x +
                        bisector.x *
                        textRadius,

                    y:
                        center.y +
                        bisector.y *
                        textRadius,
                };


                // =================================================
                // Направление дуги
                // =================================================

                const cross =
                    v1.x *
                    v2.y -
                    v1.y *
                    v2.x;


                const sweepFlag =
                    cross > 0
                        ? 1
                        : 0;


                return {

                    ...bend,

                    center,

                    startPoint,

                    endPoint,

                    textPoint,

                    sweepFlag,
                };
            }
        );


    // =====================================================
    // Render
    // =====================================================

    return (

        <Paper
            elevation={2}
            sx={{
                p: 2,

                width: "100%",

                minWidth: 0,

                boxSizing:
                    "border-box",
            }}
        >

            <Typography
                variant="h6"
                sx={{
                    mb: 1,
                }}
            >
                Схема профиля
            </Typography>

            <Box
                sx={{
                    width: "100%",

                    aspectRatio:
                        "4 / 3",
                }}
            >

                <svg
                    viewBox={`
0
0
${VIEWBOX_WIDTH}
${VIEWBOX_HEIGHT}
`}

                    width="100%"

                    height="100%"

                    preserveAspectRatio="
                        xMidYMid meet
                    "
                >

                    {/* ================================================= */}
                    {/* Размеры полок */}
                    {/* ================================================= */}

                    {lengthLabels.map(
                        (
                            segment,
                            index
                        ) => (

                            <text
                                key={
                                    `length-${index}`
                                }

                                x={
                                    segment
                                        .labelPoint
                                        .x
                                }

                                y={
                                    segment
                                        .labelPoint
                                        .y
                                }

                                textAnchor="
                                    middle
                                "

                                dominantBaseline="
                                    middle
                                "

                                fontSize={
                                    DIMENSION_FONT_SIZE
                                }

                                transform={`
rotate(
    ${segment.textAngle}
${segment.labelPoint.x}
${segment.labelPoint.y}
)
`}
                            >

                                {
                                    segment.length >
                                    0
                                        ? `${segment.length} мм`
                                        : "—"
                                }

                            </text>
                        )
                    )}


                    {/* ================================================= */}
                    {/* Внутренние углы */}
                    {/* ================================================= */}

                    {angleDimensions.map(
                        (
                            bend,
                            index
                        ) => {

                            if (
                                !bend ||
                                bend.innerAngle <=
                                    0
                            ) {

                                return null;
                            }


                            return (

                                <React.Fragment
                                    key={
                                        `angle-${index}`
                                    }
                                >

                                    {/* ================================= */}
                                    {/* Дуга внутреннего угла */}
                                    {/* ================================= */}

                                    <path
                                        d={`
M
${bend.startPoint.x}
${bend.startPoint.y}

A
${ANGLE_RADIUS}
${ANGLE_RADIUS}
0
0
${bend.sweepFlag}
${bend.endPoint.x}
${bend.endPoint.y}
`}

                                        fill="none"

                                        stroke="
                                            currentColor
                                        "

                                        strokeWidth="1.5"
                                    />


                                    {/* ================================= */}
                                    {/* Значение угла */}
                                    {/* ================================= */}

                                    <text
                                        x={
                                            bend
                                                .textPoint
                                                .x
                                        }

                                        y={
                                            bend
                                                .textPoint
                                                .y
                                        }

                                        textAnchor="
                                            middle
                                        "

                                        dominantBaseline="
                                            middle
                                        "

                                        fontSize={
                                            DIMENSION_FONT_SIZE
                                        }
                                    >

                                        {
                                            bend.innerAngle
                                        }°

                                    </text>

                                </React.Fragment>
                            );
                        }
                    )}


                    {/* ================================================= */}
                    {/* Профиль */}
                    {/* ================================================= */}

                    <polyline
                        points={
                            pointsString
                        }

                        fill="none"

                        stroke="
                            currentColor
                        "

                        strokeWidth="4"

                        strokeLinecap="
                            round
                        "

                        strokeLinejoin="
                            round
                        "
                    />


                    {/* ================================================= */}
                    {/* Вершины гибок */}
                    {/* ================================================= */}

                    {svgPoints.map(
                        (
                            point,
                            index
                        ) => {

                            if (
                                index === 0 ||
                                index ===
                                    svgPoints.length -
                                    1
                            ) {

                                return null;
                            }


                            return (

                                <circle
                                    key={
                                        `point-${index}`
                                    }

                                    cx={
                                        point.x
                                    }

                                    cy={
                                        point.y
                                    }

                                    r="3"

                                    fill="
                                        currentColor
                                    "
                                />

                            );
                        }
                    )}

                </svg>

            </Box>

        </Paper>
    );
}


export default BendingProfilePreview;
