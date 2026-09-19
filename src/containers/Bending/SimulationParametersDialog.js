import React,{useEffect,useState,forwardRef} from "react";
import {
    Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,
    Paper,Typography,Radio,Divider,Slide,TextField,
    InputAdornment,FormControlLabel,Switch
} from "@mui/material";


const Transition=forwardRef(function Transition(props,ref){
    return(
        <Slide
            direction="up"
            ref={ref}
            {...props}
        >
            {props.children}
        </Slide>
    );
});


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


export default function SimulationParametersDialog({
    open,
    onClose,
    value,
    onApply
}){
    const [params,setParams]=useState({
        targetType:"minTemperature",
        targetValue:120,
        ambientTemperatureC:20,
        ambientRadiationTemperatureC:20,
        initialTemperatureC:20,
        maxTimeSeconds:1800,
        cooldownTimeSeconds:10
    });

    const [linkTemperatures,setLinkTemperatures]=useState(true);


    useEffect(()=>{
        if(open){
            const ambient=
                value?.ambientTemperatureC??20;

            const radiation=
                value?.ambientRadiationTemperatureC??20;

            const initial=
                value?.initialTemperatureC??20;

            setParams({
                targetType:
                    value?.target?.type??"minTemperature",

                targetValue:
                    value?.target?.value??120,

                ambientTemperatureC:
                    ambient,

                ambientRadiationTemperatureC:
                    radiation,

                initialTemperatureC:
                    initial,

                maxTimeSeconds:
                    value?.maxTimeSeconds??1800,

                cooldownTimeSeconds:
                    value?.cooldownTimeSeconds??10
            });

            setLinkTemperatures(
                ambient===radiation &&
                ambient===initial
            );
        }
    },[open,value]);


    const target=
        targetTypes.find(
            item=>item.key===params.targetType
        )||targetTypes[0];


    const handleChange=(key,value)=>{
        setParams(prev=>({
            ...prev,
            [key]:value
        }));
    };


    const handleTemperatureChange=key=>event=>{
        const value=event.target.value===""
            ?""
            :Number(event.target.value);

        if(
            linkTemperatures &&
            key==="ambientTemperatureC"
        ){
            setParams(prev=>({
                ...prev,
                ambientTemperatureC:value,
                ambientRadiationTemperatureC:value,
                initialTemperatureC:value
            }));
            return;
        }

        handleChange(key,value);
    };


    const handleNumberChange=key=>event=>{
        const value=event.target.value;

        handleChange(
            key,
            value===""?"":Number(value)
        );
    };


    const handleLinkChange=event=>{
        const checked=event.target.checked;

        if(checked){
            setParams(prev=>({
                ...prev,
                ambientRadiationTemperatureC:
                    prev.ambientTemperatureC,
                initialTemperatureC:
                    prev.ambientTemperatureC
            }));
        }

        setLinkTemperatures(checked);
    };


    const handleApply=()=>{
        onApply?.({
            ...params,

            targetValue:
                Number(params.targetValue),

            ambientTemperatureC:
                Number(params.ambientTemperatureC),

            ambientRadiationTemperatureC:
                Number(params.ambientRadiationTemperatureC),

            initialTemperatureC:
                Number(params.initialTemperatureC),

            maxTimeSeconds:
                Number(params.maxTimeSeconds),

            cooldownTimeSeconds:
                Number(params.cooldownTimeSeconds)
        });

        onClose?.();
    };


    return(
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            scroll="paper"
            slots={{
                transition:Transition
            }}
            slotProps={{
                paper:{
                    sx:{
                        maxHeight:"calc(100vh - 32px)"
                    }
                }
            }}
        >
            <DialogTitle>
                Simulation parameters
            </DialogTitle>


            <DialogContent dividers>

                <Paper
                    variant="outlined"
                    sx={{
                        p:2,
                        mb:2
                    }}
                >
                    <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        sx={{mb:1}}
                    >
                        Target
                    </Typography>


                    <Box
                        sx={{
                            display:"flex",
                            flexDirection:"column"
                        }}
                    >
                        {targetTypes.map(item=>(
                            <Box
                                key={item.key}
                                onClick={()=>
                                    handleChange(
                                        "targetType",
                                        item.key
                                    )
                                }
                                sx={{
                                    display:"flex",
                                    alignItems:"center",
                                    minHeight:40,
                                    cursor:"pointer",
                                    borderRadius:1,
                                    px:.5,
                                    "&:hover":{
                                        bgcolor:"action.hover"
                                    }
                                }}
                            >
                                <Radio
                                    size="small"
                                    checked={
                                        params.targetType===
                                        item.key
                                    }
                                    onChange={()=>
                                        handleChange(
                                            "targetType",
                                            item.key
                                        )
                                    }
                                />

                                <Typography variant="body2">
                                    {item.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>


                    <Divider sx={{my:2}}/>


                    <TextField
                        label="Target value"
                        value={params.targetValue}
                        onChange={handleNumberChange(
                            "targetValue"
                        )}
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
                </Paper>


                <Paper
                    variant="outlined"
                    sx={{
                        p:2
                    }}
                >
                    <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        sx={{mb:2}}
                    >
                        Environment
                    </Typography>


                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={linkTemperatures}
                                onChange={handleLinkChange}
                            />
                        }
                        label="Link temperatures"
                        sx={{mb:1}}
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
                                value={params[item.key]}
                                onChange={
                                    item.key==="ambientTemperatureC" ||
                                    item.key==="ambientRadiationTemperatureC" ||
                                    item.key==="initialTemperatureC"
                                        ?handleTemperatureChange(item.key)
                                        :handleNumberChange(item.key)
                                }
                                type="number"
                                size="small"
                                fullWidth
                                disabled={
                                    linkTemperatures &&
                                    (
                                        item.key==="ambientRadiationTemperatureC" ||
                                        item.key==="initialTemperatureC"
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
                </Paper>

            </DialogContent>


            <DialogActions>
                <Button onClick={onClose}>
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    onClick={handleApply}
                >
                    Apply
                </Button>
            </DialogActions>
        </Dialog>
    );
}
