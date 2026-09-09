import React,{useEffect,useMemo,useRef,useState} from "react";
import {Box,Typography,useTheme} from "@mui/material";
import {alpha} from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";
import {MAX_BEND_ANGLE, MIN_BEND_ANGLE} from "./svgConstants";


const PARAMETER_TEXT_COLOR="text.primary";
const PARAMETER_TEXT_SIZE="0.8rem";

const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return "0m 00s";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);

    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
};


/**
* Расчет времени для H.P. Burger с учетом толщины и температуры на регуляторе
* @param {number} thicknessMm - Толщина ПВХ в мм (4, 5, 6 мм)
* @param {number} tRegulator - Температура на приборе в °C (например, 180, 200, 210)
*/
function getPvcHeating(thicknessMm, tRegulator = 200) {
    const kBase = 18.5;

    // Эмпирическая температурная поправка
    const tempFactor =
        Math.pow(200 / tRegulator, 1.5);

    const kDynamic = kBase * tempFactor;

    const heatingSec = Math.round(
        kDynamic * Math.pow(thicknessMm, 1.35)
    );

    const coolingSec = Math.max(
        45,
        Math.round(heatingSec * 0.75)
    );

    return {
        thickness: thicknessMm + " mm",
        regulatorTemp: tRegulator + " °C",
        calculatedK: Number(kDynamic.toFixed(2)),
        heatingTime: heatingSec,
        coolingTime: coolingSec
    };
}




const Parameters=({profile,blankLength,machineParams,heatingParams})=>(
    <Box sx={{p:1}}>
        <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
            <Typography
                variant="body2"
                color={PARAMETER_TEXT_COLOR}
                fontSize={PARAMETER_TEXT_SIZE}
            >
                Thickness:{" "}
                <strong>{profile?.thickness??"—"} mm</strong>
            </Typography>

            <Typography
                variant="body2"
                color={PARAMETER_TEXT_COLOR}
                fontSize={PARAMETER_TEXT_SIZE}
            >
                Blank length:{" "}
                <strong>{blankLength?.toFixed(2)??"—"} mm</strong>
            </Typography>
        </Box>

        {machineParams&&(
            <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>
                <Typography
                    variant="body2"
                    color={PARAMETER_TEXT_COLOR}
                    fontSize={PARAMETER_TEXT_SIZE}
                >
                    Stop position: <strong>{machineParams.stopPosition} mm</strong>
                </Typography>

                <Typography
                    variant="body2"
                    color={PARAMETER_TEXT_COLOR}
                    fontSize={PARAMETER_TEXT_SIZE}
                >
                    Bar lowering : <strong>{machineParams.barLowering} mm</strong>
                </Typography>

                <Typography
                    variant="body2"
                    color={PARAMETER_TEXT_COLOR}
                    fontSize={PARAMETER_TEXT_SIZE}
                >
                    Bending angle: <strong>{machineParams.bendAngle}°</strong>
                </Typography>
            </Box>
        )}

        <Box sx={{display:"flex",flexWrap:"wrap",gap:2}}>

            <Typography
                variant="body2"
                color={PARAMETER_TEXT_COLOR}
                fontSize={PARAMETER_TEXT_SIZE}
            >
                Heating temperature: <strong>{heatingParams.regulatorTemp}</strong>
            </Typography>

            <Typography
                variant="body2"
                color={PARAMETER_TEXT_COLOR}
                fontSize={PARAMETER_TEXT_SIZE}
            >
                Heating time: <strong>{formatTime(heatingParams.heatingTime)}</strong>
            </Typography>

        </Box>
    </Box>
);


const BendingPreview=({
    profile,
    view,
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


    const heatingParams = getPvcHeating(profile?.thickness, 200);

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
            const thickness=Number(profile.thickness);

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


    /*
     * view.rotation — подтверждённый угол.
     * rotationPreview — временное значение Slider.
     *
     * В SVG вращаем только разницу между ними.
     */
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
                    blankLength={blankLength}
                    machineParams={machineParams}
                    heatingParams={heatingParams}
                />
            </Box>
        </Box>
    );
};


export default BendingPreview;
