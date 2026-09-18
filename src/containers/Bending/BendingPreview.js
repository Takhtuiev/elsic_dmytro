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


const TemperatureProfileChart = memo(({ data }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [size, setSize] = useState({ width: 300, height: 150 });

    const temps = data?.temperatureProfile?.temperaturesC;
    const cooldownTemps = data?.temperatureProfile?.cooldownProfileC;
    const dxMm = data?.temperatureProfile?.dxMm;
    const cooldownSec = data?.cooldownSec;
    const heatingSec = formatTime(data?.heatingTimeSeconds);
    const status = data?.status;

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(([entry]) => {
            const width = Math.max(1, entry.contentRect.width);
            const height = Math.max(1, entry.contentRect.height);
            setSize({ width, height });
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    if (!temps?.length || temps.length < 2 || typeof dxMm !== "number") return null;

    const baseWidth = 300, baseHeight = 150;
    const scale = Math.min(size.width / baseWidth, size.height / baseHeight);
    const width = size.width, height = size.height;
    const pad = { left: 36 * scale, right: 16 * scale, top: 27 * scale, bottom: 39 * scale };
    const len = temps.length, hasCooldown = cooldownTemps?.length === len;
    const wPlot = width - pad.left - pad.right, hPlot = height - pad.top - pad.bottom;
    const xMax = (len - 1) * dxMm, xDelta = xMax || 1;
    const xs = x => pad.left + (x / xDelta) * wPlot;

    let minIdx = 0, maxIdx = 0, minV = Infinity, maxV = -Infinity;
    let minCoolIdx = 0, maxCoolIdx = 0, minCoolV = Infinity, maxCoolV = -Infinity;

    for (let i = 0; i < len; i++) {
        if (temps[i] < minV) { minV = temps[i]; minIdx = i; }
        if (temps[i] > maxV) { maxV = temps[i]; maxIdx = i; }
        if (hasCooldown && cooldownTemps[i] < minCoolV) { minCoolV = cooldownTemps[i]; minCoolIdx = i; }
        if (hasCooldown && cooldownTemps[i] > maxCoolV) { maxCoolV = cooldownTemps[i]; maxCoolIdx = i; }
    }

    const allTemps = hasCooldown ? [...temps, ...cooldownTemps] : temps;
    const dataMin = Math.min(...allTemps), dataMax = Math.max(...allTemps);
    let tMin = Math.floor(dataMin / 10) * 10, tMax = Math.ceil(dataMax / 10) * 10;
    if (tMax === tMin) { tMin -= 10; tMax += 10; }

    const tDelta = tMax - tMin, tCenter = (tMax + tMin) / 2;
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

    const makeCurvePoints = values => {
        const points = [], steps = 10;
        for (let i = 0; i < values.length - 1; i++) {
            const t0 = values[i > 0 ? i - 1 : 0], t1 = values[i], t2 = values[i + 1], t3 = values[Math.min(i + 2, values.length - 1)];
            const x0 = xs((i > 0 ? i - 1 : 0) * dxMm), x1 = xs(i * dxMm), x2 = xs((i + 1) * dxMm), x3 = xs(Math.min(i + 2, values.length - 1) * dxMm);
            const y0 = ys(t0), y1 = ys(t1), y2 = ys(t2), y3 = ys(t3);
            const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6;
            const c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;

            for (let s = 0; s < steps; s++) {
                const u = s / steps, v = 1 - u;
                points.push({
                    x: v * v * v * x1 + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * x2,
                    y: v * v * v * y1 + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * y2
                });
            }
        }
        points.push({ x: xs((len - 1) * dxMm), y: ys(values[len - 1]) });
        return points;
    };

    const dPath = makePath(temps);
    const cooldownPath = hasCooldown ? makePath(cooldownTemps) : null;
    const mainCurvePoints = makeCurvePoints(temps);
    const cooldownCurvePoints = hasCooldown ? makeCurvePoints(cooldownTemps) : [];

    const chartColor = status?.type === "error"
        ? theme.palette.error.main
        : status?.type === "warning"
            ? theme.palette.warning.main
            : theme.palette.text.primary;

    const cooldownColor = theme.palette.text.secondary;
    const minColor = theme.palette.info.main;
    const maxColor = theme.palette.error.main;

    const makeLabels = (values, minI, minVal, maxI, maxVal, type) => {
        const color = type === "cooldown" ? cooldownColor : chartColor;
        const raw = [
            { id: maxI, val: maxVal, priority: 4 },
            { id: minI, val: minVal, priority: 4 },
            { id: 0, val: values[0], priority: 2 },
            { id: len - 1, val: values[len - 1], priority: 2 }
        ];
        const result = [], seen = new Set();

        for (const p of raw.sort((a, b) => b.priority - a.priority)) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                result.push({ ...p, type, color, x: xs(p.id * dxMm), y: ys(p.val) });
            }
        }
        return result;
    };

    const labels = [
        ...makeLabels(temps, minIdx, minV, maxIdx, maxV, "main"),
        ...(hasCooldown ? makeLabels(cooldownTemps, minCoolIdx, minCoolV, maxCoolIdx, maxCoolV, "cooldown") : [])
    ];

    const rectPointDistance = (px, py, r) => {
        const dx = Math.max(r.left - px, 0, px - r.right);
        const dy = Math.max(r.top - py, 0, py - r.bottom);
        return Math.hypot(dx, dy);
    };

    const curveHitsLabel = (points, rect, anchor) => {
        for (const point of points) {
            if (Math.hypot(point.x - anchor.x, point.y - anchor.y) < 5 * scale) continue;
            if (rectPointDistance(point.x, point.y, rect) < 2.5 * scale) return true;
        }
        return false;
    };

    const candidates = [
        { dx: 0, dy: -9 }, { dx: 0, dy: 14 },
        { dx: -8, dy: -9 }, { dx: 8, dy: -9 },
        { dx: -8, dy: 14 }, { dx: 8, dy: 14 },
        { dx: -12, dy: -9 }, { dx: 12, dy: -9 },
        { dx: -12, dy: 14 }, { dx: 12, dy: 14 },
        { dx: 0, dy: -16 }, { dx: 0, dy: 21 }
    ];

    const placed = [];

    for (const p of [...labels].sort((a, b) => b.priority - a.priority)) {
        const textWidth = `${p.val.toFixed(1)}°`.length * 5.2 * scale;
        const anchor = { x: p.x, y: p.y };
        let best = null;

        for (const c of candidates) {
            const dx = c.dx * scale, dy = c.dy * scale;
            const x = p.x + dx, y = p.y + dy;
            const textAnchor = p.id === 0 ? "start" : p.id === len - 1 ? "end" : "middle";
            const left = textAnchor === "start" ? x : textAnchor === "end" ? x - textWidth : x - textWidth / 2;
            const right = textAnchor === "start" ? x + textWidth : textAnchor === "end" ? x : x + textWidth / 2;
            const top = y - 8 * scale, bottom = y + 3 * scale;
            const rect = { left: left - 1.5 * scale, right: right + 1.5 * scale, top: top - 1.5 * scale, bottom: bottom + 1.5 * scale };
            let score = 0;

            if (left < pad.left) score += 10000 + (pad.left - left) * 100;
            if (right > width - pad.right) score += 10000 + (right - (width - pad.right)) * 100;
            if (top < pad.top) score += 10000 + (pad.top - top) * 100;
            if (bottom > height - pad.bottom) score += 10000 + (bottom - (height - pad.bottom)) * 100;

            for (const q of placed) {
                if (rect.left < q.right && rect.right > q.left && rect.top < q.bottom && rect.bottom > q.top) score += 100000;
                else {
                    const gapX = Math.max(q.left - rect.right, rect.left - q.right, 0);
                    const gapY = Math.max(q.top - rect.bottom, rect.top - q.bottom, 0);
                    if (gapX < 5 * scale && gapY < 5 * scale) score += 1000;
                }
            }

            if (curveHitsLabel(mainCurvePoints, rect, anchor) || (hasCooldown && curveHitsLabel(cooldownCurvePoints, rect, anchor))) score += 50000;
            score += Math.abs(dx) * 2 + Math.abs(dy) * .5;
            if (p.id === 0 && dx < 0) score += 500;
            if (p.id === len - 1 && dx > 0) score += 500;

            if (!best || score < best.score) best = { dx, dy, score, left, right, top, bottom };
        }

        placed.push({ ...p, ...best });
    }

    return (
        <Box ref={containerRef} sx={{ width: 300, maxWidth: "100%", height: 150, flex: "0 1 300px", flexShrink: 0, display: "flex", alignItems: "center", border: "1px solid", borderColor: status?.type === "ok" ? theme.palette.divider : chartColor, borderRadius: "6px", p: .5, boxSizing: "border-box", fontFamily: '"Roboto Mono","SF Mono",monospace', backgroundColor: theme.palette.background.paper, overflow: "hidden" }}>
            <svg width={size.width} height={size.height} style={{ display: "block", overflow: "visible" }} shapeRendering="geometricPrecision">
                {[tMax, tCenter].map((_, i) => (
                    <line key={i} x1={pad.left} y1={pad.top + i * hPlot / 2} x2={width - pad.right} y2={pad.top + i * hPlot / 2} stroke={theme.palette.divider} strokeWidth={scale} strokeDasharray={`${2 * scale} ${2 * scale}`} />
                ))}

                <line x1={xCenter} y1={pad.top} x2={xCenter} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={scale} strokeDasharray={`${2 * scale} ${2 * scale}`} />
                <line x1={width - pad.right} y1={pad.top} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={scale} strokeDasharray={`${2 * scale} ${2 * scale}`} />
                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={scale} opacity=".55" />
                <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={scale} opacity=".55" />

                {hasCooldown && (
                    <path d={cooldownPath} fill="none" stroke={cooldownColor} strokeWidth={scale} strokeDasharray={`${3 * scale} ${scale}`} opacity=".5" strokeLinecap="round" strokeLinejoin="round" />
                )}

                <path d={dPath} fill="none" stroke={chartColor} strokeWidth={2 * scale} strokeLinecap="round" strokeLinejoin="round" />

                {placed.map(p => {
                    const isMin = p.id === (p.type === "cooldown" ? minCoolIdx : minIdx);
                    const isMax = p.id === (p.type === "cooldown" ? maxCoolIdx : maxIdx);
                    const pointColor = isMin ? minColor : isMax ? maxColor : p.color;

                    return (
                        <g key={`${p.type}-${p.id}`}>
                            <circle cx={p.x} cy={p.y} r={(p.type === "cooldown" ? 2.5 : 3) * scale} fill={pointColor} stroke={theme.palette.background.paper} strokeWidth={scale} opacity={p.type === "cooldown" ? .5 : 1} />
                            <text x={p.x} y={p.y + p.dy} textAnchor={p.id === 0 ? "start" : p.id === len - 1 ? "end" : "middle"} fontSize={(p.type === "cooldown" ? 8.5 : 9) * scale} fontWeight="bold" fill={p.color}>{p.val.toFixed(1)}°</text>
                        </g>
                    );
                })}

                <text x={xCenter} y={14 * scale} textAnchor="middle" fontSize={9.5 * scale} fontWeight="bold" fill={chartColor}>Heating: {heatingSec} (ΔT = {(maxV - minV).toFixed(1)}°C)</text>
                <text x={pad.left - 5 * scale} y={pad.top + 3 * scale} textAnchor="end" fontSize={8.5 * scale} fill={theme.palette.text.secondary}>{tMax}°</text>
                <text x={pad.left - 5 * scale} y={height - pad.bottom + 3 * scale} textAnchor="end" fontSize={8.5 * scale} fill={theme.palette.text.secondary}>{tMin}°</text>
                <text x={pad.left} y={height - 22 * scale} textAnchor="middle" fontSize={8.5 * scale} fill={theme.palette.text.secondary}>0 mm</text>
                <text x={width - pad.right} y={height - 22 * scale} textAnchor="end" fontSize={8.5 * scale} fill={theme.palette.text.secondary}>{xMax.toFixed(0)} mm</text>

                {typeof cooldownSec === "number" && (
                    <text x={xCenter} y={height - 6 * scale} textAnchor="middle" fontSize={8.5 * scale} fontWeight="500" fill={theme.palette.text.secondary}>
                        Cooling: {cooldownSec}s{hasCooldown && ` (ΔT = ${(maxCoolV - minCoolV).toFixed(1)}°C)`}
                    </text>
                )}
            </svg>
        </Box>
    );
});

