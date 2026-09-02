import React from "react";

// =========================================================
// НАСТРОЙКИ ТОЛЩИНЫ КОНТУРНЫХ ЛИНИЙ ЧЕРТЕЖА (КОНСТАНТА)
// =========================================================
const LINE_WIDTH = 1; // Универсальная толщина линий профиля в пикселях

const BendProfileRender = ({
                               data,
                               strokeColor = "#424242",
                               fillColor = "#f0f0f0",
                               isGhost = false
                           }) => {
    if (!data) return null;

    return (
        <g style={{ opacity: isGhost ? 0.6 : 1 }}>

            {/* ТЕЛО МЕТАЛЛА: Заливка пространства между стенками профиля */}
            {data.fillPoints && (
                <polygon
                    points={data.fillPoints}
                    fill={fillColor}
                />
            )}

            {/* Контурные грани металла */}
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

            {/* Технологические торцевые заглушки на краях исходной заготовки */}
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

            {/* Пунктирные дуги и значения углов */}
            {data.angles.map((ang, i) => {
                const isHighlight = ang.isFirst && !isGhost;
                const currentStroke = isHighlight
                    ? "#2e7d32"
                    : strokeColor;

                const textStrokeWidth =
                    isHighlight ? "2.5" : "1";

                const dashArray =
                    isHighlight ? "none" : "2,2";

                return (
                    <g key={`ang-${i}`}>
                        <path
                            d={ang.path}
                            fill="none"
                            stroke={currentStroke}
                            strokeWidth={textStrokeWidth}
                            strokeDasharray={dashArray}
                        />

                        <text
                            x={ang.x}
                            y={ang.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={isHighlight ? "11" : "10"}
                            fill={currentStroke}
                            fontWeight={isHighlight ? "bold" : "500"}
                        >
                            {ang.text}
                        </text>

                        {isHighlight && (
                            <g
                                transform={`translate(${ang.x + ang.bx * 14}, ${ang.y + ang.by * 14})`}
                            >
                                <circle
                                    r="6"
                                    fill="#2e7d32"
                                />

                                <text
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize="8"
                                    fill="#fff"
                                    fontWeight="bold"
                                >
                                    1
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}

            {/* Размерные надписи полок */}
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
                    {lbl.text}
                    {" "}
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