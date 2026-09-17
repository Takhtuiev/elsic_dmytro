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
    const cooldownTemps = data?.cooldownProfileC;
    const dxMm = data?.dxMm;
    const cooldownSec = data?.cooldownSec;

    if (!temps?.length || temps.length < 2 || typeof dxMm !== "number") return null;

    const len = temps.length;
    const hasCooldown = cooldownTemps?.length === len;
    const width = 300, height = 150;
    const pad = { left: 36, right: 16, top: 27, bottom: 39 };
    const wPlot = width - pad.left - pad.right;
    const hPlot = height - pad.top - pad.bottom;

    const xMin = 0;
    const xMax = (len - 1) * dxMm;
    const xDelta = xMax || 1;
    const xs = x => pad.left + (x / xDelta) * wPlot;

    let minIdx = 0, maxIdx = 0, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < len; i++) {
        if (temps[i] < minV) { minV = temps[i]; minIdx = i; }
        if (temps[i] > maxV) { maxV = temps[i]; maxIdx = i; }
    }

    let cooldownDelta = 0;
    if (hasCooldown) {
        const cMin = Math.min(...cooldownTemps);
        const cMax = Math.max(...cooldownTemps);
        cooldownDelta = cMax - cMin;
    }

    const allTemps = hasCooldown ? [...temps, ...cooldownTemps] : [...temps];
    const dataMin = Math.min(...allTemps);
    const dataMax = Math.max(...allTemps);
    let tMin = Math.floor(dataMin / 10) * 10;
    let tMax = Math.ceil(dataMax / 10) * 10;
    if (tMax === tMin) { tMin -= 10; tMax += 10; }

    const tDelta = tMax - tMin;
    const tCenter = (tMax + tMin) / 2;
    const ys = t => pad.top + ((tMax - t) / tDelta) * hPlot;
    const xCenter = xs(xMax / 2);

    const makePath = values => {
        let d = `M ${xs(0)} ${ys(values[0])}`;
        for (let i = 0; i < values.length - 1; i++) {
            const t0 = values[i > 0 ? i - 1 : 0], t1 = values[i], t2 = values[i + 1], t3 = values[Math.min(i + 2, values.length - 1)];
            const x0 = xs((i > 0 ? i - 1 : 0) * dxMm), x1 = xs(i * dxMm), x2 = xs((i + 1) * dxMm), x3 = xs(Math.min(i + 2, values.length - 1) * dxMm);
            const y0 = ys(t0), y1 = ys(t1), y2 = ys(t2), y3 = ys(t3);
            d += ` C ${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
        }
        return d;
    };

    const dPath = makePath(temps);
    const cooldownPath = hasCooldown ? makePath(cooldownTemps) : null;
    const chartColor = status?.type === "error" ? theme.palette.error.main : status?.type === "warning" ? theme.palette.warning.main : theme.palette.text.primary;

    const rawPoints = [
        { id: maxIdx, val: maxV, isExtremum: true, color: theme.palette.error.main, forceDy: -8, priority: 1 },
        { id: minIdx, val: minV, isExtremum: true, color: theme.palette.primary.main, forceDy: 14, priority: 2 },
        { id: 0, val: temps[0], isExtremum: false, color: theme.palette.text.secondary, forceDy: -8, priority: 3 },
        { id: len - 1, val: temps[len - 1], isExtremum: false, color: theme.palette.text.secondary, forceDy: -8, priority: 4 }
    ];

    const uniquePoints = [];
    const seenIds = new Set();

    for (const p of [...rawPoints].sort((a, b) => a.priority - b.priority)) {
        if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            uniquePoints.push({
                id: p.id,
                x: xs(p.id * dxMm),
                y: ys(p.val),
                val: p.val,
                color: p.color,
                isBold: p.isExtremum,
                dy: p.forceDy,
                anchor: p.id === 0 ? "start" : p.id === len - 1 ? "end" : "middle",
                dx: p.id === 0 ? 6 : p.id === len - 1 ? -6 : 0
            });
        }
    }

    uniquePoints.sort((a, b) => a.x - b.x);

    for (let i = 0; i < uniquePoints.length - 1; i++) {
        const a = uniquePoints[i], b = uniquePoints[i + 1];
        if (Math.abs(a.x - b.x) < 34 && Math.abs(a.y - b.y) < 18 && a.dy === b.dy) {
            a.dy = -9;
            b.dy = 14;
            if (a.anchor === "middle") a.dx = -5;
            if (b.anchor === "middle") b.dx = 5;
        }
    }

    return (
        <Box sx={{ width: 300, maxWidth: "100%", height, flex: "0 1 300px", flexShrink: 0, display: "flex", alignItems: "center", border: "1px solid", borderColor: status?.type === "ok" ? theme.palette.divider : chartColor, borderRadius: "6px", p: .5, boxSizing: "border-box", fontFamily: '"Roboto Mono","SF Mono",monospace', backgroundColor: theme.palette.background.paper }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }} shapeRendering="geometricPrecision">
                {[tMax, tCenter].map((_, i) => <line key={i} x1={pad.left} y1={pad.top + i * hPlot / 2} x2={width - pad.right} y2={pad.top + i * hPlot / 2} stroke={theme.palette.divider} strokeWidth="1" strokeDasharray="2 2" shapeRendering="crispEdges" />)}
                <line x1={xCenter} y1={pad.top} x2={xCenter} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth="1" strokeDasharray="2 2" shapeRendering="crispEdges" />
                <line x1={width - pad.right} y1={pad.top} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth="1" strokeDasharray="2 2" shapeRendering="crispEdges" />
                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth="1,7" opacity=".45" shapeRendering="crispEdges" />
                <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth="1,7" opacity=".45" shapeRendering="crispEdges" />

                {hasCooldown && <path d={cooldownPath} fill="none" stroke={theme.palette.text.secondary} strokeWidth="1" strokeDasharray="3 1" opacity=".5" strokeLinecap="round" strokeLinejoin="round" />}
                <path d={dPath} fill="none" stroke={chartColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {hasCooldown && [0, len - 1].map(i => <circle key={`c-pt-${i}`} cx={xs(i * dxMm)} cy={ys(cooldownTemps[i])} r="2" fill={theme.palette.text.secondary} opacity=".6" />)}

                {uniquePoints.map(p => (
                    <g key={`kp-${p.id}`}>
                        <circle cx={p.x} cy={p.y} r="3" fill={p.color} stroke={theme.palette.background.paper} strokeWidth="1" />
                        <text x={p.x} y={p.y + p.dy} dx={p.dx} textAnchor={p.anchor} fontSize="9" fontWeight={p.isBold ? "bold" : "normal"} fill={theme.palette.text.primary}>{p.val.toFixed(1)}°</text>
                    </g>
                ))}

                {hasCooldown && [0, len - 1].map(i => {
                    const isNearMain = Math.abs(cooldownTemps[i] - temps[i]) < 8;
                    const coolingDy = isNearMain ? 14 : i === 0 ? 12 : -6;
                    return <text key={`c-txt-${i}`} x={xs(i * dxMm)} y={ys(cooldownTemps[i]) + coolingDy} dx={i === 0 ? 6 : -6} textAnchor={i === 0 ? "start" : "end"} fontSize="8.5" fontWeight="bold" fill={theme.palette.text.primary}>{cooldownTemps[i].toFixed(1)}°</text>;
                })}

                <text x={xCenter} y={14} textAnchor="middle" fontSize="9.5" fontWeight="bold" fill={chartColor}>ΔT = {(maxV - minV).toFixed(1)}°C</text>
                <text x={pad.left - 5} y={pad.top + 3} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{tMax}°</text>
                <text x={pad.left - 5} y={height - pad.bottom + 3} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{tMin}°</text>
                <text x={pad.left} y={height - 22} textAnchor="middle" fontSize="8.5" fill={theme.palette.text.secondary}>{xMin} mm</text>
                <text x={width - pad.right} y={height - 22} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{xMax.toFixed(0)} mm</text>

                {typeof cooldownSec === "number" && (
                    <text x={xCenter} y={height - 6} textAnchor="middle" fontSize="8.5" fontWeight="500" fill={theme.palette.text.secondary}>
                        Cooling: {cooldownSec}s{hasCooldown && ` (ΔT = ${cooldownDelta.toFixed(1)}°C)`}
                    </text>
                )}
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
                                <strong>
                                    top: {heatingParams?.temperatureProfile.heaterTemperaturesC.top}°C,
                                    bottom: {heatingParams?.temperatureProfile.heaterTemperaturesC.bottom}°C
                                </strong>
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

            maxTimeSeconds: 1200,
            cooldownTimeSeconds: 10
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
