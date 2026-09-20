import React,{useEffect,useState}from"react";
import{
    Box,
    Typography,
    Radio,
    TextField,
    InputAdornment,
    FormControlLabel,
    Switch
}from"@mui/material";

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
        key:"ambientC",
        label:"Ambient temperature",
        unit:"°C"
    },
    {
        key:"ambientRadiationC",
        label:"Ambient radiation temperature",
        unit:"°C"
    },
    {
        key:"initialC",
        label:"Initial temperature",
        unit:"°C"
    }
];

const SimulationContent=({
    value={},
    onChange
})=>{
    const [linkTemperatures,setLinkTemperatures]=useState(true);

    const temperatures=value?.temperatures||{};
    const cooling=value?.cooling||{};

    useEffect(()=>{
        const ambient=temperatures.ambientC??20;
        const radiation=temperatures.ambientRadiationC??20;
        const initial=temperatures.initialC??20;

        setLinkTemperatures(
            ambient===radiation&&
            ambient===initial
        );
    },[
        temperatures.ambientC,
        temperatures.ambientRadiationC,
        temperatures.initialC
    ]);

    const targetType=
        value?.target?.type??"minTemperature";

    const targetValue=
        value?.target?.value??120;

    const target=
        targetTypes.find(
            item=>item.key===targetType
        )||targetTypes[0];

    const stopAtMaxTemperature=
        value?.stopAtMaxTemperature??true;

    const maxTimeSeconds=
        value?.maxTimeSeconds??600;

    const cooldownTimeSeconds=
        cooling.timeSeconds??0;

    const coolingH=
        cooling.convectiveHeatTransferCoefficient??8;

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

    const handleStopAtMaxTemperatureChange=event=>{
        onChange?.({
            ...value,
            stopAtMaxTemperature:event.target.checked
        });
    };

    const handleTemperatureChange=key=>event=>{
        const nextValue=
            event.target.value===""
                ?""
                :Number(event.target.value);

        if(
            linkTemperatures&&
            key==="ambientC"
        ){
            onChange?.({
                ...value,
                temperatures:{
                    ...temperatures,
                    ambientC:nextValue,
                    ambientRadiationC:nextValue,
                    initialC:nextValue
                }
            });

            return;
        }

        onChange?.({
            ...value,
            temperatures:{
                ...temperatures,
                [key]:nextValue
            }
        });
    };

    const handleMaxTimeChange=event=>{
        const nextValue=
            event.target.value===""
                ?""
                :Number(event.target.value);

        onChange?.({
            ...value,
            maxTimeSeconds:nextValue
        });
    };

    const handleCooldownTimeChange=event=>{
        const nextValue=
            event.target.value===""
                ?""
                :Number(event.target.value);

        onChange?.({
            ...value,
            cooling:{
                ...cooling,
                timeSeconds:nextValue
            }
        });
    };

    const handleCoolingHChange=event=>{
        const nextValue=
            event.target.value===""
                ?""
                :Number(event.target.value);

        onChange?.({
            ...value,
            cooling:{
                ...cooling,
                convectiveHeatTransferCoefficient:nextValue
            }
        });
    };

    const handleLinkChange=event=>{
        const checked=event.target.checked;

        setLinkTemperatures(checked);

        if(checked){
            const ambient=
                temperatures.ambientC??20;

            onChange?.({
                ...value,
                temperatures:{
                    ...temperatures,
                    ambientC:ambient,
                    ambientRadiationC:ambient,
                    initialC:ambient
                }
            });
        }
    };

    return(
        <Box
            sx={{
                p:2,
                display:"flex",
                flexDirection:{xs:"column",md:"row"},
                gap:2
            }}
        >

            {/* LEFT */}

            <Box
                sx={{
                    flex:1,
                    display:"flex",
                    flexDirection:"column",
                    gap:1.5
                }}
            >

                {/* TARGET */}

                <Box
                    sx={{
                        border:1,
                        borderColor:"divider",
                        borderRadius:2,
                        p:2,
                        display:"flex",
                        flexDirection:"column",
                        gap:2
                    }}
                >

                    <Box
                        sx={{
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"space-between",
                            gap:2
                        }}
                    >

                        <Typography
                            variant="subtitle1"
                            fontWeight={700}
                        >
                            Target
                        </Typography>

                        <TextField
                            label="Value"
                            value={targetValue}
                            onChange={handleTargetValueChange}
                            type="number"
                            size="small"
                            sx={{width:140}}
                            slotProps={{
                                htmlInput:{min:0},
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
                            display:"flex",
                            flexDirection:"column",
                            gap:.75
                        }}
                    >

                        {targetTypes.map(item=>{

                            const isSel=
                                targetType===item.key;

                            return(
                                <Box
                                    key={item.key}
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
                                        border:1,
                                        borderRadius:1.5,
                                        borderColor:isSel
                                            ?"primary.main"
                                            :"divider",
                                        bgcolor:isSel
                                            ?"action.selected"
                                            :"transparent",
                                        "&:hover":{
                                            bgcolor:"action.hover"
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

                                </Box>
                            );
                        })}

                    </Box>

                </Box>

                {/* STOP CONDITION */}

                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={stopAtMaxTemperature}
                            onChange={
                                handleStopAtMaxTemperatureChange
                            }
                        />
                    }
                    label="Stop at maximum temperature"
                    sx={{
                        mx:1,
                        my:0
                    }}
                />

            </Box>

            {/* RIGHT */}

            <Box
                sx={{
                    flex:1,
                    display:"flex",
                    flexDirection:"column",
                    gap:2
                }}
            >

                {/* TEMPERATURES */}

                <Box
                    sx={{
                        border:1,
                        borderColor:"divider",
                        borderRadius:2,
                        p:2
                    }}
                >

                    <Box
                        sx={{
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"space-between",
                            mb:1.5
                        }}
                    >

                        <Typography
                            variant="body2"
                            fontWeight={600}
                        >
                            Temperatures
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
                            label="Link"
                            sx={{
                                m:0,
                                "& .MuiFormControlLabel-label":{
                                    fontSize:"0.8rem"
                                }
                            }}
                        />

                    </Box>

                    <Box
                        sx={{
                            display:"flex",
                            flexDirection:"column",
                            gap:1.5
                        }}
                    >

                        {environmentProps.map(item=>(
                            <TextField
                                key={item.key}
                                label={item.label}
                                value={
                                    temperatures[item.key]??""
                                }
                                onChange={
                                    handleTemperatureChange(
                                        item.key
                                    )
                                }
                                type="number"
                                size="small"
                                fullWidth
                                disabled={
                                    linkTemperatures&&
                                    (
                                        item.key===
                                        "ambientRadiationC"||
                                        item.key===
                                        "initialC"
                                    )
                                }
                                slotProps={{
                                    htmlInput:{min:0},
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

                {/* COOLING */}

                <Box
                    sx={{
                        border:1,
                        borderColor:"divider",
                        borderRadius:2,
                        p:2,
                        display:"flex",
                        flexDirection:"column",
                        gap:1.5
                    }}
                >

                    <Typography
                        variant="body2"
                        fontWeight={600}
                    >
                        Cooling
                    </Typography>

                    <TextField
                        label="Cooling time"
                        value={cooldownTimeSeconds}
                        onChange={handleCooldownTimeChange}
                        type="number"
                        size="small"
                        fullWidth
                        slotProps={{
                            htmlInput:{min:0},
                            input:{
                                endAdornment:(
                                    <InputAdornment position="end">
                                        s
                                    </InputAdornment>
                                )
                            }
                        }}
                    />

                    <TextField
                        label="Air convection coefficient"
                        value={coolingH}
                        onChange={handleCoolingHChange}
                        type="number"
                        size="small"
                        fullWidth
                        slotProps={{
                            htmlInput:{min:0},
                            input:{
                                endAdornment:(
                                    <InputAdornment position="end">
                                        W/m²K
                                    </InputAdornment>
                                )
                            }
                        }}
                    />

                </Box>

                {/* MAXIMUM SIMULATION TIME */}

                <TextField
                    label="Maximum simulation time"
                    value={maxTimeSeconds}
                    onChange={handleMaxTimeChange}
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{
                        htmlInput:{min:0},
                        input:{
                            endAdornment:(
                                <InputAdornment position="end">
                                    s
                                </InputAdornment>
                            )
                        }
                    }}
                />

            </Box>

        </Box>
    );
};

export default SimulationContent;
