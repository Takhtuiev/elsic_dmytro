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
            {/* Отрисовка заливки тела профиля металла */}
            {data.fillPoints && (
                <polygon
                    points={data.fillPoints}
                    fill={fillColor}
                />
            )}

            {/* Контур наружной стороны A */}
            <path
                d={`M ${data.sideAPath}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Контур внутренней стороны B */}
            <path
                d={`M ${data.sideBPath}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Торцевые заглушки (капы) на краях профиля */}
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

            {/* Отрисовка дуг и текстовых подписей углов сгиба */}
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
                        dominantBaseline="central"
                        fontSize={ang.fontSize || 11} // Динамический размер из математического ядра
                        fill={strokeColor}
                        fontWeight="500"
                    >
                        {ang.text}
                    </text>
                </g>
            ))}

            {/* Отрисовка текстовых размеров длин полок */}
            {data.labels.map((lbl, i) => (
                <text
                    key={`lbl-${i}`}
                    x={lbl.x}
                    y={lbl.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={lbl.fontSize || 11} // Динамический размер из математического ядра
                    fontWeight={isGhost ? "normal" : "bold"}
                    fill={strokeColor}
                    transform={`rotate(${lbl.angle},${lbl.x},${lbl.y})`}
                >
                    {lbl.text}{" "}
                    <tspan
                        fontSize={(lbl.fontSize || 11) - 2} // Пропорциональное уменьшение подписи "mm"
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
