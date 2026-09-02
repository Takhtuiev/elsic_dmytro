import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { calculateBlankLength } from "./Calculations";

// =========================================================
// CONSTANTS
// =========================================================

const BLACK_COLOR = "#212121";
const BLUE_COLOR = "#1976d2";
const GRAY_COLOR = "#9e9e9e";

const PROFILE_STROKE_WIDTH = 1.2;

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 450;

const PADDING = 40;
const SAFE_PADDING = 15;
const BOTTOM_INFO_HEIGHT = 30;

const MIN_LENGTH_FOR_DRAW = 20;

const DIMENSION_FONT_SIZE = 12;
const LENGTH_TEXT_OFFSET = 4;
const TEXT_VERTICAL_CORRECTION = 1.3;

const ANGLE_RADIUS = 12;
const ANGLE_TEXT_GAP = 0;

// =========================================================
// GEOMETRY
// =========================================================

const normalize = ({ x, y }) => {
    const length = Math.hypot(x, y);

    if (!length) {
        return { x: 0, y: 0 };
    }

    return {
        x: x / length,
        y: y / length,
    };
};

const getNormal = (start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (!length) {
        return { x: 0, y: 0 };
    }

    return {
        x: -dy / length,
        y: dx / length,
    };
};

const getTextRectProjection = (
    width,
    height,
    direction
) => {
    const dir = normalize(direction);

    return (
        (width / 2) * Math.abs(dir.x) +
        (height / 2) * Math.abs(dir.y)
    );
};

const lineIntersection = (
    p1,
    p2,
    p3,
    p4
) => {
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
            ) / denominator,
    };
};

// =========================================================
// DIMENSIONS
// =========================================================

const buildLengthDimensions = ({
                                   color,
                                   segments,
                                   halfThickness,
                               }) =>
    segments.map(segment => {
        const middle = {
            x:
                (segment.start.x +
                    segment.end.x) /
                2,

            y:
                (segment.start.y +
                    segment.end.y) /
                2,
        };

        const normal = getNormal(
            segment.start,
            segment.end
        );

        const direction =
            segment.side === "left"
                ? 1
                : -1;

        const labelOffset =
            halfThickness +
            DIMENSION_FONT_SIZE / 2 +
            LENGTH_TEXT_OFFSET;

        const labelPoint = {
            x:
                middle.x +
                normal.x *
                labelOffset *
                direction,

            y:
                middle.y +
                normal.y *
                labelOffset *
                direction,
        };

        let textAngle =
            Math.atan2(
                segment.end.y -
                segment.start.y,
                segment.end.x -
                segment.start.x
            ) *
            180 /
            Math.PI;

        if (
            textAngle > 90 ||
            textAngle < -90
        ) {
            textAngle += 180;
        }

        return {
            ...segment,
            color,
            labelPoint,
            textAngle,
        };
    });