const Parameters=({profile,part,machineParams,data})=>{
    const material=MATERIALS[profile?.materialKey];
    const blankLength=Number(part?.blankLength),width=Number(profile?.width),thickness=Number(profile?.thickness),density=Number(material?.density);
    const mass=Number.isFinite(blankLength)&&Number.isFinite(width)&&Number.isFinite(thickness)&&Number.isFinite(density)?blankLength*width*thickness*density/1e9:null;
    const status=data?.status;
    const statusColor=status?.type==="error"?"error":status?.type==="warning"?"warning":"text.secondary";

    return(
        <Box className="bend-preview-parameters" sx={{p:1,flexShrink:0,display:"flex",flexWrap:"wrap",alignItems:"center",gap:2}}>
            <Box sx={{flex:"1 1 280px",minWidth:280}}>
                <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>Blank length: <strong>{Number.isFinite(blankLength)?blankLength.toFixed(2):"—"} mm</strong></Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>Width: <strong>{Number.isFinite(width)?width:"—"} mm</strong></Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>Mass: <strong>{mass!==null?mass.toFixed(3):"—"} kg</strong></Typography>
                </Box>

                {machineParams&&(
                    <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                        <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>Stop pos: <strong>{machineParams.stopPosition} mm</strong></Typography>
                        <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>Bar low: <strong>{machineParams.barLowering} mm</strong></Typography>
                        <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>Angle: <strong>{machineParams.bendAngle}°</strong></Typography>
                    </Box>
                )}

                <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Heat temp: <strong>top: {data?.heaterTemperaturesC?.top??"—"}°C, bottom: {data?.heaterTemperaturesC?.bottom??"—"}°C</strong>
                    </Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Heating time: <strong>{formatTime(data?.heatingTimeSeconds)}</strong>
                    </Typography>
                </Box>

                {status?.type!=="ok"&&status?.message&&(
                    <Typography variant="body2" color={statusColor} fontSize={PARAMETER_TEXT_SIZE} fontWeight={500} sx={{mt:.5}}>
                        {status.message}
                    </Typography>
                )}
            </Box>

            <Box sx={{flex:"0 0 280px",mx:"auto"}}>
                <TemperatureProfileChart data={data}/>
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

    const dataSimulate = useMemo(()=>{
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
                data={dataSimulate}
            />
        </Box>
    );
};

export default BendingPreview;
