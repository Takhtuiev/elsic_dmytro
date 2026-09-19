import React,{useEffect,useMemo} from "react";
import {
    Box,
    Paper,
    Typography,
    Radio,
    Divider
} from "@mui/material";


const physicalProps=[
    {
        key:"density",
        label:"Density",
        unit:"kg/m³",
        color:"#7b1fa2"
    },
    {
        key:"thermalConductivity",
        label:"Thermal conductivity",
        unit:"W/(m·K)",
        color:"#0288d1"
    },
    {
        key:"specificHeat",
        label:"Specific heat",
        unit:"J/(kg·K)",
        color:"#2e7d32"
    }
];


const surfaceProps=[
    {
        key:"emissivity",
        label:"Emissivity",
        unit:"",
        color:"#f57c00"
    },
    {
        key:"surfaceReflectance",
        label:"Surface reflectance",
        unit:"",
        color:"#757575"
    }
];


const tempProps=[
    {
        key:"glassTransitionTemp",
        label:"Glass transition temp.",
        unit:"°C",
        color:"#0288d1"
    },
    {
        key:"minFormingTemp",
        label:"Min. forming temp.",
        unit:"°C",
        color:"#2e7d32"
    },
    {
        key:"maxFormingTemp",
        label:"Max. forming temp.",
        unit:"°C",
        color:"#2e7d32"
    },
    {
        key:"decompositionTemp",
        label:"Decomposition temp.",
        unit:"°C",
        color:"#d32f2f"
    }
];


const bendingProps=[
    {
        key:"kFactor",
        label:"K-factor",
        unit:"",
        color:"#6a1b9a"
    }
];


const MaterialContent=({
                           value,
                           materials={},
                           onChange
                       })=>{

    const materialEntries=useMemo(
        ()=>Object.entries(materials),
        [materials]
    );


    const selectedIndex=useMemo(
        ()=>materialEntries.findIndex(
            ([,item])=>item===value
        ),
        [materialEntries,value]
    );


    useEffect(()=>{
        const handleKeyDown=event=>{

            if(!materialEntries.length)
                return;

            if(
                event.key!=="ArrowDown"&&
                event.key!=="ArrowUp"
            ){
                return;
            }

            event.preventDefault();

            let nextIndex;

            if(event.key==="ArrowDown"){
                nextIndex=
                    selectedIndex<
                    materialEntries.length-1
                        ?selectedIndex+1
                        :0;
            }else{
                nextIndex=
                    selectedIndex>0
                        ?selectedIndex-1
                        :materialEntries.length-1;
            }

            const [
                nextKey,
                nextMaterial
            ]=materialEntries[nextIndex];

            if(!nextMaterial)
                return;

            onChange?.(nextMaterial);

            requestAnimationFrame(()=>{
                document
                    .getElementById(
                        `mat-card-${nextKey}`
                    )
                    ?.scrollIntoView({
                        block:"nearest",
                        behavior:"smooth"
                    });
            });
        };


        window.addEventListener(
            "keydown",
            handleKeyDown
        );


        return()=>{
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    },[
        selectedIndex,
        materialEntries,
        onChange
    ]);


    const renderPropRow=p=>{

        if(
            value?.[p.key]===undefined||
            value?.[p.key]===null
        ){
            return null;
        }

        return(
            <Box
                key={p.key}
                sx={{
                    display:"flex",
                    justifyContent:"space-between",
                    alignItems:"center",
                    borderBottom:"1px dashed",
                    borderColor:"divider"
                }}
            >

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display:"flex",
                        alignItems:"center",
                        gap:.75,
                        p:.25,
                        lineHeight:1.15
                    }}
                >
                    <span style={{color:p.color}}>
                        ●
                    </span>

                    {p.label}
                </Typography>


                <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{
                        p:.25,
                        lineHeight:1.15
                    }}
                >
                    {value[p.key]} {p.unit}
                </Typography>

            </Box>
        );
    };


    return(
        <Box
            sx={{
                p:0,
                display:"flex",
                flexDirection:{
                    xs:"column",
                    md:"row"
                },
                height:{
                    xs:"auto",
                    md:"400px"
                },
                minHeight:{
                    md:"400px"
                },
                overflow:{
                    xs:"visible",
                    md:"hidden"
                }
            }}
        >

            {/* MATERIAL LIST */}

            <Box
                sx={{
                    flex:1,
                    minHeight:{
                        xs:"auto",
                        md:"20rem"
                    },
                    display:"flex",
                    flexDirection:"column",
                    borderRight:{
                        md:"1px solid"
                    },
                    borderBottom:{
                        xs:"1px solid",
                        md:"none"
                    },
                    borderColor:"divider",
                    p:2,
                    overflow:"visible"
                }}
            >

                <Box
                    sx={{
                        display:"flex",
                        flexDirection:"column",
                        gap:1,
                        overflowY:{
                            xs:"visible",
                            md:"auto"
                        },
                        minHeight:0
                    }}
                >

                    {materialEntries.map(
                        ([key,item])=>{

                            const isSel=
                                item===value;

                            return(
                                <Paper
                                    key={key}
                                    id={`mat-card-${key}`}
                                    variant="outlined"
                                    onClick={()=>
                                        onChange?.(item)
                                    }
                                    sx={{
                                        p:1.5,
                                        display:"flex",
                                        alignItems:"center",
                                        cursor:"pointer",
                                        borderRadius:1.5,
                                        borderColor:
                                            isSel
                                                ?"primary.main"
                                                :"divider",
                                        bgcolor:
                                            isSel
                                                ?"action.selected"
                                                :"background.paper",
                                        "&:hover":{
                                            bgcolor:
                                                "action.hover"
                                        }
                                    }}
                                >

                                    <Radio
                                        checked={isSel}
                                        size="small"
                                        sx={{
                                            p:0,
                                            mr:1
                                        }}
                                    />

                                    <Typography
                                        variant="body2"
                                        fontWeight={
                                            isSel
                                                ?600
                                                :400
                                        }
                                    >
                                        {item.name}
                                    </Typography>

                                </Paper>
                            );
                        }
                    )}

                </Box>

            </Box>


            {/* PROPERTIES */}

            <Box
                sx={{
                    flex:1,
                    minHeight:{
                        xs:"auto",
                        md:"20rem"
                    },
                    bgcolor:"background.default",
                    p:2,
                    display:"flex",
                    flexDirection:"column",
                    justifyContent:
                        value
                            ?"flex-start"
                            :"center",
                    overflow:"visible"
                }}
            >

                {value?(
                    <>

                        <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{
                                mb:1,
                                lineHeight:1.2
                            }}
                        >
                            {value.name}
                        </Typography>


                        <Box
                            sx={{
                                display:"flex",
                                flexDirection:"column",
                                gap:.5
                            }}
                        >

                            {physicalProps.map(
                                renderPropRow
                            )}


                            <Divider
                                sx={{
                                    my:.5,
                                    borderStyle:"dashed"
                                }}
                            />


                            {surfaceProps.map(
                                renderPropRow
                            )}


                            <Divider
                                sx={{
                                    my:.5,
                                    borderStyle:"dashed"
                                }}
                            />


                            {tempProps.map(
                                renderPropRow
                            )}


                            <Divider
                                sx={{
                                    my:.5,
                                    borderStyle:"dashed"
                                }}
                            />


                            {bendingProps.map(
                                renderPropRow
                            )}

                        </Box>

                    </>
                ):(
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        align="center"
                    >
                        Select a material from the list to view its properties
                    </Typography>
                )}

            </Box>

        </Box>
    );
};


export default MaterialContent;