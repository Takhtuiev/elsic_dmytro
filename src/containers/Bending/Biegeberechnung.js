import React,{useCallback,useEffect,useMemo,useState} from "react";
import {
    Box,Button,Paper,Stack,TextField,Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
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
        {length:20,side:"right"},
        {length:20,side:"right"}
    ],
    bends:[
        {angle:180,direction:"right"}
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

export default function Biegeberechnung(){
    const [state,setState]=useState(INITIAL_STATE);

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

    const addBend=useCallback(()=>{
        setState(prev=>({
            ...prev,
            bends:[
                ...prev.bends,
                {angle:180,direction:"right"}
            ],
            shelves:[
                ...prev.shelves,
                {length:20,side:"right"}
            ]
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
        firstBendIndex,
        bendViewMode,
        bends,
        shelves,
        thickness,
        kFactor,
        rTool,
        refLength,
        refDirection,
        refIndex
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
            isInnerMode:selectedBend.direction==="left"?1:0,
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
                flexDirection:{xs:"column",md:"row"}
            }}
        >
            <Paper
                sx={{
                    p:{xs:2,sm:3},
                    width:{xs:"100%",md:"22rem"},
                    flexShrink:0
                }}
            >
                <Typography variant="h6" sx={{mb:2}}>
                    Shelves & Bends
                </Typography>

                <Stack spacing={1.5}>
                    {state.shelves.map((shelf,index)=>(
                        <ProfileRow
                            key={index}
                            shelf={shelf}
                            shelfIndex={index}
                            bend={state.bends[index]}
                            bendIndex={index}
                            updateShelf={(name,value)=>
                                updateNestedItem("shelves",index,name,value)
                            }
                            updateBend={(name,value)=>
                                updateNestedItem("bends",index,name,value)
                            }
                            removeBend={removeBend}
                            onSelectFirstBend={handleSelectFirstBend}
                            firstBendIndex={firstBendIndex}
                            bendViewMode={bendViewMode}
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

                <Typography variant="h6" sx={{mb:2}}>
                    Parameters
                </Typography>

                <Box
                    sx={{
                        display:"flex",
                        gap:1,
                        flexWrap:"wrap"
                    }}
                >
                    <TextField
                        label="Thickness"
                        type="number"
                        size="small"
                        value={state.thickness}
                        onChange={e=>updateParam(
                            "thickness",
                            Number(e.target.value)
                        )}
                    />

                    <TextField
                        label="K-Factor"
                        type="number"
                        size="small"
                        value={state.kFactor}
                        onChange={e=>updateParam(
                            "kFactor",
                            Number(e.target.value)
                        )}
                    />

                    <TextField
                        label="R_tool"
                        type="number"
                        size="small"
                        value={state.rTool}
                        onChange={e=>updateParam(
                            "rTool",
                            Number(e.target.value)
                        )}
                    />
                </Box>

                <Typography sx={{mt:2}}>
                    Blank length: {blankLength.toFixed(2)} mm
                </Typography>

                {state.referenceBend.length!==null&&(
                    <Typography>
                        Reference: {state.referenceBend.length.toFixed(2)} mm
                    </Typography>
                )}

                {machineParams&&(
                    <Box sx={{mt:2}}>
                        <Typography>
                            Bend angle: {machineParams.bendAngle}°
                        </Typography>
                        <Typography>
                            Stop position: {machineParams.stopPosition} mm
                        </Typography>
                        <Typography>
                            Gap folding: {machineParams.gapFolding} mm
                        </Typography>
                    </Box>
                )}
            </Paper>

            <Box
                sx={{
                    flex:1,
                    minWidth:0
                }}
            >
                <ProfileGeometryPreview
                    profile={state}
                    blankLength={blankLength}
                    firstBendIndex={firstBendIndex}
                    bendViewMode={bendViewMode}
                />
            </Box>
        </Box>
    );
}