import React, {memo, useEffect, useMemo, useRef, useState} from "react";
import {Box,Typography,useTheme} from "@mui/material";
import {alpha} from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";
import {MAX_BEND_ANGLE,MIN_BEND_ANGLE} from "./svgConstants";
import {MACHINES,MATERIALS} from "./parameters";
import {simulate1DHeating} from "./pvc-1d-transient-heating";


const PARAMETER_TEXT_COLOR="text.primary";
const PARAMETER_TEXT_SIZE="0.8rem";


const formatTime=seconds=>{
    if(!seconds||seconds<0) return "0m 00s";

    const totalSeconds=Math.round(seconds);
    const minutes=Math.floor(totalSeconds/60);
    const secs=totalSeconds%60;

    return `${minutes}m ${String(secs).padStart(2,"0")}s`;
};


const PartHeader=({profile})=>(
    <Box
        className="bend-preview-header"
        sx={{
            px:1,
            py:.75,
            display:"flex",
            flexWrap:"wrap",
            gap:2,
            alignItems:"center",
            borderTop:"1px solid",
            borderBottom:"1px solid",
            borderColor:"divider",
            flexShrink:0
        }}
    >
        <Typography variant="body2" fontWeight={600}>
            Part: <strong>{profile?.name||"—"}</strong>
        </Typography>

        <Typography variant="body2">
            Material: <strong>{MATERIALS[profile?.materialKey]?.name||"—"}</strong>
        </Typography>

        <Typography variant="body2">
            Thickness: <strong>{profile?.thickness??"—"} mm</strong>
        </Typography>
    </Box>
);


