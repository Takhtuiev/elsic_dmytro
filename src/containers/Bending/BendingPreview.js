import React,{useEffect,useMemo,useRef,useState} from "react";
import {Box,Stack,Typography,useTheme} from "@mui/material";
import {alpha} from "@mui/material/styles";

import buildProfileGeometry from "./BuildProfileGeometry";
import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";

const MIN_BEND_ANGLE=45,MAX_BEND_ANGLE=180;

const Parameter=({label,value,unit="",border=true})=>(
    <Stack direction="row" spacing={1} alignItems="center"
        sx={border?{pt:1,borderTop:"1px dashed",borderColor:"divider"}:{}}>
        <Typography variant="caption" color="text.secondary">{label}:</Typography>
        <Typography variant="caption" fontWeight="600" color="text.primary">{value}{unit}</Typography>
    </Stack>
);

const Parameters=({profile,blankLength,machineParams})=>{
    const value=(v,digits=2)=>v!==null&&v!==undefined?`${Number(v).toFixed(digits)}`:"—";

    return (
        <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center"
                sx={{pt:1,borderTop:"1px dashed",borderColor:"divider"}}>
                <Typography variant="caption" color="text.secondary">Thickness:</Typography>
                <Typography variant="caption" fontWeight="600">{value(profile.thickness)} mm</Typography>
                <Typography variant="caption" color="text.disabled">•</Typography>
                <Typography variant="caption" color="text.secondary">Blank Length:</Typography>
                <Typography variant="caption" fontWeight="600">{value(blankLength)} mm</Typography>
            </Stack>

            {machineParams&&(
                <Stack direction="row" spacing={1} alignItems="center"
                    sx={{pt:1,borderTop:"1px dashed",borderColor:"divider"}}>
                    <Parameter label="Stop" value={value(machineParams.stopPosition)} unit=" mm" border={false}/>
                    <Typography variant="caption" color="text.disabled">•</Typography>
                    <Parameter label="Angle" value={value(machineParams.bendAngle)} unit="°" border={false}/>
                    <Typography variant="caption" color="text.disabled">•</Typography>
                    <Parameter label="Gap" value={value(machineParams.gapFolding)} unit=" mm" border={false}/>
                </Stack>
            )}
        </Stack>
    );
};

const BendingPreview=({profile,blankLength,machineParams})=>{
    const theme=useTheme();
    const containerRef=useRef(null);
    const [containerSize,setContainerSize]=useState({width:800,height:500});

    useEffect(()=>{
        if(!containerRef.current) return;

        const observer=new ResizeObserver(([{contentRect:{width,height}}])=>{
            if(width>0&&height>0) setContainerSize({width,height});
        });

        observer.observe(containerRef.current);
        return()=>observer.disconnect();
    },[]);

    const invalidAngleIndex=profile?.bends?.findIndex(({angle})=>{
        angle=Number(angle);
        return !Number.isFinite(angle)||angle<MIN_BEND_ANGLE||angle>MAX_BEND_ANGLE;
    })??-1;

    const invalidShelfIndex=profile?.shelves?.findIndex(({length})=>{
        length=Number(length);
        const thickness=Number(profile.thickness);
        return !Number.isFinite(length)||!Number.isFinite(thickness)||length<thickness;
    })??-1;

    const validationError=invalidAngleIndex>=0
        ?`Angle ${invalidAngleIndex+1}: ${profile.bends[invalidAngleIndex].angle}° — allowed range is ${MIN_BEND_ANGLE}°–${MAX_BEND_ANGLE}°`
        :invalidShelfIndex>=0
            ?`Leg ${invalidShelfIndex+1}: ${profile.shelves[invalidShelfIndex].length} mm — must be at least ${profile.thickness} mm`
            :null;

    const colors={
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
    };

    const svgData=useMemo(()=>{
        if(!profile||validationError) return null;
        return prepareSvgLayers(
            buildProfileGeometry(profile),
            profile,
            containerSize
        );
    },[profile,containerSize,validationError]);

    if(!profile) return null;

    const renderLayer=(data,type,isGhost=false)=>data&&(
        <BendProfileRender
            data={data}
            strokeColor={colors[type].line}
            fillColor={colors[type].fill}
            annotationColor={colors[type].annotation}
            isGhost={isGhost}
        />
    );

    return (
        <Box sx={{width:"100%",height:"100%",display:"flex",flexDirection:"column",minHeight:0}}>
            <Box ref={containerRef} sx={{
                flex:1,minHeight:0,width:"100%",display:"flex",
                alignItems:"center",justifyContent:"center",overflow:"hidden"
            }}>
                {validationError?(
                    <Box sx={{
                        width:"100%",height:"100%",display:"flex",
                        alignItems:"center",justifyContent:"center",textAlign:"center"
                    }}>
                        <Typography variant="body2" fontWeight={500} color="warning.main">
                            {validationError}
                        </Typography>
                    </Box>
                ):svgData&&(
                    <svg viewBox={svgData.viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                        {renderLayer(svgData.activeData,"active")}
                        {renderLayer(svgData.ghostData,"ghost",true)}
                        {renderLayer(svgData.blueData,"blue")}
                    </svg>
                )}
            </Box>

            <Box sx={{flexShrink:0}}>
                <Parameters profile={profile} blankLength={blankLength} machineParams={machineParams}/>
            </Box>
        </Box>
    );
};

export default BendingPreview;