const buildAngleDimensions = ({
                                  color,
                                  segments,
                                  bends,
                                  halfThickness,
                              }) => {
    if (
        !segments ||
        segments.length < 2 ||
        !bends ||
        !bends.length
    ) {
        return [];
    }

    return bends
        .map((bend, localIndex) => {
            const previousSegment =
                segments[localIndex];

            const nextSegment =
                segments[localIndex + 1];

            if (
                !previousSegment ||
                !nextSegment
            ) {
                return null;
            }

            const innerAngle = Number(
                bend.innerAngle ??
                bend.angle
            );

            if (
                !Number.isFinite(innerAngle) ||
                innerAngle <= 0
            ) {
                return null;
            }

            const centerLineVertex = {
                x:
                    (
                        previousSegment.end.x +
                        nextSegment.start.x
                    ) / 2,

                y:
                    (
                        previousSegment.end.y +
                        nextSegment.start.y
                    ) / 2,
            };

            const v1 = normalize({
                x:
                    previousSegment.start.x -
                    previousSegment.end.x,

                y:
                    previousSegment.start.y -
                    previousSegment.end.y,
            });

            const v2 = normalize({
                x:
                    nextSegment.end.x -
                    nextSegment.start.x,

                y:
                    nextSegment.end.y -
                    nextSegment.start.y,
            });

            // =====================================================
            // 180°
            // =====================================================

            if (
                Math.abs(innerAngle - 180) <
                0.001
            ) {
                const tangent = v1;

                const normal =
                    bend.direction ===
                    "right"
                        ? {
                            x: tangent.y,
                            y: -tangent.x,
                        }
                        : {
                            x: -tangent.y,
                            y: tangent.x,
                        };

                const innerVertex = {
                    x:
                        centerLineVertex.x +
                        normal.x *
                        halfThickness,

                    y:
                        centerLineVertex.y +
                        normal.y *
                        halfThickness,
                };

                const radius =
                    ANGLE_RADIUS;

                const startPoint = {
                    x:
                        innerVertex.x +
                        tangent.x *
                        radius,

                    y:
                        innerVertex.y +
                        tangent.y *
                        radius,
                };

                const endPoint = {
                    x:
                        innerVertex.x -
                        tangent.x *
                        radius,

                    y:
                        innerVertex.y -
                        tangent.y *
                        radius,
                };

                const textWidth =
                    (
                        String(
                            innerAngle
                        ).length + 1
                    ) *
                    DIMENSION_FONT_SIZE *
                    0.65;

                const textRectOffset =
                    getTextRectProjection(
                        textWidth,
                        DIMENSION_FONT_SIZE,
                        normal
                    );

                const textRadius =
                    radius +
                    ANGLE_TEXT_GAP +
                    textRectOffset;

                const textPoint = {
                    x:
                        innerVertex.x +
                        normal.x *
                        textRadius,

                    y:
                        innerVertex.y +
                        normal.y *
                        textRadius,
                };

                return {
                    ...bend,
                    color,
                    innerAngle,
                    center: innerVertex,
                    startPoint,
                    endPoint,
                    textPoint,

                    sweepFlag:
                        bend.direction ===
                        "right"
                            ? 0
                            : 1,
                };
            }

            // =====================================================
            // Обычная гибка
            // =====================================================

            const normal1 = getNormal(
                previousSegment.start,
                previousSegment.end
            );

            const normal2 = getNormal(
                nextSegment.start,
                nextSegment.end
            );

            const bisector = normalize({
                x: v1.x + v2.x,
                y: v1.y + v2.y,
            });

            const side1 =
                Math.sign(
                    bisector.x *
                    normal1.x +
                    bisector.y *
                    normal1.y
                ) || 1;

            const side2 =
                Math.sign(
                    bisector.x *
                    normal2.x +
                    bisector.y *
                    normal2.y
                ) || 1;

            const innerLine1 = {
                start: {
                    x:
                        previousSegment
                            .start.x +
                        normal1.x *
                        halfThickness *
                        side1,

                    y:
                        previousSegment
                            .start.y +
                        normal1.y *
                        halfThickness *
                        side1,
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
                        side1,
                },
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
                        side2,
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
                        side2,
                },
            };

            const innerVertex =
                lineIntersection(
                    innerLine1.start,
                    innerLine1.end,
                    innerLine2.start,
                    innerLine2.end
                );

            const radius =
                ANGLE_RADIUS;

            const edge1 = normalize({
                x:
                    innerLine1.start.x -
                    innerLine1.end.x,

                y:
                    innerLine1.start.y -
                    innerLine1.end.y,
            });

            const edge2 = normalize({
                x:
                    innerLine2.end.x -
                    innerLine2.start.x,

                y:
                    innerLine2.end.y -
                    innerLine2.start.y,
            });

            const startPoint = {
                x:
                    innerVertex.x +
                    edge1.x *
                    radius,

                y:
                    innerVertex.y +
                    edge1.y *
                    radius,
            };

            const endPoint = {
                x:
                    innerVertex.x +
                    edge2.x *
                    radius,

                y:
                    innerVertex.y +
                    edge2.y *
                    radius,
            };

            const textWidth =
                (
                    String(
                        innerAngle
                    ).length + 1
                ) *
                DIMENSION_FONT_SIZE *
                0.65;

            const textRectOffset =
                getTextRectProjection(
                    textWidth,
                    DIMENSION_FONT_SIZE,
                    bisector
                );

            const textRadius =
                radius +
                ANGLE_TEXT_GAP +
                textRectOffset;

            const textPoint = {
                x:
                    innerVertex.x +
                    bisector.x *
                    textRadius,

                y:
                    innerVertex.y +
                    bisector.y *
                    textRadius,
            };

            const cross =
                edge1.x * edge2.y -
                edge1.y * edge2.x;

            return {
                ...bend,
                color,
                innerAngle,
                center: innerVertex,
                startPoint,
                endPoint,
                textPoint,
                sweepFlag:
                    cross > 0 ? 1 : 0,
            };
        })
        .filter(Boolean);
};

// =========================================================
// UNIVERSAL PROFILE PART
// =========================================================

