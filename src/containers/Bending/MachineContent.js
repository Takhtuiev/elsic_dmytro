import React,{useEffect,useMemo} from "react";
import {
    Box,
    Paper,
    Typography,
    Radio,
    Divider
} from "@mui/material";


const heaterProps=[
    {
        key:"regulatorTemperatureC",
        label:"Regulator temperature",
        unit:"°C"
    },
    {
        key:"heaterTemperatureFactor",
        label:"Temperature factor",
        unit:""
    },
    {
        key:"heaterEmissivity",
        label:"Heater emissivity",
        unit:""
    },
    {
        key:"boxEmissivity",
        label:"Box emissivity",
        unit:""
    },
    {
        key:"viewFactor",
        label:"View factor",
        unit:""
    },
    {
        key:"radiationGain",
        label:"Radiation gain",
        unit:""
    },
    {
        key:"convectiveHeatTransferCoefficient",
        label:"Heat transfer coefficient",
        unit:"W/(m²·K)"
    },
    {
        key:"boxEfficiency",
        label:"Box efficiency",
        unit:""
    }
];


const MachineContent=({
                          value,
                          machines={},
                          onChange
                      })=>{

    const machineEntries=useMemo(
        ()=>Object.entries(machines),
        [machines]
    );

    const selectedIndex=useMemo(
        ()=>machineEntries.findIndex(
            ([,item])=>item===value
        ),
        [machineEntries,value]
    );


    useEffect(()=>{
        const handleKeyDown=event=>{

            if(!machineEntries.length)
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
                    machineEntries.length-1
                        ?selectedIndex+1
                        :0;
            }else{
                nextIndex=
                    selectedIndex>0
                        ?selectedIndex-1
                        :machineEntries.length-1;
            }

            const [
                nextKey,
                nextMachine
            ]=machineEntries[nextIndex];

            if(!nextMachine)
                return;

            onChange?.(nextMachine);

            requestAnimationFrame(()=>{
                document
                    .getElementById(
                        `machine-card-${nextKey}`
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
        machineEntries,
        onChange
    ]);


    const selectMachine=item=>{
        onChange?.(item);
    };


    const formatValue=(value,unit="")=>{
        if(value===undefined||value===null)
            return"—";

        return`${value}${unit?` ${unit}`:""}`;
    };


    const renderHeaterTable=()=>{

        const top=value?.heaters?.[0];
        const bottom=value?.heaters?.[1];

        return(
            <Box sx={{width:"100%"}}>
                <Box
                    sx={{
                        display:"grid",
                        gridTemplateColumns:
                            "1.3fr 1fr 1fr"
                    }}
                >

                    <Box
                        sx={{
                            p:.25,
                            borderBottom:"1px solid",
                            borderColor:"divider"
                        }}
                    />

                    {[
                        "Top heater",
                        "Bottom heater"
                    ].map(title=>(
                        <Typography
                            key={title}
                            variant="caption"
                            fontWeight={700}
                            sx={{
                                p:.25,
                                textAlign:"center",
                                borderBottom:"1px solid",
                                borderColor:"divider",
                                lineHeight:1.15
                            }}
                        >
                            {title}
                        </Typography>
                    ))}


                    {heaterProps.map(p=>(
                        <React.Fragment key={p.key}>

                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    p:.25,
                                    borderBottom:"1px dashed",
                                    borderColor:"divider",
                                    lineHeight:1.15
                                }}
                            >
                                {p.label}
                            </Typography>


                            <Typography
                                variant="caption"
                                fontWeight={600}
                                sx={{
                                    p:.25,
                                    textAlign:"center",
                                    borderBottom:"1px dashed",
                                    borderColor:"divider",
                                    lineHeight:1.15
                                }}
                            >
                                {formatValue(
                                    top?.[p.key],
                                    p.unit
                                )}
                            </Typography>


                            <Typography
                                variant="caption"
                                fontWeight={600}
                                sx={{
                                    p:.25,
                                    textAlign:"center",
                                    borderBottom:"1px dashed",
                                    borderColor:"divider",
                                    lineHeight:1.15
                                }}
                            >
                                {formatValue(
                                    bottom?.[p.key],
                                    p.unit
                                )}
                            </Typography>

                        </React.Fragment>
                    ))}

                </Box>
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
                minHeight:{
                    md:"400px"
                }
            }}
        >

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
                    p:2
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

                    {machineEntries.map(
                        ([key,item])=>{

                            const isSel=
                                item===value;

                            return(
                                <Paper
                                    key={key}
                                    id={
                                        `machine-card-${key}`
                                    }
                                    variant="outlined"
                                    onClick={()=>
                                        selectMachine(item)
                                    }
                                    sx={{
                                        p:1.5,
                                        display:"flex",
                                        alignItems:"center",
                                        cursor:"pointer",
                                        borderRadius:1.5,
                                        borderColor:isSel
                                            ?"primary.main"
                                            :"divider",
                                        bgcolor:isSel
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
                    overflow:{
                        xs:"visible",
                        md:"auto"
                    }
                }}
            >

                {value?(
                    <Box
                        sx={{
                            display:"flex",
                            flexDirection:"column",
                            gap:1
                        }}
                    >

                        <Typography
                            variant="subtitle1"
                            fontWeight={700}
                        >
                            {value.name}
                        </Typography>


                        <Box
                            sx={{
                                display:"flex",
                                justifyContent:
                                    "space-between",
                                alignItems:"center",
                                borderBottom:"1px dashed",
                                borderColor:"divider",
                                pb:.25
                            }}
                        >

                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                Tool radius
                            </Typography>

                            <Typography
                                variant="caption"
                                fontWeight={600}
                            >
                                {formatValue(
                                    value.rTool,
                                    "mm"
                                )}
                            </Typography>

                        </Box>


                        <Divider
                            sx={{
                                borderStyle:"dashed"
                            }}
                        />

                        {renderHeaterTable()}

                    </Box>
                ):(
                    <Box
                        sx={{
                            height:"100%",
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"center"
                        }}
                    >

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            align="center"
                        >
                            Select a machine from the list to view
                            its properties
                        </Typography>

                    </Box>
                )}

            </Box>

        </Box>
    );
};


export default MachineContent;