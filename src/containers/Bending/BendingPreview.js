import React,{useEffect,useMemo,useRef,useState} from "react";
import {
    Box,
    Typography,
    useTheme
} from "@mui/material";
import {alpha} from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";


const MIN_BEND_ANGLE=45;
const MAX_BEND_ANGLE=180;


const Parameters=({
    profile,
    blankLength,
    machineParams
})=>(
    <Box
        sx={{
            p:1
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
                color="text.secondary"
            >
                Thickness:{" "}
                <strong>
                    {profile?.thickness ?? "—"} mm
                </strong>
            </Typography>

            <Typography
                variant="body2"
                color="text.secondary"
            >
                Blank length:{" "}
                <strong>
                    {blankLength ?? "—"} mm
                </strong>
            </Typography>
        </Box>

        {machineParams&&(
            <Box
                sx={{
                    display:"flex",
                    flexWrap:"wrap",
                    gap:2,
                    mt:.5
                }}
            >
                {Object.entries(machineParams).map(
                    ([key,value])=>(
                        <Typography
                            key={key}
                            variant="body2"
                            color="text.secondary"
                        >
                            {key}:{" "}
                            <strong>{value}</strong>
                        </Typography>
                    )
                )}
            </Box>
        )}
    </Box>
);


const BendingPreview=({
    profile,
    blankLength,
    machineParams,
    rotationPreview
})=>{

    const theme=useTheme();

    const containerRef=useRef(null);

    const [containerSize,setContainerSize]=useState({
        width:800,
        height:500
    });


    useEffect(()=>{
        if(!containerRef.current)
            return;

        const observer=new ResizeObserver(
            ([{contentRect:{width,height}}])=>{
                if(width>0&&height>0)
                    setContainerSize({
                        width,
                        height
                    });
            }
        );

        observer.observe(containerRef.current);

        return()=>observer.disconnect();
    },[]);


    const invalidAngleIndex=
        profile?.bends?.findIndex(
            ({angle})=>{
                angle=Number(angle);

                return !Number.isFinite(angle)||
                    angle<MIN_BEND_ANGLE||
                    angle>MAX_BEND_ANGLE;
            }
        )??-1;


    const invalidShelfIndex=
        profile?.shelves?.findIndex(
            ({length})=>{
                length=Number(length);

                const thickness=
                    Number(profile.thickness);

                return !Number.isFinite(length)||
                    !Number.isFinite(thickness)||
                    length<thickness;
            }
        )??-1;


    const validationError=
        invalidAngleIndex>=0
            ?`Angle ${invalidAngleIndex+1}: ${profile.bends[invalidAngleIndex].angle}° — allowed range is ${MIN_BEND_ANGLE}°–${MAX_BEND_ANGLE}°`
            :invalidShelfIndex>=0
                ?`Leg ${invalidShelfIndex+1}: ${profile.shelves[invalidShelfIndex].length} mm — must be at least ${profile.thickness} mm`
                :null;


    const colors={
        active:{
            line:theme.palette.text.primary,
            fill:alpha(
                theme.palette.text.primary,
                .1
            ),
            annotation:alpha(
                theme.palette.text.primary,
                .75
            )
        },

        ghost:{
            line:theme.palette.text.disabled,
            fill:alpha(
                theme.palette.text.disabled,
                .02
            ),
            annotation:alpha(
                theme.palette.text.disabled,
                .4
            )
        },

        blue:{
            line:theme.palette.primary.main,
            fill:alpha(
                theme.palette.primary.main,
                .08
            ),
            annotation:theme.palette.primary.main
        }
    };


    /*
     * Геометрия пересчитывается только при изменении
     * profile или размера контейнера.
     *
     * rotationPreview здесь НЕ используется.
     */
    const svgData=useMemo(()=>{
        if(!profile||validationError)
            return null;

        return prepareSvgLayers(
            profile,
            containerSize
        );
    },[
        profile,
        containerSize,
        validationError
    ]);


    /*
     * profile.profileRotation —
     * последний подтверждённый угол.
     *
     * rotationPreview —
     * временный угол от Slider.
     *
     * При движении Slider меняется только transform
     * уже построенного SVG.
     */
    const committedRotation=
        Number(profile?.profileRotation??0);

    const visualRotation=
        Number(
            rotationPreview??
            committedRotation
        )-
        committedRotation;


    /*
     * Центр вращения берём из текущего viewBox.
     */
    const viewBoxValues=svgData?.viewBox
        ?.split(/\s+/)
        .map(Number);

    const rotationCenter=
        viewBoxValues?.length===4
            ?{
                x:viewBoxValues[0]+
                    viewBoxValues[2]/2,
                y:viewBoxValues[1]+
                    viewBoxValues[3]/2
            }
            :{
                x:0,
                y:0
            };


    return(
        <Box
            className="bend-preview-root"
            sx={{
                width:"100%",
                height:"100%",
                display:"flex",
                flexDirection:"column",
                minHeight:0
            }}
        >

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
                                visualRotation!==0
                                    ?`rotate(${visualRotation},${rotationCenter.x},${rotationCenter.y})`
                                    :undefined
                            }
                        >

                            <BendProfileRender
                                data={svgData.activeData}
                                strokeColor={
                                    colors.active.line
                                }
                                fillColor={
                                    colors.active.fill
                                }
                                annotationColor={
                                    colors.active.annotation
                                }
                            />

                            <BendProfileRender
                                data={svgData.ghostData}
                                strokeColor={
                                    colors.ghost.line
                                }
                                fillColor={
                                    colors.ghost.fill
                                }
                                annotationColor={
                                    colors.ghost.annotation
                                }
                                isGhost
                            />

                            <BendProfileRender
                                data={svgData.blueData}
                                strokeColor={
                                    colors.blue.line
                                }
                                fillColor={
                                    colors.blue.fill
                                }
                                annotationColor={
                                    colors.blue.annotation
                                }
                            />

                        </g>

                    </svg>
                )}

            </Box>


            <Box
                className="bend-preview-parameters"
                sx={{
                    flexShrink:0
                }}
            >
                <Parameters
                    profile={profile}
                    blankLength={blankLength}
                    machineParams={machineParams}
                />
            </Box>

        </Box>
    );
};


export default BendingPreview;