const buildProfilePart = ({
                              color,
                              fillColor,
                              profile,
                              segments = [],
                              bends = [],
                              startIndex,
                              endIndex,
                              reverse = false,
                              apexAtStart = false,
                              apexAtEnd = false,
                          }) => {
    if (!profile) {
        return null;
    }

    const {
        upperContour,
        lowerContour,
        thickness,
    } = profile;

    if (
        !upperContour ||
        !lowerContour
    ) {
        return null;
    }

    const fullProfile =
        startIndex == null ||
        endIndex == null;

    const start =
        fullProfile
            ? 0
            : startIndex;

    const end =
        fullProfile
            ? upperContour.length - 1
            : endIndex;

    let upper =
        upperContour.slice(
            start,
            end + 1
        );

    let lower =
        lowerContour.slice(
            start,
            end + 1
        );

    if (reverse) {
        upper = [
            ...upper,
        ].reverse();

        lower = [
            ...lower,
        ].reverse();
    }

    if (
        upper.length < 2 ||
        lower.length < 2
    ) {
        return null;
    }

    // =====================================================
    // ВАЖНО:
    // lower нельзя переворачивать через lower.reverse(),
    // потому что тот же массив ниже используется
    // для построения линий и торцов.
    // =====================================================

    const polygon = [
        ...upper,
        ...[...lower].reverse(),
    ];

    const strokeLines = [];

    const addContourLines =
        contour => {
            for (
                let i = 0;
                i < contour.length - 1;
                i++
            ) {
                strokeLines.push({
                    start: contour[i],
                    end: contour[i + 1],
                });
            }
        };

    // Здесь lower остаётся в исходном порядке.
    addContourLines(upper);
    addContourLines(lower);

    // =====================================================
    // НАРУЖНЫЕ ТОРЦЫ
    // =====================================================

    if (!apexAtStart) {
        strokeLines.push({
            start: upper[0],
            end: lower[0],
        });
    }

    if (!apexAtEnd) {
        const last =
            upper.length - 1;

        strokeLines.push({
            start: upper[last],
            end: lower[last],
        });
    }

    const actualThickness =
        Number(thickness) || 0;

    const halfThickness =
        actualThickness / 2;

    return {
        color,
        fillColor:
            fillColor || color,

        polygon,
        strokeLines,

        lengthDimensions:
            buildLengthDimensions({
                color,
                segments,
                halfThickness,
            }),

        angleDimensions:
            buildAngleDimensions({
                color,
                segments,
                bends,
                halfThickness,
            }),

        apexAtStart,
        apexAtEnd,
        isFullProfile: fullProfile,
    };
};

// =========================================================
// SEGMENTS
// =========================================================

const reverseSegments = segments =>
    [...segments]
        .reverse()
        .map(segment => ({
            ...segment,
            start: segment.end,
            end: segment.start,
        }));

// =========================================================
// BLUE REFERENCE SHELF
// =========================================================

const buildReferenceShelf = ({
                                 bendIndex,
                                 direction,
                                 shelves,
                                 finalSegments,
                                 upperContour,
                                 lowerContour,
                                 thickness,
                             }) => {
    const shelfIndexes = [];

    if (direction === "right") {
        for (
            let i = bendIndex + 1;
            i < shelves.length;
            i++
        ) {
            shelfIndexes.push(i);
        }
    } else if (direction === "left") {
        for (
            let i = bendIndex;
            i >= 0;
            i--
        ) {
            shelfIndexes.push(i);
        }
    }

    const totalLength =
        shelfIndexes.reduce(
            (sum, index) =>
                sum +
                Math.max(
                    0,
                    Number(
                        shelves[index]
                            ?.length || 0
                    )
                ),
            0
        );

    if (totalLength <= 0) {
        return null;
    }

    const apexIndex =
        bendIndex + 1;

    const apexUpper =
        upperContour[apexIndex];

    const apexLower =
        lowerContour[apexIndex];

    if (
        !apexUpper ||
        !apexLower
    ) {
        return null;
    }

    let directionVector = null;

    if (direction === "right") {
        const segment =
            finalSegments[
            bendIndex + 1
                ];

        if (segment) {
            directionVector =
                normalize({
                    x:
                        segment.end.x -
                        segment.start.x,

                    y:
                        segment.end.y -
                        segment.start.y,
                });
        }
    } else if (
        direction === "left"
    ) {
        const segment =
            finalSegments[bendIndex];

        if (segment) {
            directionVector =
                normalize({
                    x:
                        segment.start.x -
                        segment.end.x,

                    y:
                        segment.start.y -
                        segment.end.y,
                });
        }
    }

    if (!directionVector) {
        return null;
    }

    const apexCenter = {
        x:
            (apexUpper.x +
                apexLower.x) /
            2,

        y:
            (apexUpper.y +
                apexLower.y) /
            2,
    };

    const endCenter = {
        x:
            apexCenter.x +
            directionVector.x *
            totalLength,

        y:
            apexCenter.y +
            directionVector.y *
            totalLength,
    };

    const getEndPoint =
        apex => {
            const delta = {
                x:
                    endCenter.x -
                    apex.x,

                y:
                    endCenter.y -
                    apex.y,
            };

            const t =
                delta.x *
                directionVector.x +
                delta.y *
                directionVector.y;

            return {
                x:
                    apex.x +
                    directionVector.x *
                    t,

                y:
                    apex.y +
                    directionVector.y *
                    t,
            };
        };

    const endUpper =
        getEndPoint(apexUpper);

    const endLower =
        getEndPoint(apexLower);

    return buildProfilePart({
        color: BLUE_COLOR,

        profile: {
            upperContour: [
                apexUpper,
                endUpper,
            ],

            lowerContour: [
                apexLower,
                endLower,
            ],

            thickness,
        },

        segments: [
            {
                index: 0,

                start: apexCenter,
                end: endCenter,

                length: totalLength,
                side: "right",

                angle:
                    Math.atan2(
                        -directionVector.y,
                        directionVector.x
                    ) *
                    180 /
                    Math.PI,
            },
        ],

        bends: [],

        startIndex: 0,
        endIndex: 1,

        apexAtStart: true,
        apexAtEnd: false,
    });
};

