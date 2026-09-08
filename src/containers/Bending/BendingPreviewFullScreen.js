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

    const view=profile?.view;

    const blankLength=useMemo(()=>{
        if(!profile)return null;

        return calculateBlankLength(profile);
    },[profile]);


    const machineParams=useMemo(()=>{
        const selectedBendIndex=
            profile?.view?.bendIndex??-1;

        if(
            !profile||
            selectedBendIndex<0||
            !profile.bends?.[selectedBendIndex]
        ){
            return null;
        }

        const selectedBend=
            profile.bends[selectedBendIndex];

        const distanceToOuterApex=
            calculateOuterLengthToEnd(
                profile,
                selectedBendIndex,
                profile.view.bendSide
            );

        return calculateBendingMachineParams({
            alpha:selectedBend.angle,
            lInput:Number(
                distanceToOuterApex.toFixed(2)
            ),
            isInnerMode:false,
            t:profile.thickness,
            rTool:profile.rTool
        });
    },[profile]);


    if(!profile){
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
                    borderColor:"divider"
                }}
            >
                <IconButton
                    size="small"
                    onClick={()=>navigate(-1)}
                    title="Back"
                >
                    <ArrowBackIcon/>
                </IconButton>

                <Typography
                    variant="subtitle1"
                    fontWeight="500"
                    color="text.secondary"
                    sx={{
                        ml:1,
                        flex:1
                    }}
                >
                    Bend Profile (Geometric Drawing)
                </Typography>

                <IconButton
                    size="small"
                    onClick={()=>window.print()}
                    title="Print"
                    sx={{
                        color:"text.secondary"
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
                            backgroundColor:"action.hover"
                        }
                    }}
                >
                    <CloseIcon/>
                </IconButton>
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
                    profile={profile}
                    view={view}
                    blankLength={blankLength}
                    machineParams={machineParams}
                />
            </Box>

        </Box>
    );
};


export default BendingPreviewFullScreen;