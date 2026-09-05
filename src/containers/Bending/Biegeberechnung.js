import React,{useCallback,useEffect,useMemo,useState} from "react";
import {
    Box,Button,IconButton,InputAdornment,Menu,MenuItem,
    Paper,Stack,TextField,Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ProfileRow from "./ProfileRow";
import {
    calculateBlankLength,
    calculateDistanceToOuterApexViaNeutral,
    calculateBendingMachineParams
} from "./Calculations";
import ProfileGeometryPreview from "./ProfileGeometryPreview";

const INITIAL_STATE={
    thickness:4,
    kFactor:.32,
    rTool:1.2,
    shelves:[
        {length:50,side:"right"},
        {length:100,side:"right"},
        {length:150,side:"left"}
    ],
    bends:[
        {angle:90,direction:"right"},
        {angle:135,direction:"left"}
    ],
    verticalShelf:1,
    firstBendIndex:-1,
    bendViewMode:"toEnd",
    referenceBend:{
        index:-1,
        direction:"right",
        length:null
    }
};

const UNIT_SX={
    fontSize:"0.7rem",
    ml:0,
    mr:0,
    p:0
};

export default function Biegeberechnung(){
    const [state,setState]=useState(INITIAL_STATE);
    const [thicknessMenuAnchor,setThicknessMenuAnchor]=useState(null);

    const updateParam=useCallback((name,value)=>{
        setState(prev=>({...prev,[name]:value}));
    },[]);

    const updateNestedItem=useCallback((type,index,name,value)=>{
        setState(prev=>({
            ...prev,
            [type]:prev[type].map((item,i)=>
                i===index?{...item,[name]:value}:item
            )
        }));
    },[]);

    const handleSelectFirstBend=useCallback(index=>{
        setState(prev=>{
            let nextFirstBendIndex;
            let nextViewMode;

            if(prev.firstBendIndex!==index){
                nextFirstBendIndex=index;
                nextViewMode="toEnd";
            }else if(prev.bendViewMode==="toEnd"){
                nextFirstBendIndex=index;
                nextViewMode="fromStart";
            }else{
                nextFirstBendIndex=-1;
                nextViewMode="toEnd";
            }

            const currentBend=prev.bends[nextFirstBendIndex];
            const nextDirection=currentBend?currentBend.direction:"right";

            return{
                ...prev,
                firstBendIndex:nextFirstBendIndex,
                bendViewMode:nextViewMode,
                referenceBend:{
                    index:nextFirstBendIndex,
                    direction:nextDirection,
                    length:null
                }
            };
        });
    },[]);

    const handleVerticalShelfChange=useCallback(index=>{
        setState(prev=>{
            if(prev.firstBendIndex!==-1)return prev;
            return{...prev,verticalShelf:index+1};
        });
    },[]);

    const addBend=useCallback(()=>{
        setState(prev=>({
            ...prev,
            bends:[...prev.bends,{angle:180,direction:"right"}],
            shelves:[...prev.shelves,{length:50,side:"right"}]
        }));
    },[]);

    const removeBend=useCallback(index=>{
        setState(prev=>{
            const bends=prev.bends.filter((_,i)=>i!==index);
            const shelves=prev.shelves.filter((_,i)=>i!==index+1);

            let verticalShelf=prev.verticalShelf;
            if(verticalShelf>shelves.length)verticalShelf=shelves.length;

            let firstBendIndex=prev.firstBendIndex;
            if(firstBendIndex===index)firstBendIndex=-1;
            else if(firstBendIndex>index)firstBendIndex--;

            const referenceIndex=firstBendIndex;
            const bend=bends[referenceIndex];

            return{
                ...prev,
                bends,
                shelves,
                verticalShelf,
                firstBendIndex,
                referenceBend:{
                    index:referenceIndex,
                    direction:bend?.direction||"right",
                    length:null
                }
            };
        });
    },[]);

    const {
        firstBendIndex,bendViewMode,bends,shelves,
        thickness,kFactor,rTool
    }=state;

    const {
        length:refLength,
        direction:refDirection,
        index:refIndex
    }=state.referenceBend;

    useEffect(()=>{
        if(firstBendIndex<0){
            if(refLength!==null||refIndex!==-1){
                setState(prev=>({
                    ...prev,
                    referenceBend:{
                        index:-1,
                        direction:"right",
                        length:null
                    }
                }));
            }
            return;
        }

        const bend=bends[firstBendIndex];
        if(!bend)return;

        const length=Number(
            calculateDistanceToOuterApexViaNeutral({
                shelves,
                bends,
                thickness,
                kFactor,
                rTool,
                firstBendIndex,
                bendViewMode
            }).toFixed(2)
        );

        const direction=bend.direction;

        if(
            refLength!==length||
            refDirection!==direction||
            refIndex!==firstBendIndex
        ){
            setState(prev=>({
                ...prev,
                referenceBend:{
                    index:prev.firstBendIndex,
                    direction,
                    length
                }
            }));
        }
    },[
        firstBendIndex,bendViewMode,bends,shelves,
        thickness,kFactor,rTool,refLength,refDirection,refIndex
    ]);

    const blankLength=useMemo(
        ()=>calculateBlankLength(state),
        [state]
    );

    const selectedBend=
        firstBendIndex>=0?bends[firstBendIndex]:null;

    const machineParams=useMemo(()=>{
        if(!selectedBend)return null;

        return calculateBendingMachineParams({
            alpha:selectedBend.angle,
            lInput:state.referenceBend.length||0,
            isInnerMode:false,
            t:thickness,
            rTool
        });
    },[
        selectedBend,
        state.referenceBend.length,
        thickness,
        rTool
    ]);

    return(
        <Box
            sx={{
                display:"flex",
                gap:2,
                p:{xs:1,sm:2},
                flexDirection:{xs:"column",md:"row"},
                alignItems:"flex-start",
                width:"100%"
            }}
        >
            <Box
                sx={{
                    flex:1,
                    minWidth:0,
                    width:"100%",
                    order:{xs:1,md:2}
                }}
            >
                <ProfileGeometryPreview
                    profile={state}
                    blankLength={blankLength}
                    firstBendIndex={state.firstBendIndex}
                    bendViewMode={state.bendViewMode}
                    machineParams={machineParams}
                />
            </Box>

            <Paper
                elevation={2}
                sx={{
                    p:{xs:2,sm:3},
                    width:{xs:"100%",md:"22rem"},
                    maxWidth:"100%",
                    boxSizing:"border-box",
                    flexShrink:0,
                    order:{xs:2,md:1}
                }}
            >
                <Typography
                    variant="subtitle2"
                    fontWeight="600"
                    color="text.secondary"
                    sx={{
                        mb:1.5,
                        textTransform:"uppercase",
                        fontSize:"0.75rem",
                        letterSpacing:"0.5px"
                    }}
                >
                    Shelves & Bends
                </Typography>

                <Stack spacing={0}>
                    {state.shelves.map((shelf,index)=>(
                        <ProfileRow
                            key={index}
                            shelf={shelf}
                            shelfIndex={index}
                            bend={state.bends[index]}
                            index={index}
                            verticalShelf={state.verticalShelf}
                            onVerticalShelfChange={handleVerticalShelfChange}
                            onShelfChange={(idx,value)=>
                                updateNestedItem("shelves",index,"length",value)
                            }
                            onBendChange={(idx,value)=>
                                updateNestedItem("bends",index,"angle",value)
                            }
                            onShelfSideChange={(idx,value)=>
                                updateNestedItem("shelves",index,"side",value)
                            }
                            onBendDirectionChange={(idx,value)=>
                                updateNestedItem("bends",index,"direction",value)
                            }
                            onRemoveBend={()=>removeBend(index)}
                            onSelectFirstBend={handleSelectFirstBend}
                            firstBendIndex={state.firstBendIndex}
                            bendViewMode={state.bendViewMode}
                            canRemove={
                                !!state.bends[index]&&
                                state.bends.length>1
                            }
                        />
                    ))}
                </Stack>

                <Box sx={{mt:2,mb:2}}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<AddIcon/>}
                        onClick={addBend}
                    >
                        Add Bend
                    </Button>
                </Box>

                <Typography
                    variant="subtitle2"
                    fontWeight="600"
                    color="text.secondary"
                    sx={{
                        mb:1.5,
                        pt:2,
                        borderTop:"1px solid",
                        borderColor:"divider",
                        textTransform:"uppercase",
                        fontSize:"0.75rem",
                        letterSpacing:"0.5px"
                    }}
                >
                    Parameters
                </Typography>

                <Box
                    sx={{
                        display:"grid",
                        gridTemplateColumns:{
                            xs:"minmax(0,1fr) minmax(0,.65fr) minmax(0,1fr)",
                            md:"1fr .65fr 1fr"
                        },
                        gap:1.5,
                        width:"100%",
                        mb:3,
                        "& > *":{
                            minWidth:0,
                            "& input::-webkit-outer-spin-button,& input::-webkit-inner-spin-button":{
                                WebkitAppearance:"none",
                                margin:0
                            },
                            "& input[type=number]":{
                                MozAppearance:"textfield"
                            }
                        }
                    }}
                >
                    <TextField
                        label="Thickness"
                        type="number"
                        size="small"
                        value={state.thickness}
                        onChange={e=>
                            updateParam(
                                "thickness",
                                Number(e.target.value)||0
                            )
                        }
                        slotProps={{
                            htmlInput:{min:0,step:1},
                            input:{
                                endAdornment:(
                                    <InputAdornment
                                        position="end"
                                        sx={UNIT_SX}
                                    >
                                        <Box sx={UNIT_SX}>mm</Box>
                                        <IconButton
                                            size="small"
                                            onClick={e=>
                                                setThicknessMenuAnchor(
                                                    e.currentTarget
                                                )
                                            }
                                            sx={{
                                                p:.25,
                                                color:"text.secondary"
                                            }}
                                        >
                                            <KeyboardArrowDownIcon
                                                fontSize="small"
                                            />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }
                        }}
                    />

                    <TextField
                        label="K-Factor"
                        type="number"
                        size="small"
                        value={state.kFactor}
                        onChange={e=>
                            updateParam(
                                "kFactor",
                                Number(e.target.value)||0
                            )
                        }
                        slotProps={{
                            htmlInput:{
                                min:0,
                                max:1,
                                step:.01
                            }
                        }}
                    />

                    <TextField
                        label="R_tool"
                        type="number"
                        size="small"
                        value={state.rTool}
                        onChange={e=>
                            updateParam(
                                "rTool",
                                Number(e.target.value)||0
                            )
                        }
                        slotProps={{
                            htmlInput:{
                                min:0,
                                step:1
                            },
                            input:{
                                endAdornment:(
                                    <InputAdornment
                                        position="end"
                                        sx={UNIT_SX}
                                    >
                                        <Box sx={UNIT_SX}>mm</Box>
                                    </InputAdornment>
                                )
                            }
                        }}
                    />
                </Box>

                <Menu
                    anchorEl={thicknessMenuAnchor}
                    open={Boolean(thicknessMenuAnchor)}
                    onClose={()=>setThicknessMenuAnchor(null)}
                >
                    {[4,5,6,8,10].map(value=>(
                        <MenuItem
                            key={value}
                            selected={state.thickness===value}
                            onClick={()=>{
                                updateParam("thickness",value);
                                setThicknessMenuAnchor(null);
                            }}
                        >
                            {value}
                        </MenuItem>
                    ))}
                </Menu>

                <Stack
                    spacing={1}
                    sx={{
                        p:2,
                        borderRadius:"8px",
                        border:"1px solid"
                    }}
                >
                    <Box
                        sx={{
                            display:"flex",
                            justifyContent:"space-between",
                            alignItems:"center"
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            Blank length:
                        </Typography>
                        <Typography
                            variant="body2"
                            fontWeight="600"
                            sx={{ml:"auto"}}
                        >
                            {blankLength.toFixed(2)} mm
                        </Typography>
                    </Box>

                    {state.referenceBend.length!==null&&(
                        <Box
                            sx={{
                                display:"flex",
                                justifyContent:"space-between",
                                alignItems:"center"
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Reference:
                            </Typography>
                            <Typography
                                variant="body2"
                                fontWeight="600"
                                sx={{ml:"auto"}}
                            >
                                {state.referenceBend.length.toFixed(2)} mm
                            </Typography>
                        </Box>
                    )}

                    {machineParams&&(
                        <Stack
                            spacing={.8}
                            sx={{
                                mt:1,
                                pt:1,
                                borderTop:"1px dashed",
                                borderColor:"grey.300"
                            }}
                        >
                            <Box
                                sx={{
                                    display:"flex",
                                    justifyContent:"space-between",
                                    alignItems:"center"
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    Stop position:
                                </Typography>
                                <Typography
                                    variant="caption"
                                    fontWeight="600"
                                    sx={{ml:"auto"}}
                                >
                                    {machineParams.stopPosition} mm
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    display:"flex",
                                    justifyContent:"space-between",
                                    alignItems:"center"
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    Bend angle:
                                </Typography>
                                <Typography
                                    variant="caption"
                                    fontWeight="600"
                                    sx={{ml:"auto"}}
                                >
                                    {machineParams.bendAngle}°
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    display:"flex",
                                    justifyContent:"space-between",
                                    alignItems:"center"
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    Gap folding:
                                </Typography>
                                <Typography
                                    variant="caption"
                                    fontWeight="600"
                                    sx={{ml:"auto"}}
                                >
                                    {machineParams.gapFolding} mm
                                </Typography>
                            </Box>
                        </Stack>
                    )}
                </Stack>
            </Paper>
        </Box>
    );
}