import React from "react";

const LINE_WIDTH = 1;

const BendProfileRender = ({
    data,
    strokeColor = "#424242",
    fillColor = "#f0f0f0",
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
            />

            <path
                d={`M ${data.sideBPath}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
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
                        />
                    )}
                </>
            )}

            {data.angles.map((ang, i) => (
                <g key={`ang-${i}`}>
                    <path
                        d={ang.path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="1"
                        strokeDasharray="2,2"
                    />

                    <text
                        x={ang.x}
                        y={ang.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        fill={strokeColor}
                        fontWeight="500"
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
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight={isGhost ? "normal" : "bold"}
                    fill={strokeColor}
                    transform={`rotate(${lbl.angle},${lbl.x},${lbl.y})`}
                >
                    {lbl.text}{" "}
                    <tspan
                        fontSize="9"
                        fontWeight="normal"
                    >
                        mm
                    </tspan>
                </text>
            ))}
        </g>
    );
};

export default BendProfileRender;