const TemperatureProfileChart = memo(({ temperatureProfile: data, status }) => {
    const theme = useTheme();

    const temps = data?.temperaturesC;
    const dxMm = data?.dxMm;
    if (!temps || !temps.length || temps.length < 2 || typeof dxMm !== 'number') return null;

    const len = temps.length;
    const width = 280, height = 120;
    const pad = { left: 42, right: 15, top: 20, bottom: 25 };
    const wPlot = width - pad.left - pad.right;
    const hPlot = height - pad.top - pad.bottom;

    const xMin = 0;
    const xMax = (len - 1) * dxMm;
    const xDelta = xMax - xMin || 1;

    let minIdx = 0, maxIdx = 0, minV = Infinity, maxV = -Infinity;

    // Поиск экстремумов
    for (let i = 0; i < len; i++) {
        const t = Math.round(temps[i] * 10) / 10;
        if (t < minV) { minV = t; minIdx = i; }
        if (t > maxV) { maxV = t; maxIdx = i; }
    }

    // Вычисляем физическую разницу между макс и мин температурами
    const deltaT = maxV - minV;

    const leftT = Math.round(temps[0] * 10) / 10;
    const rightT = Math.round(temps[len - 1] * 10) / 10;

    if (leftT === rightT) {
        if (Math.abs(temps[0] - temps[len - 1]) > 1e-9)
            maxIdx = temps[0] > temps[len - 1] ? 0 : len - 1;
    } else if (leftT > rightT) {
        maxIdx = 0;
    } else {
        maxIdx = len - 1;
    }

    const tMin = Math.floor(minV / 10) * 10;
    const tMax = Math.ceil((maxV + 5) / 10) * 10;
    const tDelta = tMax - tMin || 1;
    const tCenter = (tMax + tMin) / 2;

    const xs = x => pad.left + ((x - xMin) / xDelta) * wPlot;
    const ys = t => pad.top + ((tMax - t) / tDelta) * hPlot;
    const xCenter = xs((xMin + xMax) / 2);

    let dPath = `M ${xs(xMin)} ${ys(temps[0])}`;

    for (let i = 0; i < len - 1; i++) {
        const t0 = temps[i ? i - 1 : 0];
        const t1 = temps[i];
        const t2 = temps[i + 1];
        const t3 = temps[i + 2] !== undefined ? temps[i + 2] : t2;

        const x0 = xs((i ? i - 1 : 0) * dxMm), x1 = xs(i * dxMm), x2 = xs((i + 1) * dxMm), x3 = xs((i + 2 >= len ? len - 1 : i + 2) * dxMm);
        const y0 = ys(t0), y1 = ys(t1), y2 = ys(t2), y3 = ys(t3);

        dPath += ` C ${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
    }

    const dArea = `${dPath} L ${xs(xMax)} ${height - pad.bottom} L ${xs(xMin)} ${height - pad.bottom} Z`;

    const makePoint = (idx, val) => ({
        id: idx,
        x: xs(idx * dxMm),
        y: ys(temps[idx]),
        val,
        anchor: idx === 0 ? "start" : idx === len - 1 ? "end" : "middle",
        dx: idx === 0 ? 4 : idx === len - 1 ? -4 : 0
    });

    const allPoints = [
        { ...makePoint(maxIdx, maxV), color: theme.palette.error.main, defaultDy: -6 },
        { ...makePoint(minIdx, minV), color: theme.palette.primary.main, defaultDy: 14 },
        { ...makePoint(0, temps[0]), color: theme.palette.text.primary, defaultDy: -6 },
        { ...makePoint(len - 1, temps[len - 1]), color: theme.palette.text.primary, defaultDy: -6 }
    ];

    const seenIds = new Set();
    const uniquePoints = [];

    for (const p of allPoints) {
        if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            let dy = p.defaultDy;
            if (p.id === minIdx) dy = 14;
            uniquePoints.push({ ...p, dy });
        }
    }

    const chartColor =
        status?.type === "error"
            ? theme.palette.error.main
            : status?.type === "warning"
                ? theme.palette.warning.main
                : theme.palette.text.primary;

    return (
        <Box
            sx={{
                width: 280,
                maxWidth: "100%",
                height,
                flex: "0 1 280px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                border: "1px solid",
                borderColor: status?.type === "ok" ? theme.palette.divider : chartColor,
                borderRadius: "6px",
                p: .5,
                boxSizing: "border-box",
                fontFamily: '"Roboto Mono","SF Mono",monospace'
            }}
        >
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={{ overflow: "visible" }}
                shapeRendering="geometricPrecision"
            >
                {/* Сетка температур */}
                {[tMax, tCenter, tMin].map((_, i) => (
                    <line
                        key={i}
                        x1={pad.left}
                        y1={pad.top + (i * hPlot) / 2}
                        x2={width - pad.right}
                        y2={pad.top + (i * hPlot) / 2}
                        stroke={theme.palette.divider}
                        strokeDasharray="2 2"
                        shapeRendering="crispEdges"
                    />
                ))}

                {/* Ось центра листа */}
                <line
                    x1={xCenter}
                    y1={pad.top}
                    x2={xCenter}
                    y2={height - pad.bottom}
                    stroke={theme.palette.divider}
                    strokeDasharray="2 2"
                    shapeRendering="crispEdges"
                />

                {/* Границы осей */}
                <line
                    x1={pad.left}
                    y1={pad.top}
                    x2={pad.left}
                    y2={height - pad.bottom}
                    stroke={theme.palette.text.secondary}
                    opacity=".7"
                    shapeRendering="crispEdges"
                />
                <line
                    x1={pad.left}
                    y1={height - pad.bottom}
                    x2={width - pad.right}
                    y2={height - pad.bottom}
                    stroke={theme.palette.text.secondary}
                    opacity=".7"
                    shapeRendering="crispEdges"
                />

                {/* Площадь под графиком и линия */}
                <path d={dArea} fill={chartColor} fillOpacity=".05" />
                <path d={dPath} fill="none" stroke={chartColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Точки перепадов и температур узлов */}
                {uniquePoints.map((p, i) => (
                    <g key={i}>
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill={p.color}
                            stroke={theme.palette.background.paper}
                            strokeWidth="1"
                        />
                        <text
                            x={p.x}
                            y={p.y + p.dy}
                            dx={p.dx}
                            textAnchor={p.anchor}
                            fontSize="10"
                            fontWeight={p.id === minIdx || p.id === maxIdx ? "bold" : "normal"}
                            fill={theme.palette.text.primary}
                        >
                            {p.val.toFixed(1)}°C
                        </text>
                    </g>
                ))}

                {/* Текстовая плашка вывода дельты температур*/}
                <text
                    x={xCenter}
                    y={pad.top - 7}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill={chartColor}
                >
                    ΔT = {deltaT.toFixed(1)}°C
                </text>


                {/* Подписи шкал */}
                <text x={pad.left - 6} y={pad.top + 3} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{tMax}°</text>
                <text x={pad.left - 6} y={height - pad.bottom + 3} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{tMin}°</text>
                <text x={pad.left} y={height - 9} textAnchor="middle" fontSize="8.5" fill={theme.palette.text.secondary}>{xMin.toFixed(1)} mm</text>
                <text x={width - pad.right} y={height - 9} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{xMax.toFixed(1)} mm</text>
            </svg>
        </Box>
    );
});


const Parameters=({
                      profile,
                      part,
                      machineParams,
                      heatingParams
                  })=>{
    const material=MATERIALS[profile?.materialKey];

    const blankLength=Number(part?.blankLength);
    const width=Number(profile?.width);
    const thickness=Number(profile?.thickness);
    const density=Number(material?.density);

    const mass=
        Number.isFinite(blankLength)&&
        Number.isFinite(width)&&
        Number.isFinite(thickness)&&
        Number.isFinite(density)
            ?blankLength*width*thickness*density/1e9
            :null;

    const status=heatingParams?.status;

    const statusColor=
        status?.type==="error"
            ?"error"
            :status?.type==="warning"
                ?"warning"
                :"text.secondary";

    return(
        <Box
            className="bend-preview-parameters"
            sx={{
                p:1,
                flexShrink:0,
                display:"flex",
                flexWrap:"wrap",
                alignItems:"center",
                gap:2
            }}
        >
            <Box
                sx={{
                    flex:"1 1 280px",
                    minWidth:280
                }}
            >
                <Box
                    sx={{
                        display:"flex",
                        flexWrap:"wrap",
                        gap:2
                    }}
                >
                    <Typography
                        variant="body2"
                        color={PARAMETER_TEXT_COLOR}
                        fontSize={PARAMETER_TEXT_SIZE}
                    >
                        Blank length:{" "}
                        <strong>
                            {Number.isFinite(blankLength)?blankLength.toFixed(2):"—"} mm
                        </strong>
                    </Typography>

                    <Typography
                        variant="body2"
                        color={PARAMETER_TEXT_COLOR}
                        fontSize={PARAMETER_TEXT_SIZE}
                    >
                        Width:{" "}
                        <strong>
                            {Number.isFinite(width)?width:"—"} mm
                        </strong>
                    </Typography>

                    <Typography
                        variant="body2"
                        color={PARAMETER_TEXT_COLOR}
                        fontSize={PARAMETER_TEXT_SIZE}
                    >
                        Mass:{" "}
                        <strong>
                            {mass!==null?mass.toFixed(3):"—"} kg
                        </strong>
                    </Typography>
                </Box>

                {machineParams&&(
                    <>
                        <Box
                            sx={{
                                display:"flex",
                                flexWrap:"wrap",
                                gap:2
                            }}
                        >
                            <Typography
                                variant="body2"
                                color={PARAMETER_TEXT_COLOR}
                                fontSize={PARAMETER_TEXT_SIZE}
                            >
                                Stop pos:{" "}
                                <strong>
                                    {machineParams.stopPosition} mm
                                </strong>
                            </Typography>

                            <Typography
                                variant="body2"
                                color={PARAMETER_TEXT_COLOR}
                                fontSize={PARAMETER_TEXT_SIZE}
                            >
                                Bar low:{" "}
                                <strong>
                                    {machineParams.barLowering} mm
                                </strong>
                            </Typography>

                            <Typography
                                variant="body2"
                                color={PARAMETER_TEXT_COLOR}
                                fontSize={PARAMETER_TEXT_SIZE}
                            >
                                Angle:{" "}
                                <strong>
                                    {machineParams.bendAngle}°
                                </strong>
                            </Typography>
                        </Box>

                    </>
                )}


                <Box
                            sx={{
                                display:"flex",
                                flexWrap:"wrap",
                                gap:2
                            }}
                        >
                            <Typography
                                variant="body2"
                                color={PARAMETER_TEXT_COLOR}
                                fontSize={PARAMETER_TEXT_SIZE}
                            >
                                Heat temp:{" "}
                                <strong>{"200"} °C</strong>
                            </Typography>

                            <Typography
                                variant="body2"
                                color={PARAMETER_TEXT_COLOR}
                                fontSize={PARAMETER_TEXT_SIZE}
                            >
                                Heating time:{" "}
                                <strong>
                                    {formatTime(heatingParams?.heatingTimeSeconds)}
                                </strong>
                            </Typography>
                        </Box>

                        {status?.type !== "ok" && status?.message && (
                            <Typography
                                variant="body2"
                                color={statusColor}
                                fontSize={PARAMETER_TEXT_SIZE}
                                fontWeight={500}
                                sx={{mt:.5}}
                            >
                                {status.message}
                            </Typography>
                        )}
            </Box>

            <Box sx={{flex:"0 0 280px",mx:"auto"}}>
                <TemperatureProfileChart
                    temperatureProfile={heatingParams?.temperatureProfile}
                    status={heatingParams?.status}
                />
            </Box>
        </Box>
    );
};

const BendingPreview=({
    profile,
    blankLength,
    machineParams,
    rotationPreview
})=>{
    const theme=useTheme();
    const containerRef=useRef(null);

    const view=profile?.view;

    const [containerSize,setContainerSize]=useState({
        width:800,
        height:500
    });

    useEffect(()=>{
        if(!containerRef.current) return;

        const observer=new ResizeObserver(
            ([{contentRect}])=>{
                const {width,height}=contentRect;

                if(width&&height)
                    setContainerSize({
                        width,
                        height
                    });
            }
        );

        observer.observe(containerRef.current);

        return()=>observer.disconnect();
    },[]);

    const MACHINA=MACHINES.MACHINE_LINE_1;
    const MATERIAL=MATERIALS[profile.materialKey];

    const heatingParams=useMemo(()=>{
        if(
            !profile?.thickness||
            !profile?.materialKey
        ){
            return null;
        }

        return simulate1DHeating({
            thicknessMm: profile.thickness,
            material: MATERIAL,
            machine: MACHINA,

            thermalConditions: {
                initialTemperatureC: 20,
                ambientTemperatureC: 20,
                ambientRadiationTemperatureC: 20
            },

            // 1. Заменяем heaterMode на sides
            sides: "both",

            // 2. Обязательно передаем целевые температуры, чтобы симулятор знал, когда ПВХ готов
            target: {
                minCenterC: MATERIAL?.defaultTCenter ?? 115, // температура в центре для гибки
                maxSurfaceC: MATERIAL?.defaultTSurf ?? 150   // максимальная температура поверхности
            },

            maxTimeSeconds: 1200
        });

    },[
        profile.thickness,
        profile?.materialKey,
        MATERIAL,
        MACHINA
    ]);

    //console.log(heatingParams)

    const invalidAngleIndex=
        profile?.bends?.findIndex(({angle})=>{
            angle=Number(angle);

            return(
                !Number.isFinite(angle)||
                angle<MIN_BEND_ANGLE||
                angle>MAX_BEND_ANGLE
            );
        })??-1;

    const invalidShelfIndex=
        profile?.shelves?.findIndex(({length})=>{
            length=Number(length);
            const thickness=Number(profile?.thickness);

            return(
                !Number.isFinite(length)||
                !Number.isFinite(thickness)||
                length<thickness
            );
        })??-1;

    const validationError=
        invalidAngleIndex>=0
            ?`Angle ${invalidAngleIndex+1}: ${profile.bends[invalidAngleIndex].angle}° — allowed range is ${MIN_BEND_ANGLE}°–${MAX_BEND_ANGLE}°`
            :invalidShelfIndex>=0
                ?`Leg ${invalidShelfIndex+1}: ${profile.shelves[invalidShelfIndex].length} mm — must be at least ${profile.thickness} mm`
                :null;

    const colors=useMemo(()=>({
        active:{
            line:theme.palette.text.primary,
            fill:alpha(theme.palette.text.primary,.1),
            annotation:alpha(theme.palette.text.primary,.75)
        },
        ghost:{
            line:theme.palette.text.disabled,
            fill:alpha(theme.palette.text.disabled,.02),
            annotation:alpha(theme.palette.text.disabled,.4)
        },
        blue:{
            line:theme.palette.primary.main,
            fill:alpha(theme.palette.primary.main,.08),
            annotation:theme.palette.primary.main
        }
    }),[theme]);

    const svgData=useMemo(()=>{
        if(!profile||validationError) return null;

        return prepareSvgLayers(
            profile,
            view,
            containerSize
        );
    },[
        profile,
        view,
        containerSize,
        validationError
    ]);

    const committedRotation=
        Number(view?.rotation??0);

    const visualRotation=
        Number(
            rotationPreview??committedRotation
        )-
        committedRotation;

    const viewBoxValues=svgData?.viewBox
        ?.split(/\s+/)
        .map(Number);

    const rotationCenter=
        viewBoxValues?.length===4
            ?{
                x:viewBoxValues[0]+viewBoxValues[2]/2,
                y:viewBoxValues[1]+viewBoxValues[3]/2
            }
            :{
                x:0,
                y:0
            };

    return(
        <Box
            sx={{
                width:"100%",
                height:"100%",
                display:"flex",
                flexDirection:"column",
                minHeight:0
            }}
        >
            <PartHeader profile={profile}/>

            <Box
                ref={containerRef}
                className="bend-preview-drawing"
                sx={{
                    flex:1,
                    minHeight:0,
                    width:"100%",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    overflow:"hidden"
                }}
            >
                {validationError?(
                    <Box
                        sx={{
                            width:"100%",
                            height:"100%",
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"center",
                            textAlign:"center"
                        }}
                    >
                        <Typography
                            variant="body2"
                            fontWeight={500}
                            color="warning.main"
                        >
                            {validationError}
                        </Typography>
                    </Box>
                ):svgData&&(
                    <svg
                        className="bend-preview-svg"
                        viewBox={svgData.viewBox}
                        width="100%"
                        height="100%"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        <g
                            transform={
                                visualRotation
                                    ?`rotate(${visualRotation},${rotationCenter.x},${rotationCenter.y})`
                                    :undefined
                            }
                        >
                            <BendProfileRender
                                data={svgData.activeData}
                                strokeColor={colors.active.line}
                                fillColor={colors.active.fill}
                                annotationColor={colors.active.annotation}
                            />

                            <BendProfileRender
                                data={svgData.ghostData}
                                strokeColor={colors.ghost.line}
                                fillColor={colors.ghost.fill}
                                annotationColor={colors.ghost.annotation}
                                isGhost
                            />

                            <BendProfileRender
                                data={svgData.blueData}
                                strokeColor={colors.blue.line}
                                fillColor={colors.blue.fill}
                                annotationColor={colors.blue.annotation}
                            />
                        </g>
                    </svg>
                )}
            </Box>

            <Parameters
                profile={profile}
                part={{blankLength}}
                machineParams={machineParams}
                heatingParams={heatingParams}
            />
        </Box>
    );
};

export default BendingPreview;
