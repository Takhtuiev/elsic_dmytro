import React,{useEffect,useState} from "react";
import {
    Box,
    Paper,
    Typography,
    Radio,
    Divider,
    TextField,
    InputAdornment,
    FormControlLabel,
    Switch
} from "@mui/material";


const targetTypes=[
    {
        key:"minTemperature",
        label:"Minimum temperature",
        unit:"°C"
    },
    {
        key:"surfaceTemperature",
        label:"Surface temperature",
        unit:"°C"
    },
    {
        key:"time",
        label:"Time",
        unit:"s"
    }
];


const environmentProps=[
    {
        key:"ambientTemperatureC",
        label:"Ambient temperature",
        unit:"°C"
    },
    {
        key:"ambientRadiationTemperatureC",
        label:"Ambient radiation temperature",
        unit:"°C"
    },
    {
        key:"initialTemperatureC",
        label:"Initial temperature",
        unit:"°C"
    },
    {
        key:"maxTimeSeconds",
        label:"Maximum simulation time",
        unit:"s"
    },
    {
        key:"cooldownTimeSeconds",
        label:"Cooldown time",
        unit:"s"
    }
];


const SimulationContent=({
                             value={},
                             onChange
                         })=>{
    const [linkTemperatures,setLinkTemperatures]=useState(true);

    useEffect(()=>{
        const ambient=
            value?.ambientTemperatureC??20;

        const radiation=
            value?.ambientRadiationTemperatureC??20;

        const initial=
            value?.initialTemperatureC??20;

        setLinkTemperatures(
            ambient===radiation &&
            ambient===initial
        );
    },[value]);


    const targetType=
        value?.target?.type??"minTemperature";

    const targetValue=
        value?.target?.value??120;

    const target=
        targetTypes.find(
            item=>item.key===targetType
        )||targetTypes[0];


    const handleTargetTypeChange=type=>{
        onChange?.({
            ...value,
            target:{
                ...value.target,
                type
            }
        });
    };


    const handleTargetValueChange=event=>{
        const nextValue=
            event.target.value===""
                ?""
                :Number(event.target.value);

        onChange?.({
            ...value,
            target:{
                ...value.target,
                type:targetType,
                value:nextValue
            }
        });
    };


    const handleTemperatureChange=key=>event=>{
        const nextValue=
            event.target.value===""
                ?""
                :Number(event.target.value);

        if(
            linkTemperatures &&
            key==="ambientTemperatureC"
        ){
            onChange?.({
                ...value,
                ambientTemperatureC:nextValue,
                ambientRadiationTemperatureC:nextValue,
                initialTemperatureC:nextValue
            });

            return;
        }

        onChange?.({
            ...value,
            [key]:nextValue
        });
    };


    const handleNumberChange=key=>event=>{
        const nextValue=
            event.target.value===""
                ?""
                :Number(event.target.value);

        onChange?.({
            ...value,
            [key]:nextValue
        });
    };


    const handleLinkChange=event=>{
        const checked=event.target.checked;

        setLinkTemperatures(checked);

        if(checked){
            const ambient=
                value?.ambientTemperatureC??20;

            onChange?.({
                ...value,
                ambientRadiationTemperatureC:ambient,
                initialTemperatureC:ambient
            });
        }
    };


    return(
        <Box
            sx={{
                p:0,
                display:"flex",
                flexDirection:{xs:"column",md:"row"},
                minHeight:{md:"400px"}
            }}
        >

            <Box
                sx={{
                    flex:1,
                    minHeight:{xs:"auto",md:"20rem"},
                    display:"flex",
                    flexDirection:"column",
                    borderRight:{md:"1px solid"},
                    borderBottom:{
                        xs:"1px solid",
                        md:"none"
                    },
                    borderColor:"divider",
                    p:2
                }}
            >

                <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{mb:1}}
                >
                    Target
                </Typography>

                <Box
                    sx={{
                        display:"flex",
                        flexDirection:"column",
                        gap:.5
                    }}
                >

                    {targetTypes.map(item=>{

                        const isSel=
                            targetType===item.key;

                        return(
                            <Paper
                                key={item.key}
                                variant="outlined"
                                onClick={()=>
                                    handleTargetTypeChange(
                                        item.key
                                    )
                                }
                                sx={{
                                    p:1,
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
                                        isSel?600:400
                                    }
                                >
                                    {item.label}
                                </Typography>

                            </Paper>
                        );
                    })}

                </Box>

                <Divider
                    sx={{
                        my:2,
                        borderStyle:"dashed"
                    }}
                />

                <TextField
                    label="Target value"
                    value={targetValue}
                    onChange={
                        handleTargetValueChange
                    }
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{
                        htmlInput:{
                            min:0
                        },
                        input:{
                            endAdornment:(
                                <InputAdornment position="end">
                                    {target.unit}
                                </InputAdornment>
                            )
                        }
                    }}
                />

            </Box>


            <Box
                sx={{
                    flex:1,
                    minHeight:{xs:"auto",md:"20rem"},
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

                <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{mb:1}}
                >
                    Environment
                </Typography>

                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={linkTemperatures}
                            onChange={
                                handleLinkChange
                            }
                        />
                    }
                    label="Link temperatures"
                    sx={{mb:2}}
                />

                <Box
                    sx={{
                        display:"flex",
                        flexDirection:"column",
                        gap:2
                    }}
                >

                    {environmentProps.map(item=>(
                        <TextField
                            key={item.key}
                            label={item.label}
                            value={
                                value?.[item.key]??""
                            }
                            onChange={
                                item.key==="ambientTemperatureC" ||
                                item.key==="ambientRadiationTemperatureC" ||
                                item.key==="initialTemperatureC"
                                    ?handleTemperatureChange(
                                        item.key
                                    )
                                    :handleNumberChange(
                                        item.key
                                    )
                            }
                            type="number"
                            size="small"
                            fullWidth
                            disabled={
                                linkTemperatures &&
                                (
                                    item.key===
                                    "ambientRadiationTemperatureC" ||
                                    item.key===
                                    "initialTemperatureC"
                                )
                            }
                            slotProps={{
                                htmlInput:{
                                    min:0
                                },
                                input:{
                                    endAdornment:(
                                        <InputAdornment
                                            position="end"
                                        >
                                            {item.unit}
                                        </InputAdornment>
                                    )
                                }
                            }}
                        />
                    ))}

                </Box>

            </Box>

        </Box>
    );
};


export default SimulationContent;