// =========================================================
// MIRROR
// =========================================================

const shouldMirrorProfile = ({
                                 selectedBendIndex,
                                 referenceDirection,
                                 rotatedSegments,
                                 rotatedBends,
                             }) => {
    if (
        selectedBendIndex < 0 ||
        !referenceDirection
    ) {
        return false;
    }

    const bendVertex =
        rotatedBends[
            selectedBendIndex
            ]?.vertex;

    if (!bendVertex) {
        return false;
    }

    let directionVector = null;

    if (
        referenceDirection ===
        "right"
    ) {
        const segment =
            rotatedSegments[
                selectedBendIndex
                ];

        if (segment) {
            directionVector =
                normalize({
                    x:
                        segment.start.x -
                        bendVertex.x,

                    y:
                        segment.start.y -
                        bendVertex.y,
                });
        }
    } else if (
        referenceDirection ===
        "left"
    ) {
        const segment =
            rotatedSegments[
            selectedBendIndex + 1
                ];

        if (segment) {
            directionVector =
                normalize({
                    x:
                        segment.end.x -
                        bendVertex.x,

                    y:
                        segment.end.y -
                        bendVertex.y,
                });
        }
    }

    return (
        directionVector &&
        directionVector.y >
        0.000001
    );
};

// =========================================================
// BUILD COLORED PARTS
// =========================================================

