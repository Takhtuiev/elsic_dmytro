import React from "react";

const LINE_WIDTH = 1;
const TEXT_FONT_WEIGHT = "400";

const BendProfileRender = ({
    data,
    strokeColor = "#424242",
    fillColor = "#f0f0f0",
    annotationColor = strokeColor,
    isGhost = false
}) => {
    if (!data) return null;

    return (
        <g style={{ opacity: isGhost ? 0.6 : 1 }}>
            {data.fillPoints && (
                <polygon
                    points={data.fillPoints}
                    fill={fillColor}
                />
            )}

            <path
                d={`M ${data.sideAPath}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />

            <path
                d={`M ${data.sideBPath}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />

            {data.a.length > 0 && (
                <>
                    {data.strokeStartCap && (
                        <line
                            x1={data.a[0].x}
                            y1={data.a[0].y}
                            x2={data.b[0].x}
                            y2={data.b[0].y}
                            stroke={strokeColor}
                            strokeWidth={LINE_WIDTH}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}

                    {data.strokeEndCap && (
                        <line
                            x1={data.a[data.a.length - 1].x}
                            y1={data.a[data.a.length - 1].y}
                            x2={data.b[data.b.length - 1].x}
                            y2={data.b[data.b.length - 1].y}
                            stroke={strokeColor}
                            strokeWidth={LINE_WIDTH}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                </>
            )}

            {data.angles.map((ang, i) => (
                <g key={`ang-${i}`}>
                    <path
                        d={ang.path}
                        fill="none"
                        stroke={annotationColor}
                        strokeWidth={LINE_WIDTH}
                        strokeDasharray="2,2"
                        vectorEffect="non-scaling-stroke"
                    />

                    <text
                        x={ang.x}
                        y={ang.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={ang.fontSize || 11}
                        fill={annotationColor}
                        fontWeight={TEXT_FONT_WEIGHT}
                    >
                        {ang.text}
                    </text>
                </g>
            ))}

            {data.labels.map((lbl, i) => (
                <text
                    key={`lbl-${i}`}
                    x={lbl.x}
                    y={lbl.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={lbl.fontSize || 11}
                    fontWeight={TEXT_FONT_WEIGHT}
                    fill={annotationColor}
                    transform={`rotate(${lbl.angle},${lbl.x},${lbl.y})`}
                >
                    {lbl.text}{" "}
                    <tspan
                        // Процентное соотношение (80% от размера родительского текста).
                        // Оно будет идеально адаптироваться и на смартфоне, и на ПК.
                        fontSize="80%"
                        fontWeight={TEXT_FONT_WEIGHT}
                    >
                        mm
                    </tspan>
                </text>
            ))}
        </g>
    );
};

export default BendProfileRender;
