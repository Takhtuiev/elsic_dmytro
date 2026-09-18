import React,{useEffect,useState,forwardRef} from "react";
import {
    Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,
    Paper,Typography,Radio,Divider,Slide
} from "@mui/material";

const Transition=forwardRef(function Transition(props,ref){
    return <Slide direction="up" ref={ref} {...props}>{props.children}</Slide>;
});

const heaterProps=[
    {key:"regulatorTemperatureC",label:"Regulator temperature",unit:"°C"},
    {key:"heaterTemperatureFactor",label:"Temperature factor",unit:""},
    {key:"heaterEmissivity",label:"Heater emissivity",unit:""},
    {key:"boxEmissivity",label:"Box emissivity",unit:""},
    {key:"viewFactor",label:"View factor",unit:""},
    {key:"radiationGain",label:"Radiation gain",unit:""},
    {key:"convectiveHeatTransferCoefficient",label:"Heat transfer coefficient",unit:"W/(m²·K)"},
    {key:"boxEfficiency",label:"Box efficiency",unit:""}
];

const MachineDialog=({
    open,
    machineKey,
    machines={},
    onSelect,
    onClose
})=>{
    const [selectedKey,setSelectedKey]=useState(machineKey);
    const machineKeys=Object.keys(machines);

    useEffect(()=>{
        if(open)setSelectedKey(machineKey);
    },[open,machineKey]);

    useEffect(()=>{
        if(!open)return;

        const handleKeyDown=event=>{
            const currentIndex=machineKeys.indexOf(selectedKey);

            if(event.key==="Enter"&&selectedKey){
                event.preventDefault();
                onSelect(selectedKey);
            }else if(event.key==="ArrowDown"){
                event.preventDefault();

                const nextIndex=
                    currentIndex<machineKeys.length-1?currentIndex+1:0;

                const nextKey=machineKeys[nextIndex];

                if(nextKey){
                    setSelectedKey(nextKey);
                    document
                        .getElementById(`machine-card-${nextKey}`)
                        ?.scrollIntoView({
                            block:"nearest",
                            behavior:"smooth"
                        });
                }
            }else if(event.key==="ArrowUp"){
                event.preventDefault();

                const prevIndex=
                    currentIndex>0?currentIndex-1:machineKeys.length-1;

                const prevKey=machineKeys[prevIndex];

                if(prevKey){
                    setSelectedKey(prevKey);
                    document
                        .getElementById(`machine-card-${prevKey}`)
                        ?.scrollIntoView({
                            block:"nearest",
                            behavior:"smooth"
                        });
                }
            }
        };

        window.addEventListener("keydown",handleKeyDown);
        return()=>window.removeEventListener("keydown",handleKeyDown);
    },[open, selectedKey, onSelect, machineKeys]);

    const current=machines[selectedKey];

    const formatValue=(value,unit="")=>{
        if(value===undefined||value===null)return "—";
        return `${value}${unit?` ${unit}`:""}`;
    };

    const renderHeaterTable=()=>{
        const top=current?.heaters?.[0];
        const bottom=current?.heaters?.[1];

        return(
            <Box sx={{width:"100%"}}>
                <Box
                    sx={{
                        display:"grid",
                        gridTemplateColumns:"1.3fr 1fr 1fr"
                    }}
                >
                    <Box
                        sx={{
                            p:.25,
                            borderBottom:"1px solid",
                            borderColor:"divider"
                        }}
                    />

                    {["Top heater","Bottom heater"].map(title=>(
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
                                {formatValue(top?.[p.key],p.unit)}
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
                                {formatValue(bottom?.[p.key],p.unit)}
                            </Typography>
                        </React.Fragment>
                    ))}
                </Box>
            </Box>
        );
    };

    return(
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            slots={{transition:Transition}}
            sx={{
                "& .MuiDialog-container":{
                    overflowY:"auto",
                    alignItems:{xs:"flex-start",sm:"center"},
                    py:{xs:0,sm:2}
                },

                "& .MuiDialog-paper":{
                    width:"100%",
                    m:{xs:0,sm:2},
                    maxHeight:{xs:"none",sm:"calc(100% - 32px)"},
                    borderRadius:{xs:0,sm:2}
                }
            }}
        >
            <DialogTitle sx={{fontWeight:600,pb:1}}>
                Select Machine
            </DialogTitle>

            <DialogContent
                dividers
                sx={{
                    p:0,
                    display:"flex",
                    flexDirection:{xs:"column",md:"row"},
                    height:{xs:"auto",md:"400px"},
                    minHeight:{md:"400px"},
                    overflow:{xs:"visible",md:"hidden"}
                }}
            >
                <Box
                    sx={{
                        flex:1,
                        minHeight:{xs:"auto",md:"20rem"},
                        display:"flex",
                        flexDirection:"column",
                        borderRight:{md:"1px solid"},
                        borderBottom:{xs:"1px solid",md:"none"},
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
                            overflowY:{xs:"visible",md:"auto"},
                            minHeight:0
                        }}
                    >
                        {Object.entries(machines).map(([key,item])=>{
                            const isSel=key===selectedKey;

                            return(
                                <Paper
                                    key={key}
                                    id={`machine-card-${key}`}
                                    variant="outlined"
                                    onClick={()=>setSelectedKey(key)}
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
                                            bgcolor:"action.hover"
                                        }
                                    }}
                                >
                                    <Radio
                                        checked={isSel}
                                        size="small"
                                        sx={{p:0,mr:1}}
                                    />

                                    <Typography
                                        variant="body2"
                                        fontWeight={isSel?600:400}
                                    >
                                        {item.name}
                                    </Typography>
                                </Paper>
                            );
                        })}
                    </Box>
                </Box>

                <Box
                    sx={{
                        flex:1,
                        minHeight:{xs:"auto",md:"20rem"},
                        bgcolor:"background.default",
                        p:2,
                        display:"flex",
                        flexDirection:"column",
                        overflow:{xs:"visible",md:"auto"}
                    }}
                >
                    {current?(
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
                                {current.name}
                            </Typography>

                            <Box
                                sx={{
                                    display:"flex",
                                    justifyContent:"space-between",
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
                                    {formatValue(current.rTool,"mm")}
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
                                Select a machine from the list to view its
                                properties
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions
                sx={{
                    p:2,
                    bgcolor:"background.paper"
                }}
            >
                <Button
                    onClick={onClose}
                    color="inherit"
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    disabled={!selectedKey}
                    onClick={()=>onSelect(selectedKey)}
                    disableElevation
                    sx={{borderRadius:1.5}}
                >
                    Select
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MachineDialog;
