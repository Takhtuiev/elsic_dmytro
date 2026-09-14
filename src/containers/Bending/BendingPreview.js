import React, {memo, useEffect, useMemo, useRef, useState} from "react";
import {Box,Typography,useTheme} from "@mui/material";
import {alpha} from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";
import {MAX_BEND_ANGLE,MIN_BEND_ANGLE} from "./svgConstants";
import {MACHINES,MATERIALS} from "./parameters";
import {calculateBendingHeatingTime} from "./pvc-1d-transient-heating";


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


const TemperatureProfileChart=memo(({temperatureProfile:data,status})=>{
    const theme=useTheme();
    if(!data?.length||data.length<2) return null;

    const width=280,height=120;
    const pad={left:42,right:15,top:20,bottom:25};
    const wPlot=width-pad.left-pad.right;
    const hPlot=height-pad.top-pad.bottom;

    const xMin=data[0].xMm;
    const xMax=data[data.length-1].xMm;
    const xDelta=xMax-xMin||1;

    let minIdx=0,maxIdx=0,minV=Infinity,maxV=-Infinity;

    for(let i=0;i<data.length;i++){
        const t=Math.round(data[i].temperatureC*10)/10;
        if(t<minV){minV=t;minIdx=i;}
        if(t>maxV){maxV=t;maxIdx=i;}
    }

    const leftT=Math.round(data[0].temperatureC*10)/10;
    const rightT=Math.round(data[data.length-1].temperatureC*10)/10;

    if(leftT===rightT){
        if(Math.abs(data[0].temperatureC-data[data.length-1].temperatureC)>1e-9)
            maxIdx=data[0].temperatureC>data[data.length-1].temperatureC?0:data.length-1;
    }else if(leftT>rightT){
        maxIdx=0;
    }else{
        maxIdx=data.length-1;
    }

    const tMin=Math.floor(minV/10)*10;
    const tMax=Math.ceil((maxV+5)/10)*10;
    const tDelta=tMax-tMin||1;
    const tCenter=(tMax+tMin)/2;

    const xs=x=>pad.left+((x-xMin)/xDelta)*wPlot;
    const ys=t=>pad.top+((tMax-t)/tDelta)*hPlot;
    const xCenter=xs((xMin+xMax)/2);

    let dPath=`M ${xs(xMin)} ${ys(data[0].temperatureC)}`;

    for(let i=0;i<data.length-1;i++){
        const p0=data[i?i-1:0],p1=data[i],p2=data[i+1],p3=data[i+2]||p2;
        const x0=xs(p0.xMm),x1=xs(p1.xMm),x2=xs(p2.xMm),x3=xs(p3.xMm);
        const y0=ys(p0.temperatureC),y1=ys(p1.temperatureC),y2=ys(p2.temperatureC),y3=ys(p3.temperatureC);

        dPath+=` C ${x1+(x2-x0)/6},${y1+(y2-y0)/6} ${x2-(x3-x1)/6},${y2-(y3-y1)/6} ${x2},${y2}`;
    }

    const dArea=`${dPath} L ${xs(xMax)} ${height-pad.bottom} L ${xs(xMin)} ${height-pad.bottom} Z`;

    const point=(idx,val)=>({
        x:xs(data[idx].xMm),
        y:ys(data[idx].temperatureC),
        val,
        anchor:idx===0?"start":idx===data.length-1?"end":"middle",
        dx:idx===0?4:idx===data.length-1?-4:0
    });

    const minP=point(minIdx,minV);
    const maxP=point(maxIdx,maxV);

    const chartColor=
        status?.type==="error"
            ?theme.palette.error.main
            :status?.type==="warning"
                ?theme.palette.warning.main
                :theme.palette.text.primary;

    return(
        <Box
            sx={{
                width:280,
                maxWidth:"100%",
                height,
                flex:"0 1 280px",
                flexShrink:0,
                display:"flex",
                alignItems:"center",
                border:"1px solid",
                borderColor:status?.type==="ok"?theme.palette.divider:chartColor,
                borderRadius:"6px",
                p:.5,
                boxSizing:"border-box",
                fontFamily:'"Roboto Mono","SF Mono",monospace'
            }}
        >
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={{overflow:"visible"}}
                shapeRendering="geometricPrecision"
            >
                {[tMax,tCenter,tMin].map((_,i)=>(
                    <line
                        key={i}
                        x1={pad.left}
                        y1={pad.top+(i*hPlot)/2}
                        x2={width-pad.right}
                        y2={pad.top+(i*hPlot)/2}
                        stroke={theme.palette.divider}
                        strokeDasharray="2 2"
                        shapeRendering="crispEdges"
                    />
                ))}

                <line
                    x1={xCenter}
                    y1={pad.top}
                    x2={xCenter}
                    y2={height-pad.bottom}
                    stroke={theme.palette.divider}
                    strokeDasharray="2 2"
                    shapeRendering="crispEdges"
                />

                <line
                    x1={pad.left}
                    y1={pad.top}
                    x2={pad.left}
                    y2={height-pad.bottom}
                    stroke={theme.palette.text.secondary}
                    opacity=".7"
                    shapeRendering="crispEdges"
                />

                <line
                    x1={pad.left}
                    y1={height-pad.bottom}
                    x2={width-pad.right}
                    y2={height-pad.bottom}
                    stroke={theme.palette.text.secondary}
                    opacity=".7"
                    shapeRendering="crispEdges"
                />

                <path d={dArea} fill={chartColor} fillOpacity=".05"/>
                <path d={dPath} fill="none" stroke={chartColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

                {[
                    {p:maxP,c:theme.palette.error.main,dy:-6},
                    {p:minP,c:theme.palette.primary.main,dy:14}
                ].map(({p,c,dy},i)=>(
                    <g key={i}>
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill={c}
                            stroke={theme.palette.background.paper}
                            strokeWidth="1"
                        />
                        <text
                            x={p.x}
                            y={p.y+dy}
                            dx={p.dx}
                            textAnchor={p.anchor}
                            fontSize="11"
                            fontWeight="bold"
                            fill={theme.palette.text.primary}
                        >
                            {p.val.toFixed(1)}°C
                        </text>
                    </g>
                ))}

                <text x={pad.left-6} y={pad.top+3} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{tMax}°</text>
                <text x={pad.left-6} y={height-pad.bottom+3} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{tMin}°</text>
                <text x={pad.left} y={height-9} textAnchor="middle" fontSize="8.5" fill={theme.palette.text.secondary}>{xMin} mm</text>
                <text x={width-pad.right} y={height-9} textAnchor="end" fontSize="8.5" fill={theme.palette.text.secondary}>{xMax} mm</text>
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

                        {status?.message&&(
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
                    </>
                )}
            </Box>

            <TemperatureProfileChart
                temperatureProfile={heatingParams?.temperatureProfile}
                status={heatingParams?.status}
            />
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

        return calculateBendingHeatingTime({
            thicknessMm:profile.thickness,
            material:MATERIAL,
            machine:MACHINA,

            thermalConditions:{
                initialTemperatureC:20,
                ambientTemperatureC:20,
                ambientRadiationTemperatureC:20
            },

            heaterMode:"both",
            maxTimeSeconds:1200
        });
    },[
        profile.thickness,
        profile?.materialKey,
        MATERIAL,
        MACHINA
    ]);

//    console.log(heatingParams)

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
