import React from "react";
import {
    Box,
    Typography,
    Divider,
    TextField,
    InputAdornment
} from "@mui/material";

const heaterProps=[
    {key:"regulatorTemperatureC",label:"Regulator temperature",unit:"°C"},
    {key:"heaterTemperatureFactor",label:"Temperature factor",unit:""},
    {key:"heaterEmissivity",label:"Heater emissivity",unit:""},
    {key:"viewFactor",label:"View factor",unit:""},
    {key:"radiationGain",label:"Radiation gain",unit:""},
    {key:"convectiveHeatTransferCoefficient",label:"Heat transfer coefficient",unit:"W/(m²·K)"}
];

export default function MachineEditContent({value={},onChange}){
    const handleValueChange=(key)=>(event)=>{
        const nextValue=event.target.value;

        onChange({
            ...value,
            [key]:
                key==="name"
                    ? nextValue
                    : nextValue===""
                        ? ""
                        : Number(nextValue)
        });
    };

    const handleHeaterValueChange=(heaterIndex,key)=>(event)=>{
        const rawValue=event.target.value;

        onChange({
            ...value,
            heaters:(value?.heaters||[]).map(
                (heater,index)=>{
                    if(index!==heaterIndex){
                        return heater;
                    }

                    const nextHeater={...heater};

                    if(rawValue===""){
                        delete nextHeater[key];
                    }else{
                        nextHeater[key]=Number(rawValue);
                    }

                    return nextHeater;
                }
            )
        });
    };

    const top=value?.heaters?.[0];
    const bottom=value?.heaters?.[1];

    return(
        <Box sx={{display:"flex",flexDirection:"column",gap:1.5}}>
            <TextField
                label="Machine name"
                value={value?.name??""}
                onChange={handleValueChange("name")}
                size="small"
                fullWidth
                slotProps={{
                    htmlInput:{
                        style:{
                            padding:"4px 8px",
                            fontWeight:700
                        }
                    }
                }}
            />

            <TextField
                label="Tool radius"
                value={value?.rTool??""}
                onChange={handleValueChange("rTool")}
                type="number"
                size="small"
                sx={{maxWidth:260}}
                slotProps={{
                    htmlInput:{
                        min:0,
                        style:{
                            padding:"4px 8px",
                            fontSize:"0.875rem"
                        }
                    },
                    input:{
                        endAdornment:
                            <InputAdornment position="end">
                                mm
                            </InputAdornment>
                    }
                }}
            />

            <Divider/>

            <Box sx={{
                display:"flex",
                flexDirection:"column",
                gap:0.75
            }}>
                <Box sx={{
                    display:"grid",
                    gridTemplateColumns:"1.5fr 1fr 1fr",
                    px:1,
                    pb:0.5,
                    borderBottom:"2px solid",
                    borderColor:"divider"
                }}>
                    <Typography
                        variant="caption"
                        fontWeight={700}
                        color="text.secondary"
                    >
                        PARAMETER
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight={700}
                        color="primary.main"
                    >
                        TOP HEATER
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight={700}
                        color="secondary.main"
                    >
                        BOTTOM HEATER
                    </Typography>
                </Box>

                {heaterProps.map(prop=>{
                   return(
                        <Box
                            key={prop.key}
                            sx={{
                                display:"grid",
                                gridTemplateColumns:"1.5fr 1fr 1fr",
                                alignItems:"center",
                                gap:1.5,
                                borderBottom:"1px solid",
                                borderColor:"divider",
                                py:0.5
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.primary"
                                sx={{fontWeight:500}}
                            >
                                {prop.label}
                            </Typography>

                            {[0,1].map(index=>{
                                const heaterData=
                                    index===0
                                        ? top
                                        : bottom;

                                return(
                                    <TextField
                                        key={`${index}-${prop.key}`}
                                        value={
                                            heaterData?.[prop.key]??""
                                        }
                                        onChange={
                                            handleHeaterValueChange(
                                                index,
                                                prop.key
                                            )
                                        }
                                        type="number"
                                        size="small"
                                        fullWidth
                                        slotProps={{
                                            htmlInput:{
                                                min:0,
                                                style:{
                                                    padding:"4px 8px",
                                                    fontSize:"0.875rem"
                                                }
                                            },
                                            input:{
                                                endAdornment:
                                                    prop.unit
                                                        ?(
                                                            <InputAdornment position="end">
                                                                {prop.unit}
                                                            </InputAdornment>
                                                        )
                                                        :undefined
                                            }
                                        }}
                                    />
                                );
                            })}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}