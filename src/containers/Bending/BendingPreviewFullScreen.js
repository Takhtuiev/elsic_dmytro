import React,{useMemo} from "react";
import {Box,IconButton,Typography} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import {useNavigate} from "react-router-dom";
import {useSelector} from "react-redux";

import BendingPreview from "./BendingPreview";

import {
    calculateBlankLength,
    calculateBendingMachineParams,
    calculateOuterLengthToEnd
} from "./Calculations";


const BendingPreviewFullScreen=()=>{
    const navigate=useNavigate();

    const profile=useSelector(
        state=>state.bending.profile
    );

    const machine=profile?.machine;
    const simulation=profile?.simulation;
    const geometry=profile?.geometry;

    const geometryProfile=useMemo(
        ()=>{
            if(!profile||!geometry)return null;

            return{
                ...profile,
                ...geometry,
                kFactor:profile.material?.kFactor,
                rTool:machine?.rTool
            };
        },
        [
            profile,
            geometry,
            machine
        ]
    );

    const blankLength=useMemo(()=>{
        if(!geometryProfile)return null;

        return calculateBlankLength(
            geometryProfile
        );
    },[geometryProfile]);


    const machineParams=useMemo(()=>{
        const selectedBendIndex=
            profile?.view?.bendIndex??-1;

        if(
            !geometryProfile||
            selectedBendIndex<0||
            !geometryProfile.bends?.[selectedBendIndex]
        ){
            return null;
        }

        const selectedBend=
            geometryProfile.bends[selectedBendIndex];

        const distanceToOuterApex=
            calculateOuterLengthToEnd(
                geometryProfile,
                selectedBendIndex,
                profile.view.bendSide
            );

        return calculateBendingMachineParams({
            alpha:selectedBend.angle,
            lInput:Number(
                distanceToOuterApex.toFixed(2)
            ),
            isInnerMode:false,
            t:geometryProfile.thickness,
            rTool:machine?.rTool
        });
    },[
        profile,
        geometryProfile,
        machine
    ]);


    if(!profile||!geometryProfile){
        return(
            <Box
                sx={{
                    width:"100vw",
                    height:"100vh",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    bgcolor:"background.default"
                }}
            >
                <Typography>
                    Preview data is unavailable
                </Typography>
            </Box>
        );
    }


    return(
        <Box
            className="bend-print-root"
            sx={{
                width:"100vw",
                height:"100vh",
                display:"flex",
                flexDirection:"column",
                overflow:"hidden",
                bgcolor:"background.default"
            }}
        >

            <Box
                className="bend-print-toolbar"
                sx={{
                    flexShrink:0,
                    height:56,
                    display:"flex",
                    alignItems:"center",
                    px:2,
                    borderBottom:"1px solid",
                    borderColor:"divider",
                }}
            >
                <IconButton
                    size="small"
                    onClick={()=>navigate(-1)}
                    title="Back"
                >
                    <ArrowBackIcon/>
                </IconButton>

                <Box
                    sx={{
                        ml:"auto",
                        display:"flex",
                        alignItems:"center",
                    }}
                >
                    <IconButton
                        size="small"
                        onClick={()=>window.print()}
                        title="Print"
                        sx={{
                            color:"text.secondary",
                        }}
                    >
                        <PrintIcon/>
                    </IconButton>

                    <IconButton
                        size="small"
                        onClick={()=>navigate(-1)}
                        title="Close"
                        sx={{
                            color:"text.secondary",
                            "&:hover":{
                                color:"error.main",
                                backgroundColor:"action.hover",
                            },
                        }}
                    >
                        <CloseIcon/>
                    </IconButton>
                </Box>
            </Box>


            <Box
                className="bend-print-content"
                sx={{
                    flex:1,
                    minHeight:0,
                    width:"100%",
                    px:2,
                    py:1,
                    display:"flex",
                    flexDirection:"column",
                    overflow:"hidden"
                }}
            >
                <BendingPreview
                    profile={geometryProfile}
                    machine={machine}
                    simulation={simulation}
                    blankLength={blankLength}
                    machineParams={machineParams}
                />
            </Box>

        </Box>
    );
};


export default BendingPreviewFullScreen;
