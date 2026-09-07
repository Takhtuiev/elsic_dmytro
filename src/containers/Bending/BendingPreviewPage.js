import React,{useEffect,useState} from "react";
import {
    Box,
    IconButton,
    Paper,
    Slider,
    Stack,
    Tooltip,
    Typography
} from "@mui/material";
import FlipIcon from "@mui/icons-material/Flip";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import {useNavigate} from "react-router-dom";

import BendingPreview from "./BendingPreview";

const MIN_ROTATION=-180;
const MAX_ROTATION=180;

const BendingPreviewPage=({
                              profile,
                              blankLength,
                              machineParams,
                              profileRotation,
                              onProfileRotationChange,
                              onRotationStart,
                              onProfileMirrorChange
                          })=>{
    const navigate=useNavigate();

    const committedRotation=Number(
        profileRotation ??
        profile?.profileRotation ??
        0
    );

    const profileMirrored=Boolean(
        profile?.profileMirrored
    );

    const bendSelected=
        profile?.selectedBendIndex>=0;

    const [rotationPreview,setRotationPreview]=useState(
        committedRotation
    );

    useEffect(()=>{
        setRotationPreview(committedRotation);
    },[committedRotation]);

    const handleRotationChange=(_,value)=>{
        if(onRotationStart)
            onRotationStart();

        setRotationPreview(Number(value));
    };

    const handleRotationCommitted=(_,value)=>{
        const next=Number(value);

        setRotationPreview(next);
        onProfileRotationChange?.(next);
    };

    const handleMirrorChange=value=>{
        onProfileMirrorChange?.(Boolean(value));
    };

    return(
        <Paper
            elevation={2}
            sx={{
                mt:2,
                p:2
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                sx={{
                    mb:1,
                    width:"100%",
                    minWidth:0
                }}
            >
                <Typography
                    variant="subtitle1"
                    fontWeight="500"
                    color="text.secondary"
                    sx={{
                        flexShrink:0,
                        whiteSpace:"nowrap"
                    }}
                >
                    Bend Profile
                </Typography>

                <Slider
                    value={rotationPreview}
                    min={MIN_ROTATION}
                    max={MAX_ROTATION}
                    step={1}
                    size="small"
                    disabled={bendSelected}
                    onChange={handleRotationChange}
                    onChangeCommitted={handleRotationCommitted}
                    sx={{
                        flex:1,
                        minWidth:80,
                        mx:2,
                        py:0,
                        color:"text.secondary",
                        opacity:.65,

                        "& .MuiSlider-rail":{
                            height:1,
                            opacity:.45
                        },

                        "& .MuiSlider-track":{
                            height:1
                        },

                        "& .MuiSlider-thumb":{
                            width:7,
                            height:7,
                            boxShadow:"none"
                        }
                    }}
                />

                <Tooltip title="Mirror">
                    <IconButton
                        size="small"
                        disabled={bendSelected}
                        onClick={()=>{
                            handleMirrorChange(
                                !profileMirrored
                            );
                        }}
                        sx={{
                            width:28,
                            height:28,
                            flexShrink:0
                        }}
                    >
                        <FlipIcon
                            sx={{
                                fontSize:17,
                                transform:profileMirrored
                                    ?"scaleX(-1)"
                                    :"none"
                            }}
                        />
                    </IconButton>
                </Tooltip>

               <Tooltip title="Full screen">
                    <IconButton
                        size="small"
                        onClick={()=>{
                            navigate(
                                "/biegeberechnung/preview"
                            );
                        }}
                        sx={{
                            marginLeft:4,
                            width:28,
                            height:28,
                            flexShrink:0,
                            color:"text.secondary"
                        }}
                    >
                        <FullscreenIcon
                            fontSize="small"
                        />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Box
                sx={{
                    width:"100%",
                    height:"65vh",
                    minHeight:500,
                    maxHeight:700
                }}
            >
                <BendingPreview
                    profile={profile}
                    blankLength={blankLength}
                    machineParams={machineParams}
                    rotationPreview={rotationPreview}
                />
            </Box>
        </Paper>
    );
};

export default BendingPreviewPage;