const buildColoredParts = ({
                               selectedBendIndex,
                               referenceDirection,
                               profile,
                               theme,
                               finalSegments,
                               finalBends,
                               upperContour,
                               lowerContour,
                               shelves,
                           }) => {
    // =====================================================
    // НЕТ ВЫБРАННОГО УГЛА
    // =====================================================

    if (
        selectedBendIndex < 0 ||
        !referenceDirection
    ) {
        const fullPart =
            buildProfilePart({
                color: BLACK_COLOR,

                fillColor:
                theme.palette.action
                    .hover,

                profile: {
                    upperContour,
                    lowerContour,
                    thickness:
                    profile.thickness,
                },

                segments:
                finalSegments,

                bends: finalBends,
            });

        return fullPart
            ? [fullPart]
            : [];
    }

    const apexIndex =
        selectedBendIndex + 1;

    const lastIndex =
        upperContour.length - 1;

    const isRight =
        referenceDirection ===
        "right";

    // =====================================================
    // ЧАСТИ ПРОФИЛЯ
    // =====================================================

    const firstSegments =
        finalSegments.slice(
            0,
            selectedBendIndex + 1
        );

    const secondSegments =
        finalSegments.slice(
            selectedBendIndex + 1
        );

    const firstBends =
        finalBends.filter(
            bend =>
                bend.index <
                selectedBendIndex
        );

    const secondBends =
        finalBends.filter(
            bend =>
                bend.index >
                selectedBendIndex
        );

    // =====================================================
    // ПРАВАЯ СТОРОНА
    // =====================================================

    if (isRight) {
        const blackPart =
            buildProfilePart({
                color: BLACK_COLOR,

                profile: {
                    upperContour,
                    lowerContour,
                    thickness:
                    profile.thickness,
                },

                startIndex: 0,
                endIndex: apexIndex,

                segments:
                firstSegments,

                bends: firstBends,

                apexAtEnd: true,
            });

        const grayPart =
            buildProfilePart({
                color: GRAY_COLOR,

                profile: {
                    upperContour,
                    lowerContour,
                    thickness:
                    profile.thickness,
                },

                startIndex: apexIndex,
                endIndex: lastIndex,

                segments:
                secondSegments,

                bends:
                    secondBends.map(
                        bend => ({
                            ...bend,
                            index:
                                bend.index -
                                selectedBendIndex -
                                1,
                        })
                    ),

                apexAtStart: true,
            });

        const bluePart =
            buildReferenceShelf({
                bendIndex:
                selectedBendIndex,

                direction:
                referenceDirection,

                shelves,
                finalSegments,
                upperContour,
                lowerContour,

                thickness:
                profile.thickness,
            });

        return [
            blackPart,
            grayPart,
            bluePart,
        ].filter(Boolean);
    }

    // =====================================================
    // ЛЕВАЯ СТОРОНА
    // =====================================================

    const grayPart =
        buildProfilePart({
            color: GRAY_COLOR,

            profile: {
                upperContour,
                lowerContour,
                thickness:
                profile.thickness,
            },

            startIndex: 0,
            endIndex: apexIndex,

            reverse: true,

            segments:
                reverseSegments(
                    firstSegments
                ),

            bends:
                firstBends
                    .sort(
                        (a, b) =>
                            b.index -
                            a.index
                    )
                    .map(
                        (
                            bend,
                            index
                        ) => ({
                            ...bend,
                            index,
                        })
                    ),

            apexAtStart: true,
        });

    const blackPart =
        buildProfilePart({
            color: BLACK_COLOR,

            profile: {
                upperContour,
                lowerContour,
                thickness:
                profile.thickness,
            },

            startIndex: apexIndex,
            endIndex: lastIndex,

            segments:
            secondSegments,

            bends:
                secondBends.map(
                    bend => ({
                        ...bend,
                        index:
                            bend.index -
                            selectedBendIndex -
                            1,
                    })
                ),

            apexAtStart: true,
        });

    const bluePart =
        buildReferenceShelf({
            bendIndex:
            selectedBendIndex,

            direction:
            referenceDirection,

            shelves,
            finalSegments,
            upperContour,
            lowerContour,

            thickness:
            profile.thickness,
        });

    return [
        grayPart,
        blackPart,
        bluePart,
    ].filter(Boolean);
};

// =========================================================
// SVG RENDER
// =========================================================

const renderProfilePart = ({
                               part,
                               index,
                               polygonToPath,
                               strokeLinesToPath,
                               toSvg,
                               scale,
                           }) => {
    if (!part) {
        return null;
    }

    const fillOpacity =
        part.color === BLUE_COLOR
            ? 0.35
            : part.color ===
            GRAY_COLOR
                ? 0.22
                : 0.18;

    return (
        <React.Fragment
            key={`part-${index}`}
        >
            <path
                d={polygonToPath(
                    part.polygon
                )}
                fill={
                    part.fillColor ||
                    part.color
                }
                fillOpacity={
                    fillOpacity
                }
                stroke="none"
            />

            <path
                d={strokeLinesToPath(
                    part.strokeLines
                )}
                fill="none"
                stroke={part.color}
                strokeWidth={
                    PROFILE_STROKE_WIDTH
                }
                strokeLinejoin="round"
                strokeLinecap="butt"
            />

            {part.lengthDimensions.map(
                (
                    segment,
                    dimensionIndex
                ) => {
                    const labelPoint =
                        toSvg(
                            segment.labelPoint
                        );

                    return (
                        <text
                            key={`length-${index}-${dimensionIndex}`}
                            x={
                                labelPoint.x
                            }
                            y={
                                labelPoint.y +
                                TEXT_VERTICAL_CORRECTION
                            }
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={
                                DIMENSION_FONT_SIZE
                            }
                            fill={
                                segment.color
                            }
                            transform={`
                                rotate(
                                    ${segment.textAngle}
                                    ${labelPoint.x}
                                    ${labelPoint.y}
                                )
                            `}
                        >
                            <tspan>
                                {
                                    segment.length
                                }
                            </tspan>

                            <tspan
                                fontSize={
                                    DIMENSION_FONT_SIZE -
                                    2
                                }
                                dx="3"
                            >
                                mm
                            </tspan>
                        </text>
                    );
                }
            )}

            {part.angleDimensions.map(
                (
                    bend,
                    dimensionIndex
                ) => {
                    if (
                        !bend ||
                        bend.innerAngle <=
                        0
                    ) {
                        return null;
                    }

                    const startPoint =
                        toSvg(
                            bend.startPoint
                        );

                    const endPoint =
                        toSvg(
                            bend.endPoint
                        );

                    const textPoint =
                        toSvg(
                            bend.textPoint
                        );

                    const radius =
                        ANGLE_RADIUS *
                        scale;

                    return (
                        <React.Fragment
                            key={`angle-${index}-${dimensionIndex}`}
                        >
                            <path
                                d={`
                                    M
                                    ${startPoint.x}
                                    ${startPoint.y}
                                    A
                                    ${radius}
                                    ${radius}
                                    0
                                    0
                                    ${bend.sweepFlag}
                                    ${endPoint.x}
                                    ${endPoint.y}
                                `}
                                fill="none"
                                stroke={
                                    bend.color
                                }
                                strokeWidth={
                                    PROFILE_STROKE_WIDTH
                                }
                            />

                            <text
                                x={
                                    textPoint.x
                                }
                                y={
                                    textPoint.y
                                }
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={
                                    DIMENSION_FONT_SIZE
                                }
                                fontWeight="normal"
                                fill={
                                    bend.color
                                }
                            >
                                {
                                    bend.innerAngle
                                }
                                °
                            </text>
                        </React.Fragment>
                    );
                }
            )}
        </React.Fragment>
    );
};

