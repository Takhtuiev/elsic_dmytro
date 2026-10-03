import React,{useEffect,useMemo}from"react";
import{
    Box,
    Typography,
    Radio,
    Divider,
    Button,
    List,
    ListItemButton
}from"@mui/material";
import EditIcon from"@mui/icons-material/Edit";
import{useDispatch,useSelector}from"react-redux";

import{
    openDialog,
    selectCurrentDialog,
    selectLastReturnedData,
    clearDialogDataReturned
}from"../../Store/dialogSlice";

const physicalProps=[
    {key:"density",label:"Density",unit:"kg/m³",color:"#7b1fa2"},
    {key:"thermalConductivity",label:"Thermal conductivity",unit:"W/(m·K)",color:"#2e7d32"},
    {key:"specificHeat",label:"Specific heat",unit:"J/(kg·K)",color:"#0288d1"}
];

const transitionProps=[
    {key:"tgSpecificHeatJumpFactor",label:"Tg heat capacity jump",unit:"×",color:"#0288d1"},
    {key:"tgTransitionWidthC",label:"Tg transition width",unit:"°C",color:"#0288d1"}
];

const surfaceProps=[
    {key:"emissivity",label:"Emissivity",unit:"",color:"#f57c00"},
    {key:"surfaceReflectance",label:"Surface reflectance",unit:"",color:"#757575"}
];

const tempProps=[
    {key:"glassTransitionTemp",label:"Glass transition temp.",unit:"°C",color:"#0288d1"},
    {key:"minFormingTemp",label:"Min. forming temp.",unit:"°C",color:"#2e7d32"},
    {key:"maxFormingTemp",label:"Max. forming temp.",unit:"°C",color:"#2e7d32"},
    {key:"decompositionTemp",label:"Decomposition temp.",unit:"°C",color:"#d32f2f"}
];

const bendingProps=[
    {key:"kFactor",label:"K-factor",unit:"",color:"#6a1b9a"}
];

const MaterialContent=({
                           value,
                           materials={},
                           onChange
                       })=>{
    const dispatch=useDispatch();

    const currentDialog=useSelector(
        selectCurrentDialog
    );

    const lastReturnedData=useSelector(
        selectLastReturnedData
    );

    const materialEntries=useMemo(
        ()=>Object.entries(materials),
        [materials]
    );

    const selectedIndex=useMemo(
        ()=>materialEntries.findIndex(
            ([,item])=>
                item===value||
                item?.name===value?.name
        ),
        [materialEntries,value]
    );

    useEffect(()=>{
        if(
            lastReturnedData?.dialogType!=="material-edit"
        ){
            return;
        }

        const updatedMaterial=
            lastReturnedData?.data?.value;

        if(updatedMaterial){
            onChange?.(updatedMaterial);
        }

        dispatch(clearDialogDataReturned());
    },[
        lastReturnedData,
        onChange,
        dispatch
    ]);

    useEffect(()=>{
        const handleKeyDown=(event)=>{
            if(currentDialog||!materialEntries.length){
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
                    ?selectedIndex<materialEntries.length-1
                        ?selectedIndex+1
                        :0
                    :selectedIndex>0
                        ?selectedIndex-1
                        :materialEntries.length-1;

            const[
                nextKey,
                nextMaterial
            ]=materialEntries[nextIndex];

            if(!nextMaterial){
                return;
            }

            onChange?.(nextMaterial);

            document
                .getElementById(
                    `material-card-${nextKey}`
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
        materialEntries,
        onChange
    ]);

    const formatValue=(value,unit="")=>{
        if(
            value===undefined||
            value===null||
            value===""
        ){
            return"—";
        }

        return`${value}${unit?` ${unit}`:""}`;
    };

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
                    borderColor:"divider",
                    gap:2
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
                    <span style={{color:p.color}}>●</span>
                    {p.label}
                </Typography>

                <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{
                        p:.25,
                        lineHeight:1.15,
                        textAlign:"right"
                    }}
                >
                    {formatValue(
                        value[p.key],
                        p.unit
                    )}
                </Typography>
            </Box>
        );
    };

    const renderSection=(items,index)=>{
        return(
            <React.Fragment key={index}>
                {index>0&&(
                    <Divider
                        sx={{
                            my:.5,
                            borderStyle:"dashed"
                        }}
                    />
                )}

                {items.map(renderPropRow)}
            </React.Fragment>
        );
    };

    const handleEdit=()=>{
        dispatch(
            openDialog({
                id:"material-edit",
                dialogType:"material-edit",
                title:"Edit material",
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
                }
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
                    AVAILABLE MATERIALS ({materialEntries.length})
                </Typography>

                <List
                    disablePadding
                    sx={{
                        display:"flex",
                        flexDirection:"column",
                        gap:.5
                    }}
                >
                    {materialEntries.map(
                        ([key,item])=>{
                            const isSelected=
                                item===value||
                                item?.name===value?.name;

                            return(
                                <ListItemButton
                                    key={key}
                                    id={`material-card-${key}`}
                                    onClick={()=>
                                        onChange?.(item)
                                    }
                                    selected={isSelected}
                                    sx={{
                                        p:.75,
                                        borderRadius:1.5,
                                        border:"1px solid",
                                        borderColor:
                                            isSelected
                                                ?"primary.main"
                                                :"transparent",
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
                                                ?600
                                                :400
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
                {value?.name?(
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

                        <Box
                            sx={{
                                display:"flex",
                                flexDirection:"column",
                                gap:.5
                            }}
                        >
                            {renderSection(
                                physicalProps,
                                0
                            )}

                            {renderSection(
                                transitionProps,
                                1
                            )}

                            {renderSection(
                                surfaceProps,
                                2
                            )}

                            {renderSection(
                                tempProps,
                                3
                            )}

                            {renderSection(
                                bendingProps,
                                4
                            )}
                        </Box>
                    </Box>
                ):(
                    <Box
                        sx={{
                            display:"flex",
                            flexDirection:"column",
                            alignItems:"center",
                            justifyContent:"center",
                            flex:1,
                            py:4,
                            gap:.5
                        }}
                    >
                        <Typography
                            color="text.secondary"
                            variant="body2"
                            fontWeight={500}
                        >
                            No material selected
                        </Typography>

                        <Typography
                            color="text.disabled"
                            variant="caption"
                        >
                            Please choose a material from
                            the left list to view or edit
                            details.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default MaterialContent;