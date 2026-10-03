import React,{useEffect,useMemo} from "react";
import {
    Box,
    Paper,
    Typography,
    Radio,
    Divider,
    Button,
    List,
    ListItemButton
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import {useDispatch,useSelector} from "react-redux";

import {
    openDialog,
    selectCurrentDialog,
    selectLastReturnedData,
    clearDialogDataReturned
} from "../../Store/dialogSlice";

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
    }
];

const MachineContent=({
                          value={},
                          machines={},
                          onChange
                      })=>{
    const dispatch=useDispatch();

    const currentDialog=useSelector(
        selectCurrentDialog
    );

    const lastReturnedData=useSelector(
        selectLastReturnedData
    );

    const machineEntries=useMemo(
        ()=>Object.entries(machines),
        [machines]
    );

    const selectedIndex=useMemo(
        ()=>machineEntries.findIndex(
            ([,item])=>
                item===value||
                item?.name===value?.name
        ),
        [machineEntries,value]
    );

    useEffect(()=>{
        if(
            lastReturnedData?.dialogType!=="machine-edit"
        ){
            return;
        }

        const updatedMachine=
            lastReturnedData?.data?.value;

        if(updatedMachine){
            onChange?.(updatedMachine);
        }

        dispatch(clearDialogDataReturned());
    },[
        lastReturnedData,
        onChange,
        dispatch
    ]);

    useEffect(()=>{
        const handleKeyDown=(event)=>{
            if(currentDialog||!machineEntries.length){
                return;
            }

            if(
                event.key!=="ArrowDown"&&
                event.key!=="ArrowUp"
            ){
                return;
            }

            event.preventDefault();

            const nextIndex=
                event.key==="ArrowDown"
                    ? selectedIndex<machineEntries.length-1
                        ? selectedIndex+1
                        : 0
                    : selectedIndex>0
                        ? selectedIndex-1
                        : machineEntries.length-1;

            const [nextKey,nextMachine]=
                machineEntries[nextIndex];

            if(!nextMachine){
                return;
            }

            onChange?.(nextMachine);

            document
                .getElementById(
                    `machine-card-${nextKey}`
                )
                ?.scrollIntoView({
                    block:"nearest",
                    behavior:"smooth"
                });
        };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return()=>window.removeEventListener(
            "keydown",
            handleKeyDown
        );
    },[
        currentDialog,
        selectedIndex,
        machineEntries,
        onChange
    ]);

    const formatValue=(value,unit="")=>{
        if(
            value===undefined||
            value===null||
            value===""
        ){
            return "—";
        }

        return `${value}${unit?` ${unit}`:""}`;
    };

    const renderHeaterTable=()=>{
        const top=value?.heaters?.[0];
        const bottom=value?.heaters?.[1];

        return(
            <Box
                sx={{
                    display:"flex",
                    flexDirection:"column",
                    gap:0.75,
                    mt:1
                }}
            >
                <Box
                    sx={{
                        display:"grid",
                        gridTemplateColumns:
                            "1.5fr 1fr 1fr",
                        px:1,
                        pb:0.5,
                        borderBottom:"2px solid",
                        borderColor:"divider"
                    }}
                >
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
                    const topValue=top?.[prop.key];

                    const bottomValue=
                        bottom?.[prop.key]??topValue;

                    return(
                        <Box
                            key={prop.key}
                            sx={{
                                display:"grid",
                                gridTemplateColumns:
                                    "1.5fr 1fr 1fr",
                                alignItems:"center",
                                gap:1.5,
                                borderBottom:"1px solid",
                                borderColor:"divider",
                                py:0.25
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.primary"
                                sx={{fontWeight:500}}
                            >
                                {prop.label}
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                {formatValue(
                                    topValue,
                                    prop.unit
                                )}
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                {formatValue(
                                    bottomValue,
                                    prop.unit
                                )}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        );
    };

    const handleEdit=()=>{
        dispatch(
            openDialog({
                id:"machine-edit",
                dialogType:"machine-edit",
                title:"Edit machine",
                data:{
                    value
                }
            })
        );
    };

    return(
        <Box
            sx={{
                display:"flex",
                flexDirection:{
                    xs:"column",
                    md:"row"
                },
            }}
        >
            <Box
                sx={{
                    flex:"0 0 260px",
                    borderRight:{
                        md:"1px solid"
                    },
                    borderBottom:{
                        xs:"1px solid",
                        md:"none"
                    },
                    borderColor:"divider",
                    p:1.5,
                    bgcolor:"background.default",
                    maxHeight:{
                        md:"500px"
                    },
                    overflowY:"auto"
                }}
            >
                <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{
                        display:"block",
                        mb:1,
                        px:1,
                        letterSpacing:"0.05em"
                    }}
                >
                    AVAILABLE MACHINES ({machineEntries.length})
                </Typography>

                <List
                    disablePadding
                    sx={{
                        display:"flex",
                        flexDirection:"column",
                        gap:0.5
                    }}
                >
                    {machineEntries.map(
                        ([key,item])=>{
                            const isSelected=
                                item===value||
                                item?.name===value?.name;

                            return(
                                <ListItemButton
                                    key={key}
                                    id={`machine-card-${key}`}
                                    onClick={()=>
                                        onChange?.(item)
                                    }
                                    selected={isSelected}
                                    sx={{
                                        p:0.75,
                                        borderRadius:1.5,
                                        border:"1px solid",
                                        borderColor:
                                            isSelected
                                                ? "primary.main"
                                                : "transparent",
                                        "&.Mui-selected":{
                                            bgcolor:
                                                "action.selected",
                                            "&:hover":{
                                                bgcolor:
                                                    "action.selected"
                                            }
                                        }
                                    }}
                                >
                                    <Radio
                                        checked={isSelected}
                                        size="small"
                                        sx={{
                                            p:0,
                                            mr:1
                                        }}
                                    />

                                    <Typography
                                        variant="body2"
                                        fontWeight={
                                            isSelected
                                                ? 600
                                                : 400
                                        }
                                        noWrap
                                    >
                                        {item?.name||key}
                                    </Typography>
                                </ListItemButton>
                            );
                        }
                    )}
                </List>
            </Box>

            <Box
                sx={{
                    flex:1,
                    p:2,
                    display:"flex",
                    flexDirection:"column",
                    bgcolor:"background.paper"
                }}
            >
                {value?.name ? (
                    <Box
                        sx={{
                            display:"flex",
                            flexDirection:"column",
                            gap:1.5,
                            width:"100%"
                        }}
                    >
                        <Box
                            sx={{
                                display:"flex",
                                justifyContent:
                                    "space-between",
                                alignItems:"center",
                                width:"100%",
                                flexWrap:"wrap",
                                gap:1.5
                            }}
                        >
                            <Typography
                                variant="subtitle1"
                                fontWeight={700}
                                noWrap
                                sx={{
                                    letterSpacing:
                                        "-0.01em"
                                }}
                            >
                                {value.name}
                            </Typography>

                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditIcon/>}
                                onClick={handleEdit}
                                sx={{
                                    textTransform:"none"
                                }}
                            >
                                Edit
                            </Button>
                        </Box>

                        <Divider/>

                        <Box sx={{width:"fit-content"}}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    px:1,
                                    py:0.5,
                                    bgcolor:
                                        "background.default",
                                    borderRadius:1.5
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    color="text.primary"
                                    fontWeight={500}
                                >
                                    Tool radius:{" "}
                                    <Box
                                        component="span"
                                        color="text.secondary"
                                        fontWeight={600}
                                    >
                                        {formatValue(
                                            value.rTool,
                                            "mm"
                                        )}
                                    </Box>
                                </Typography>
                            </Paper>
                        </Box>

                        {renderHeaterTable()}
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display:"flex",
                            flexDirection:"column",
                            alignItems:"center",
                            justifyContent:"center",
                            flex:1,
                            py:4,
                            gap:0.5
                        }}
                    >
                        <Typography
                            color="text.secondary"
                            variant="body2"
                            fontWeight={500}
                        >
                            No machine selected
                        </Typography>

                        <Typography
                            color="text.disabled"
                            variant="caption"
                        >
                            Please choose a machine from
                            the left list to view or edit
                            details.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default MachineContent;