// =========================================================
// BOUNDS
// =========================================================

const getPartBounds = part => {
    if (!part) {
        return [];
    }

    return [
        ...(part.polygon || []),

        ...(part.lengthDimensions ||
            []).map(
            item =>
                item.labelPoint
        ),

        ...(part.angleDimensions ||
            []
        ).flatMap(item => [
            item.startPoint,
            item.endPoint,
            item.textPoint,
            item.center,
        ]),
    ];
};

// =========================================================
// COMPONENT
// =========================================================

function ProfilePreview({
                            profile,
                            verticalShelf,
                            referenceBend,
                        }) {
    const theme = useTheme();

    const blankLength =
        calculateBlankLength(profile);

    const textColor =
        theme.palette.text.primary;

    // =====================================================
    // ELEMENTS
    // =====================================================

    const shelves =
        profile.elements.filter(
            element =>
                element.type ===
                "shelf"
        );

    const bends =
        profile.elements.filter(
            element =>
                element.type ===
                "bend"
        );

    // =====================================================
    // AXIS GEOMETRY
    // =====================================================

    const points = [];
    const segments = [];
    const bendGeometry = [];

    let x = 0;
    let y = 0;
    let currentAngle = 0;

    points.push({ x, y });

    shelves.forEach(
        (shelf, index) => {
            const originalLength =
                Number(
                    shelf.length
                );

            const length =
                originalLength > 0
                    ? originalLength
                    : MIN_LENGTH_FOR_DRAW;

            const start = {
                x,
                y,
            };

            const angleRad =
                currentAngle *
                Math.PI /
                180;

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

            segments.push({
                index,
                start,
                end,
                length:
                originalLength,
                side: shelf.side,
                angle: currentAngle,
            });

            const bend =
                bends[index];

            if (!bend) {
                return;
            }

            const innerAngle =
                Number(
                    bend.angle
                ) || 0;

            bendGeometry.push({
                index,

                vertex: {
                    x,
                    y,
                },

                innerAngle,
                direction:
                bend.direction,
                incomingAngle:
                currentAngle,
                side: bend.side,
            });

            const turningAngle =
                180 - innerAngle;

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
    );

    // =====================================================
    // SELECTED BEND
    // =====================================================

    let selectedBendIndex = -1;

    if (referenceBend) {
        const candidate =
            Number(
                referenceBend.index
            );

        if (
            Number.isInteger(
                candidate
            ) &&
            candidate >= 0 &&
            candidate < bends.length
        ) {
            selectedBendIndex =
                candidate;
        }
    }

    const selectedBend =
        selectedBendIndex >= 0
            ? bends[
                selectedBendIndex
                ]
            : null;

    const referenceDirection =
        referenceBend?.direction ||
        selectedBend?.direction ||
        null;

    // =====================================================
    // REFERENCE SHELF ANGLE
    // =====================================================

    let referenceShelfAngle = 0;

    if (selectedBend) {
        const bendIndex =
            selectedBendIndex;

        if (
            referenceDirection ===
            "right"
        ) {
            const segment =
                segments[
                bendIndex + 1
                    ];

            if (segment) {
                referenceShelfAngle =
                    segment.angle;
            }
        } else if (
            referenceDirection ===
            "left"
        ) {
            const segment =
                segments[bendIndex];

            if (segment) {
                referenceShelfAngle =
                    segment.angle +
                    180;
            }
        }
    } else {
        const shelfNumber =
            Number(
                verticalShelf
            ) || 1;

        let selectedShelfAngle =
            0;

        for (
            let i = 0;
            i < shelfNumber - 1;
            i++
        ) {
            const bend =
                bends[i];

            if (!bend) {
                continue;
            }

            const turningAngle =
                180 -
                Number(
                    bend.angle || 0
                );

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

        referenceShelfAngle =
            selectedShelfAngle;
    }

    // =====================================================
    // ROTATION
    // =====================================================

    const rotationRad =
        -referenceShelfAngle *
        Math.PI /
        180;

    const cosRotation =
        Math.cos(rotationRad);

    const sinRotation =
        Math.sin(rotationRad);

    const rotatePoint =
        point => ({
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
        });

    const rotatedPoints =
        points.map(
            rotatePoint
        );

    const rotatedSegments =
        segments.map(
            segment => ({
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

    const rotatedBends =
        bendGeometry.map(
            bend => ({
                ...bend,

                vertex:
                    rotatePoint(
                        bend.vertex
                    ),
            })
        );

    // =====================================================
    // MIRROR
    // =====================================================

    const shouldMirrorVertically =
        shouldMirrorProfile({
            selectedBendIndex,
            referenceDirection,
            rotatedSegments,
            rotatedBends,
        });

    const mirrorPoint =
        point => ({
            x: point.x,

            y:
                shouldMirrorVertically
                    ? -point.y
                    : point.y,
        });

    const finalPoints =
        rotatedPoints.map(
            mirrorPoint
        );

    const finalSegments =
        rotatedSegments.map(
            segment => ({
                ...segment,

                start:
                    mirrorPoint(
                        segment.start
                    ),

                end:
                    mirrorPoint(
                        segment.end
                    ),
            })
        );

    const finalBends =
        rotatedBends.map(
            bend => ({
                ...bend,

                vertex:
                    mirrorPoint(
                        bend.vertex
                    ),
            })
        );

    // =====================================================
    // CONTOUR
    // =====================================================

    const halfThickness =
        Number(
            profile.thickness
        ) / 2;

    const upperLines = [];
    const lowerLines = [];

    finalSegments.forEach(
        segment => {
            const normal =
                getNormal(
                    segment.start,
                    segment.end
                );

            upperLines.push({
                start: {
                    x:
                        segment.start
                            .x +
                        normal.x *
                        halfThickness,

                    y:
                        segment.start
                            .y +
                        normal.y *
                        halfThickness,
                },

                end: {
                    x:
                        segment.end.x +
                        normal.x *
                        halfThickness,

                    y:
                        segment.end.y +
                        normal.y *
                        halfThickness,
                },
            });

            lowerLines.push({
                start: {
                    x:
                        segment.start
                            .x -
                        normal.x *
                        halfThickness,

                    y:
                        segment.start
                            .y -
                        normal.y *
                        halfThickness,
                },

                end: {
                    x:
                        segment.end.x -
                        normal.x *
                        halfThickness,

                    y:
                        segment.end.y -
                        normal.y *
                        halfThickness,
                },
            });
        }
    );

    const upperContour = [];
    const lowerContour = [];

    if (upperLines.length) {
        upperContour.push(
            upperLines[0].start
        );

        lowerContour.push(
            lowerLines[0].start
        );

        for (
            let i = 0;
            i <
            upperLines.length - 1;
            i++
        ) {
            upperContour.push(
                lineIntersection(
                    upperLines[i].start,
                    upperLines[i].end,
                    upperLines[
                    i + 1
                        ].start,
                    upperLines[
                    i + 1
                        ].end
                )
            );

            lowerContour.push(
                lineIntersection(
                    lowerLines[i].start,
                    lowerLines[i].end,
                    lowerLines[
                    i + 1
                        ].start,
                    lowerLines[
                    i + 1
                        ].end
                )
            );
        }

        upperContour.push(
            upperLines[
            upperLines.length - 1
                ].end
        );

        lowerContour.push(
            lowerLines[
            lowerLines.length - 1
                ].end
        );
    }

    // =====================================================
    // COLORED PARTS
    // =====================================================

    const parts =
        buildColoredParts({
            selectedBendIndex,
            referenceDirection,

            profile,
            theme,

            finalSegments,
            finalBends,

            upperContour,
            lowerContour,

            shelves,
        });

    // =====================================================
    // BOUNDS
    // =====================================================

    const boundsPoints = [
        ...finalPoints,
        ...parts.flatMap(
            getPartBounds
        ),
    ];

    const xs =
        boundsPoints.length
            ? boundsPoints.map(
                point => point.x
            )
            : [0];

    const ys =
        boundsPoints.length
            ? boundsPoints.map(
                point => point.y
            )
            : [0];

    const minX =
        Math.min(...xs);

    const maxX =
        Math.max(...xs);

    const minY =
        Math.min(...ys);

    const maxY =
        Math.max(...ys);

    const drawingWidth =
        maxX - minX;

    const drawingHeight =
        maxY - minY;

    // =====================================================
    // SCALE
    // =====================================================

    const availableWidth =
        VIEWBOX_WIDTH -
        PADDING * 2 -
        SAFE_PADDING * 2;

    const availableHeight =
        VIEWBOX_HEIGHT -
        PADDING * 2 -
        BOTTOM_INFO_HEIGHT -
        SAFE_PADDING * 2;

    const scaleX =
        drawingWidth > 0
            ? availableWidth /
            drawingWidth
            : 1;

    const scaleY =
        drawingHeight > 0
            ? availableHeight /
            drawingHeight
            : 1;

    const scale =
        Math.max(
            0.05,
            Math.min(
                scaleX,
                scaleY,
                5
            )
        );

    const finalDrawingWidth =
        drawingWidth * scale;

    const finalDrawingHeight =
        drawingHeight * scale;

    const offsetX =
        PADDING +
        SAFE_PADDING +
        (
            availableWidth -
            finalDrawingWidth
        ) /
        2;

    const offsetY =
        PADDING +
        SAFE_PADDING +
        (
            availableHeight -
            finalDrawingHeight
        ) /
        2;

    const toSvg =
        point => ({
            x:
                offsetX +
                (point.x - minX) *
                scale,

            y:
                offsetY +
                (point.y - minY) *
                scale,
        });

    // =====================================================
    // SVG HELPERS
    // =====================================================

    const polygonToPath =
        polygon => {
            if (
                !polygon ||
                polygon.length < 2
            ) {
                return "";
            }

            return (
                polygon
                    .map(
                        (
                            point,
                            index
                        ) => {
                            const p =
                                toSvg(
                                    point
                                );

                            return `${
                                index ===
                                0
                                    ? "M"
                                    : "L"
                            } ${p.x} ${p.y}`;
                        }
                    )
                    .join(" ") +
                " Z"
            );
        };

    const strokeLinesToPath =
        strokeLines => {
            if (
                !strokeLines ||
                !strokeLines.length
            ) {
                return "";
            }

            return strokeLines
                .map(line => {
                    const start =
                        toSvg(
                            line.start
                        );

                    const end =
                        toSvg(
                            line.end
                        );

                    return `
                        M ${start.x} ${start.y}
                        L ${end.x} ${end.y}
                    `;
                })
                .join(" ");
        };

    // =====================================================
    // RENDER
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
                sx={{ mb: 1 }}
            >
                Профиль
            </Typography>

            <Box
                sx={{
                    width: "100%",
                    aspectRatio: "4 / 3",
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
                    preserveAspectRatio="xMidYMid meet"
                >
                    {parts.map(
                        (
                            part,
                            index
                        ) =>
                            renderProfilePart({
                                part,
                                index,
                                polygonToPath,
                                strokeLinesToPath,
                                toSvg,
                                scale,
                            })
                    )}

                    <text
                        x={
                            VIEWBOX_WIDTH /
                            2
                        }
                        y={
                            VIEWBOX_HEIGHT -
                            15
                        }
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12"
                        fill={textColor}
                    >
                        Materialstärke:{" "}

                        <tspan
                            fontWeight="bold"
                        >
                            {
                                Number(
                                    profile.thickness
                                )
                            }
                        </tspan>

                        {" mm | "}

                        Zuschnittlänge:{" "}

                        <tspan
                            fontWeight="bold"
                        >
                            {blankLength.toFixed(
                                2
                            )}
                        </tspan>

                        {" mm"}
                    </text>
                </svg>
            </Box>
        </Paper>
    );
}

export default ProfilePreview;