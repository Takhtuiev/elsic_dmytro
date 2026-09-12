import React,{useEffect,useMemo,useRef,useState} from "react";
import {Box,Typography,useTheme} from "@mui/material";
import {alpha} from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";
import {MAX_BEND_ANGLE,MIN_BEND_ANGLE} from "./svgConstants";
import {
    calculateBendingCycleTime,
    MACHINES,MATERIALS
} from "./calculateBendingCycleTime";

const MACHINA=MACHINES.MACHINE_LINE_1;

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

    return(
        <Box sx={{p:1}}>
            <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                <Typography
                    variant="body2"
                    color={PARAMETER_TEXT_COLOR}
                    fontSize={PARAMETER_TEXT_SIZE}
                >
                    Blank length: <strong>{Number.isFinite(blankLength)?blankLength.toFixed(2):"—"} mm</strong>
                </Typography>

                <Typography
                    variant="body2"
                    color={PARAMETER_TEXT_COLOR}
                    fontSize={PARAMETER_TEXT_SIZE}
                >
                    Width: <strong>{Number.isFinite(width)?width:"—"} mm</strong>
                </Typography>

                <Typography
                    variant="body2"
                    color={PARAMETER_TEXT_COLOR}
                    fontSize={PARAMETER_TEXT_SIZE}
                >
                    Mass: <strong>{mass!==null?mass.toFixed(3):"—"} kg</strong>
                </Typography>
            </Box>

            {machineParams&&(
                <>
                    <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                        <Typography
                            variant="body2"
                            color={PARAMETER_TEXT_COLOR}
                            fontSize={PARAMETER_TEXT_SIZE}
                        >
                            Stop pos: <strong>{machineParams.stopPosition} mm</strong>
                        </Typography>

                        <Typography
                            variant="body2"
                            color={PARAMETER_TEXT_COLOR}
                            fontSize={PARAMETER_TEXT_SIZE}
                        >
                            Bar low: <strong>{machineParams.barLowering} mm</strong>
                        </Typography>

                        <Typography
                            variant="body2"
                            color={PARAMETER_TEXT_COLOR}
                            fontSize={PARAMETER_TEXT_SIZE}
                        >
                            Angle: <strong>{machineParams.bendAngle}°</strong>
                        </Typography>
                    </Box>

                    <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                        <Typography
                            variant="body2"
                            color={PARAMETER_TEXT_COLOR}
                            fontSize={PARAMETER_TEXT_SIZE}
                        >
                            Heat temp: <strong>{heatingParams.regulatorTemp} °C</strong>
                        </Typography>

                        <Typography
                            variant="body2"
                            color={PARAMETER_TEXT_COLOR}
                            fontSize={PARAMETER_TEXT_SIZE}
                        >
                            Heating time: <strong>{formatTime(heatingParams.time)}</strong>
                        </Typography>
                    </Box>

                    <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                        <Typography
                            variant="body2"
                            color={PARAMETER_TEXT_COLOR}
                            fontSize={PARAMETER_TEXT_SIZE}
                        >
                            Surface temperature: <strong>{heatingParams.tSurf.toFixed(0)} °C</strong>
                        </Typography>

                        <Typography
                            variant="body2"
                            color={PARAMETER_TEXT_COLOR}
                            fontSize={PARAMETER_TEXT_SIZE}
                        >
                            Theoretical time: <strong>{formatTime(heatingParams.baseTime)}</strong>
                        </Typography>
                    </Box>
                </>
            )}
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
                    setContainerSize({width,height});
            }
        );

        observer.observe(containerRef.current);

        return()=>observer.disconnect();
    },[]);

    const heatingParams=calculateBendingCycleTime({
        thickness:profile?.thickness,
        material:MATERIALS[profile?.materialKey],
        machine:MACHINA,
        regulatorTemp:200,
        tShop:20
    });

    const invalidAngleIndex=
        profile?.bends?.findIndex(({angle})=>{
            angle=Number(angle);

            return !Number.isFinite(angle)||
                angle<MIN_BEND_ANGLE||
                angle>MAX_BEND_ANGLE;
        })??-1;

    const invalidShelfIndex=
        profile?.shelves?.findIndex(({length})=>{
            length=Number(length);
            const thickness=Number(profile?.thickness);

            return !Number.isFinite(length)||
                !Number.isFinite(thickness)||
                length<thickness;
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
    },[profile,view,containerSize,validationError]);

    const committedRotation=Number(view?.rotation??0);

    const visualRotation=
        Number(
            rotationPreview??committedRotation
        )-committedRotation;

    const viewBoxValues=svgData?.viewBox
        ?.split(/\s+/)
        .map(Number);

    const rotationCenter=
        viewBoxValues?.length===4
            ?{
                x:viewBoxValues[0]+viewBoxValues[2]/2,
                y:viewBoxValues[1]+viewBoxValues[3]/2
            }
            :{x:0,y:0};

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

            <Box
                className="bend-preview-parameters"
                sx={{flexShrink:0}}
            >
                <Parameters
                    profile={profile}
                    part={{blankLength}}
                    machineParams={machineParams}
                    heatingParams={heatingParams}
                />
            </Box>
        </Box>
    );
};

export default BendingPreview;