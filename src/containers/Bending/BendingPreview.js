import React,{useEffect,useMemo,useRef,useState} from "react";
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


const TemperatureProfileChart=({temperatureProfile})=>{
    if(!temperatureProfile?.length) return null;

    const width=280;
    const height=120;

    const padding={
        left:42,
        right:15,
        top:22,
        bottom:26
    };

    const xMin=temperatureProfile[0].xMm;
    const xMax=temperatureProfile[temperatureProfile.length-1].xMm;

    const temperatures=temperatureProfile.map(
        p=>p.temperatureC
    );

    const tMinActual=Math.min(...temperatures);
    const tMaxActual=Math.max(...temperatures);

    const tMin=Math.floor(tMinActual/10)*10;
    const tMax=Math.ceil((tMaxActual+5)/10)*10;

    const plotWidth=width-padding.left-padding.right;
    const plotHeight=height-padding.top-padding.bottom;

    const xScale=x=>
        padding.left+
        ((x-xMin)/(xMax-xMin))*plotWidth;

    const yScale=t=>
        padding.top+
        ((tMax-t)/(tMax-tMin))*plotHeight;

    const minIndex=temperatures.indexOf(tMinActual);
    const maxIndex=temperatures.indexOf(tMaxActual);

    const minPoint={
        x:xScale(temperatureProfile[minIndex].xMm),
        y:yScale(tMinActual),
        val:tMinActual
    };

    const maxPoint={
        x:xScale(temperatureProfile[maxIndex].xMm),
        y:yScale(tMaxActual),
        val:tMaxActual
    };

    const xCenter=(xMin+xMax)/2;
    const xCenterScaled=xScale(xCenter);

    let dPath="";
    let dArea="";

    if(temperatureProfile.length>1){
        dPath=
            `M ${xScale(temperatureProfile[0].xMm)} `+
            `${yScale(temperatureProfile[0].temperatureC)}`;

        for(let i=0;i<temperatureProfile.length-1;i++){
            const p0=
                temperatureProfile[Math.max(0,i-1)];

            const p1=
                temperatureProfile[i];

            const p2=
                temperatureProfile[i+1];

            const p3=
                temperatureProfile[
                    Math.min(
                        temperatureProfile.length-1,
                        i+2
                    )
                ];

            const cp1x=
                xScale(p1.xMm)+
                (xScale(p2.xMm)-xScale(p0.xMm))/6;

            const cp1y=
                yScale(p1.temperatureC)+
                (yScale(p2.temperatureC)-
                    yScale(p0.temperatureC))/6;

            const cp2x=
                xScale(p2.xMm)-
                (xScale(p3.xMm)-xScale(p1.xMm))/6;

            const cp2y=
                yScale(p2.temperatureC)-
                (yScale(p3.temperatureC)-
                    yScale(p1.temperatureC))/6;

            dPath+=
                ` C ${cp1x},${cp1y}`+
                ` ${cp2x},${cp2y}`+
                ` ${xScale(p2.xMm)},${yScale(p2.temperatureC)}`;
        }

        dArea=
            `${dPath}`+
            ` L ${xScale(xMax)} ${height-padding.bottom}`+
            ` L ${xScale(xMin)} ${height-padding.bottom}`+
            " Z";
    }

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
                borderColor:"divider",
                borderRadius:"8px",
                p:.5,
                boxSizing:"border-box"
            }}
        >
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
                style={{overflow:"visible"}}
            >
                <defs>
                    <linearGradient
                        id="areaGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor="currentColor"
                            stopOpacity=".25"
                        />

                        <stop
                            offset="100%"
                            stopColor="currentColor"
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>

                <line
                    x1={padding.left}
                    y1={yScale(tMax)}
                    x2={width-padding.right}
                    y2={yScale(tMax)}
                    stroke="currentColor"
                    opacity=".1"
                    strokeDasharray="3 3"
                />

                <line
                    x1={padding.left}
                    y1={yScale(tMin)}
                    x2={width-padding.right}
                    y2={yScale(tMin)}
                    stroke="currentColor"
                    opacity=".1"
                    strokeDasharray="3 3"
                />

                <line
                    x1={xCenterScaled}
                    y1={padding.top}
                    x2={xCenterScaled}
                    y2={height-padding.bottom}
                    stroke="currentColor"
                    opacity=".15"
                    strokeDasharray="4 4"
                />

                <line
                    x1={padding.left}
                    y1={padding.top}
                    x2={padding.left}
                    y2={height-padding.bottom}
                    stroke="currentColor"
                    opacity=".35"
                    strokeWidth="1.5"
                />

                <line
                    x1={padding.left}
                    y1={height-padding.bottom}
                    x2={width-padding.right}
                    y2={height-padding.bottom}
                    stroke="currentColor"
                    opacity=".35"
                    strokeWidth="1.5"
                />

                {dArea&&(
                    <path
                        d={dArea}
                        fill="url(#areaGradient)"
                    />
                )}

                {dPath&&(
                    <path
                        d={dPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                <circle
                    cx={maxPoint.x}
                    cy={maxPoint.y}
                    r="4"
                    fill="#ff4d4d"
                    stroke="#fff"
                    strokeWidth="1.5"
                />

                <text
                    x={maxPoint.x}
                    y={maxPoint.y-8}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="currentColor"
                >
                    {maxPoint.val.toFixed(1)}°C
                </text>

                <circle
                    cx={minPoint.x}
                    cy={minPoint.y}
                    r="4"
                    fill="#2f80ed"
                    stroke="#fff"
                    strokeWidth="1.5"
                />

                <text
                    x={minPoint.x}
                    y={minPoint.y+14}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="currentColor"
                >
                    {minPoint.val.toFixed(1)}°C
                </text>

                <text
                    x={padding.left-8}
                    y={yScale(tMax)+3}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    opacity=".7"
                >
                    {tMax}°
                </text>

                <text
                    x={padding.left-8}
                    y={yScale(tMin)+3}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    opacity=".7"
                >
                    {tMin}°
                </text>

                <text
                    x={padding.left}
                    y={height-8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                    opacity=".7"
                >
                    {xMin}
                </text>

                <text
                    x={width-padding.right}
                    y={height-8}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    opacity=".7"
                >
                    {xMax} mm
                </text>
            </svg>
        </Box>
    );
};


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
            ?blankLength*
            width*
            thickness*
            density/
            1e9
            :null;

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
                            {Number.isFinite(blankLength)
                                ?blankLength.toFixed(2)
                                :"—"}{" "}
                            mm
                        </strong>
                    </Typography>

                    <Typography
                        variant="body2"
                        color={PARAMETER_TEXT_COLOR}
                        fontSize={PARAMETER_TEXT_SIZE}
                    >
                        Width:{" "}
                        <strong>
                            {Number.isFinite(width)
                                ?width
                                :"—"}{" "}
                            mm
                        </strong>
                    </Typography>

                    <Typography
                        variant="body2"
                        color={PARAMETER_TEXT_COLOR}
                        fontSize={PARAMETER_TEXT_SIZE}
                    >
                        Mass:{" "}
                        <strong>
                            {mass!==null
                                ?mass.toFixed(3)
                                :"—"}{" "}
                            kg
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
                                <strong>
                                    {"200"} °C
                                </strong>
                            </Typography>

                            <Typography
                                variant="body2"
                                color={PARAMETER_TEXT_COLOR}
                                fontSize={PARAMETER_TEXT_SIZE}
                            >
                                Heating time:{" "}
                                <strong>
                                    {formatTime(
                                        heatingParams?.heatingTimeSeconds
                                    )}
                                </strong>
                            </Typography>
                        </Box>
                    </>
                )}
            </Box>

            <TemperatureProfileChart
                temperatureProfile={
                    heatingParams?.temperatureProfile
                }
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
