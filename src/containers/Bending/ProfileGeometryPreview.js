import React,{useMemo,useState,useEffect,useRef} from "react";
import {
    Box,Button,Dialog,IconButton,Paper,Stack,Toolbar,
    Typography,useTheme
} from "@mui/material";
import {alpha} from "@mui/material/styles";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import buildProfileGeometry from "./BuildProfileGeometry";
import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";

const MIN_BEND_ANGLE=45;
const MAX_BEND_ANGLE=180;

const ProfileGeometryPreview=({profile,blankLength,machineParams})=>{
    const theme=useTheme();
    const containerRef=useRef(null);
    const [containerSize,setContainerSize]=useState({width:800,height:500});
    const [fullScreen,setFullScreen]=useState(false);

    useEffect(()=>{
        if(!containerRef.current)return;

        const observer=new ResizeObserver(([entry])=>{
            const {width,height}=entry.contentRect;
            if(width>0&&height>0)setContainerSize({width,height});
        });

        observer.observe(containerRef.current);
        return()=>observer.disconnect();
    },[]);

    useEffect(()=>{
        document.body.classList.toggle("print-profile",fullScreen);
        return()=>document.body.classList.remove("print-profile");
    },[fullScreen]);

    const invalidAngleIndex=profile.bends?.findIndex(bend=>{
        const angle=Number(bend.angle);
        return !Number.isFinite(angle)||angle<MIN_BEND_ANGLE||angle>MAX_BEND_ANGLE;
    })??-1;

    const invalidShelfIndex=profile.shelves?.findIndex(shelf=>{
        const length=Number(shelf.length);
        const thickness=Number(profile.thickness);
        return !Number.isFinite(length)||!Number.isFinite(thickness)||length<thickness;
    })??-1;

    const invalidAngle=invalidAngleIndex>=0?profile.bends[invalidAngleIndex]:null;
    const invalidShelf=invalidShelfIndex>=0?profile.shelves[invalidShelfIndex]:null;

    const validationError=invalidAngle
        ?`Angle ${invalidAngleIndex+1}: ${invalidAngle.angle}° — allowed range is ${MIN_BEND_ANGLE}°–${MAX_BEND_ANGLE}°`
        :invalidShelf
            ?`Leg ${invalidShelfIndex+1}: ${invalidShelf.length} mm — must be at least ${profile.thickness} mm`
            :null;

    const ACTIVE_LINE_COLOR=theme.palette.text.primary;
    const ACTIVE_FILL_COLOR=alpha(theme.palette.text.primary,.1);
    const ACTIVE_ANNOTATION_COLOR=alpha(theme.palette.text.primary,.75);
    const GHOST_LINE_COLOR=theme.palette.text.disabled;
    const GHOST_FILL_COLOR=alpha(theme.palette.text.disabled,.02);
    const GHOST_ANNOTATION_COLOR=alpha(theme.palette.text.disabled,.4);
    const BLUE_LINE_COLOR=theme.palette.primary.main;
    const BLUE_FILL_COLOR=alpha(theme.palette.primary.main,.08);
    const BLUE_ANNOTATION_COLOR=theme.palette.primary.main;

    const svgData=useMemo(()=>{
        if(validationError)return null;

        const geometry=buildProfileGeometry(profile);
        return prepareSvgLayers(geometry,profile,containerSize);
    },[profile,containerSize,validationError]);

    const renderDrawing=()=>{
        if(validationError){
            return(
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
            );
        }

        if(!svgData)return null;

        return(
            <svg
                viewBox={svgData.viewBox}
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid meet"
            >
                <BendProfileRender
                    data={svgData.activeData}
                    strokeColor={ACTIVE_LINE_COLOR}
                    fillColor={ACTIVE_FILL_COLOR}
                    annotationColor={ACTIVE_ANNOTATION_COLOR}
                />

                {svgData.ghostData&&(
                    <BendProfileRender
                        data={svgData.ghostData}
                        strokeColor={GHOST_LINE_COLOR}
                        fillColor={GHOST_FILL_COLOR}
                        annotationColor={GHOST_ANNOTATION_COLOR}
                        isGhost
                    />
                )}

                {svgData.blueData&&(
                    <BendProfileRender
                        data={svgData.blueData}
                        strokeColor={BLUE_LINE_COLOR}
                        fillColor={BLUE_FILL_COLOR}
                        annotationColor={BLUE_ANNOTATION_COLOR}
                    />
                )}
            </svg>
        );
    };

    const renderParameters=()=>(
        <>
            <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                    mt:1,
                    pt:1,
                    borderTop:"1px dashed",
                    borderColor:"divider"
                }}
            >
                <Typography variant="caption" color="text.secondary">
                    Thickness:
                </Typography>

                <Typography
                    variant="caption"
                    fontWeight="600"
                    color="text.primary"
                >
                    {profile.thickness!==undefined
                        ?`${profile.thickness.toFixed(2)} mm`
                        :"—"
                    }
                </Typography>

                <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{mx:.5}}
                >
                    •
                </Typography>

                <Typography variant="caption" color="text.secondary">
                    Blank Length:
                </Typography>

                <Typography
                    variant="caption"
                    fontWeight="600"
                    color="text.primary"
                >
                    {blankLength!==null
                        ?`${blankLength.toFixed(2)} mm`
                        :"—"
                    }
                </Typography>
            </Stack>

            {machineParams&&(
                <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                        mt:1,
                        pt:1,
                        borderTop:"1px dashed",
                        borderColor:"divider"
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        Stop:
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight="600"
                        color="text.primary"
                    >
                        {machineParams.stopPosition.toFixed(2)} mm
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{mx:.5}}
                    >
                        •
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                        Angle:
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight="600"
                        color="text.primary"
                    >
                        {machineParams.bendAngle.toFixed(2)}°
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{mx:.5}}
                    >
                        •
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                        Gap:
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight="600"
                        color="text.primary"
                    >
                        {machineParams.gapFolding.toFixed(2)} mm
                    </Typography>
                </Stack>
            )}
        </>
    );

    if(!svgData&&!validationError)return null;


    const handlePrint=()=>{
    const printElement=document.querySelector(".fullscreen-print-area");
    if(!printElement)return;

    const svg=printElement.querySelector("svg");
    if(!svg)return;

    const svgClone=svg.cloneNode(true);

    svgClone.removeAttribute("height");
    svgClone.setAttribute("width","auto");
    svgClone.setAttribute("preserveAspectRatio","xMidYMid meet");

    const parameters=[
        ...printElement.querySelectorAll(":scope > .MuiStack-root")
    ]
        .map(stack=>stack.innerText.trim())
        .filter(Boolean);

    const iframe=document.createElement("iframe");

    Object.assign(iframe.style,{
        position:"fixed",
        right:"0",
        bottom:"0",
        width:"1px",
        height:"1px",
        border:"0",
        opacity:"0",
        pointerEvents:"none"
    });

    document.body.appendChild(iframe);

    const doc=iframe.contentDocument;

    doc.open();
    doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
        <title>Bend Profile</title>

    <style>
        @page{
        margin:10mm;
    }

        *{
        box-sizing:border-box;
    }

        html,
        body{
        margin:0;
        padding:0;
        width:100%;
        background:#fff;
    }

        body{
        font-family:Roboto,Helvetica,Arial,sans-serif;
        color:#000;
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
    }

        .print-page{
        width:100%;
        margin:0;
        padding:0; 
    }

        .print-title{
        margin:0 0 4mm;
        font-size:12pt;
        line-height:1.2;
        color:#555;
    }

        .print-drawing{
        width:100%;
        display:flex;
        justify-content:center;
        align-items:center;
        margin:0 0 4mm;
        padding:0;
    }

        .print-drawing svg{
        display:block;
        width:auto;
        height:auto;
        max-width:100%;
        max-height:calc(100vh - 55mm);
        margin:0 auto;
    }

        .print-parameters{
        width:100%;
        font-size:9pt;
        line-height:1.2;
    }

        .print-row{
        margin:1mm 0;
        white-space:nowrap;
    }
    </style>
</head>

    <body>
    <div class="print-page">
        <div class="print-title">
            Bend Profile (Geometric Drawing)
        </div>

        <div class="print-drawing">
            ${svgClone.outerHTML}
        </div>

        <div class="print-parameters">
            ${parameters.map(text=>`
                        <div class="print-row">
                            ${text.replace(/\n/g," ")}
                        </div>
                    `).join("")}
        </div>
    </div>
    </body>
</html>
    `);

    doc.close();

    setTimeout(()=>{
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        setTimeout(()=>{
            iframe.remove();
        },1000);
    },300);
};



    return (
        <>
            {/* ОСНОВНАЯ КАРТОЧКА НА СТРАНИЦЕ */}
            <Paper elevation={1} sx={{ mt: 2, p: 2, position: "relative" }}>
                <Typography
                    variant="subtitle1"
                    fontWeight="500"
                    color="text.secondary"
                    sx={{ mb: 1, pr: 5 }}
                >
                    Bend Profile (Geometric Drawing)
                </Typography>

                <IconButton
                    size="small"
                    onClick={() => setFullScreen(true)}
                    title="Full screen"
                    sx={{
                        color: "text.secondary",
                        position: "absolute",
                        top: 12,
                        right: 12
                    }}
                >
                    <FullscreenIcon fontSize="small" />
                </IconButton>

                <Box
                    ref={containerRef}
                    sx={{
                        width: "100%",
                        height: "65vh",
                        minHeight: 500,
                        maxHeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden"
                    }}
                >
                    {renderDrawing()}
                </Box>

                {renderParameters()}
            </Paper>

            {/* ПОЛНОЭКРАННЫЙ ДИАЛОГ */}
            <Dialog
                fullScreen
                open={fullScreen}
                onClose={() => setFullScreen(false)}
            >
                <Toolbar sx={{ minHeight: "56px!important", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => setFullScreen(false)}>
                        Back
                    </Button>

                    <Typography sx={{ ml: 2, fontWeight: 500, color: "text.secondary" }}>
                        Bend Profile
                    </Typography>

                    <Box sx={{ flex: 1 }} />

                    <Button
                        variant="contained"
                        startIcon={<PrintIcon />}
                        onClick={handlePrint}
                    >
                        Print
                    </Button>
                </Toolbar>

                <Box sx={{ flex: 1, minHeight: 0, p: { xs: 1, sm: 2 }, display: "flex", flexDirection: "column" }}>
                    <Paper
                        className="fullscreen-print-area"
                        elevation={1}
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            p: 2,
                            display: "flex",
                            flexDirection: "column"
                        }}
                    >
                        <Typography variant="subtitle1" fontWeight="500" color="text.secondary" sx={{ mb: 1 }}>
                            Bend Profile (Geometric Drawing)
                        </Typography>

                        {/* Обернули в класс drawing-container для корректных стилей в iframe */}
                        <Box className="drawing-container" sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            {renderDrawing()}
                        </Box>

                        {renderParameters()}
                    </Paper>
                </Box>
            </Dialog>
        </>
    );



};

export default ProfileGeometryPreview;
