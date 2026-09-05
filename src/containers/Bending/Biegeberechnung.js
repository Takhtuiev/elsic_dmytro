import React,{useCallback,useEffect,useMemo,useState} from "react";
import {Box,Button,IconButton,InputAdornment,Menu,MenuItem,Paper,Stack,TextField,Typography} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {useDispatch,useSelector} from "react-redux";

import ProfileRow from "./ProfileRow";
import BendingPreviewPage from "./BendingPreviewPage";
import {calculateBlankLength,calculateDistanceToOuterApexViaNeutral,calculateBendingMachineParams} from "./Calculations";
import {setProfile} from "../../Store/bendingSlice";


const INITIAL_STATE={
    thickness:4,kFactor:.32,rTool:1.2,
    shelves:[
        {length:50,side:"right"},
        {length:100,side:"right"},
        {length:150,side:"left"}
    ],
    bends:[
        {angle:90,direction:"right"},
        {angle:135,direction:"left"}
    ],
    verticalShelf:1,firstBendIndex:-1,bendViewMode:"toEnd",
    referenceBend:{index:-1,direction:"right",length:null}
};

const UNIT_SX={fontSize:"0.7rem",ml:0,mr:0,p:0};

const ResultRow=({label,value,caption=false})=>(
    <Box sx={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Typography variant={caption?"caption":"body2"} color="text.secondary">{label}:</Typography>
        <Typography variant={caption?"caption":"body2"} fontWeight="600" sx={{ml:"auto"}}>{value}</Typography>
    </Box>
);

const ParamField=({label,value,onChange,min=0,step=1,max,endAdornment})=>(
    <TextField label={label} type="number" size="small" value={value}
        onChange={e=>onChange(Number(e.target.value)||0)}
        slotProps={{
            htmlInput:{min,max,step},
            ...(endAdornment&&{input:{endAdornment:<InputAdornment position="end" sx={UNIT_SX}>{endAdornment}</InputAdornment>}})
        }}
    />
);


export default function Biegeberechnung(){
    const savedProfile=useSelector(state=>state.bending.profile);
    const [state,setState]=useState(()=>savedProfile??INITIAL_STATE);
    const [thicknessMenuAnchor,setThicknessMenuAnchor]=useState(null);
    const dispatch=useDispatch();

    useEffect(()=>{dispatch(setProfile(state));},[state,dispatch]);

    const updateParam=useCallback((name,value)=>setState(prev=>({...prev,[name]:value})),[]);

    const updateNestedItem=useCallback((type,index,name,value)=>{
        setState(prev=>({...prev,[type]:prev[type].map((item,i)=>i===index?{...item,[name]:value}:item)}));
    },[]);

    const handleSelectFirstBend=useCallback(index=>{
        setState(prev=>{
            const nextFirstBendIndex=prev.firstBendIndex!==index?index:
                prev.bendViewMode==="toEnd"?index:-1;
            const nextViewMode=prev.firstBendIndex!==index?"toEnd":
                prev.bendViewMode==="toEnd"?"fromStart":"toEnd";
            const bend=prev.bends[nextFirstBendIndex];

            return {...prev,firstBendIndex:nextFirstBendIndex,bendViewMode:nextViewMode,
                referenceBend:{
                    index:nextFirstBendIndex,
                    direction:bend?.direction||"right",
                    length:null
                }};
        });
    },[]);

    const handleVerticalShelfChange=useCallback(index=>{
        setState(prev=>prev.firstBendIndex!==-1?prev:{...prev,verticalShelf:index+1});
    },[]);

    const addBend=useCallback(()=>setState(prev=>({
        ...prev,
        bends:[...prev.bends,{angle:180,direction:"right"}],
        shelves:[...prev.shelves,{length:50,side:"right"}]
    })),[]);

    const removeBend=useCallback(index=>{
        setState(prev=>{
            const bends=prev.bends.filter((_,i)=>i!==index);
            const shelves=prev.shelves.filter((_,i)=>i!==index+1);
            const verticalShelf=Math.min(prev.verticalShelf,shelves.length);
            let firstBendIndex=prev.firstBendIndex;

            if(firstBendIndex===index) firstBendIndex=-1;
            else if(firstBendIndex>index) firstBendIndex--;

            const bend=bends[firstBendIndex];

            return {...prev,bends,shelves,verticalShelf,firstBendIndex,
                referenceBend:{
                    index:firstBendIndex,
                    direction:bend?.direction||"right",
                    length:null
                }};
        });
    },[]);

    const {firstBendIndex,bendViewMode,bends,shelves,thickness,kFactor,rTool}=state;
    const {length:refLength,direction:refDirection,index:refIndex}=state.referenceBend;

    useEffect(()=>{
        if(firstBendIndex<0){
            if(refLength!==null||refIndex!==-1)
                setState(prev=>({...prev,referenceBend:{index:-1,direction:"right",length:null}}));
            return;
        }

        const bend=bends[firstBendIndex];
        if(!bend) return;

        const length=Number(calculateDistanceToOuterApexViaNeutral({
            shelves,bends,thickness,kFactor,rTool,firstBendIndex,bendViewMode
        }).toFixed(2));

        if(refLength!==length||refDirection!==bend.direction||refIndex!==firstBendIndex){
            setState(prev=>({...prev,referenceBend:{
                index:prev.firstBendIndex,direction:bend.direction,length
            }}));
        }
    },[firstBendIndex,bendViewMode,bends,shelves,thickness,kFactor,rTool,refLength,refDirection,refIndex]);

    const blankLength=useMemo(()=>calculateBlankLength(state),[state]);
    const selectedBend=firstBendIndex>=0?bends[firstBendIndex]:null;

    const machineParams=useMemo(()=>{
        if(!selectedBend) return null;
        return calculateBendingMachineParams({
            alpha:selectedBend.angle,
            lInput:state.referenceBend.length||0,
            isInnerMode:false,t:thickness,rTool
        });
    },[selectedBend,state.referenceBend.length,thickness,rTool]);

    return (
        <Box sx={{
            display:"flex",gap:2,p:{xs:1,sm:2},width:"100%",
            flexDirection:{xs:"column",md:"row"},alignItems:"flex-start"
        }}>
            <Box sx={{
                flex:1,minWidth:0,width:"100%",
                order:{xs:1,md:2}
            }}>
                <BendingPreviewPage profile={state} blankLength={blankLength} machineParams={machineParams}/>
            </Box>

            <Paper elevation={2} sx={{
                p:{xs:2,sm:3},width:{xs:"100%",md:"22rem"},maxWidth:"100%",
                boxSizing:"border-box",flexShrink:0,order:{xs:2,md:1}
            }}>
                <Typography variant="subtitle2" fontWeight="600" color="text.secondary"
                    sx={{mb:1.5,textTransform:"uppercase",fontSize:".75rem",letterSpacing:".5px"}}>
                    Shelves & Bends
                </Typography>

                <Stack spacing={0}>
                    {shelves.map((shelf,index)=>(
                        <ProfileRow
                            key={index}
                            shelf={shelf}
                            shelfIndex={index}
                            bend={bends[index]}
                            index={index}
                            verticalShelf={state.verticalShelf}
                            onVerticalShelfChange={handleVerticalShelfChange}
                            onShelfChange={(_,value)=>updateNestedItem("shelves",index,"length",value)}
                            onBendChange={(_,value)=>updateNestedItem("bends",index,"angle",value)}
                            onShelfSideChange={(_,value)=>updateNestedItem("shelves",index,"side",value)}
                            onBendDirectionChange={(_,value)=>updateNestedItem("bends",index,"direction",value)}
                            onRemoveBend={()=>removeBend(index)}
                            onSelectFirstBend={handleSelectFirstBend}
                            firstBendIndex={firstBendIndex}
                            bendViewMode={bendViewMode}
                            canRemove={!!bends[index]&&bends.length>1}
                        />
                    ))}
                </Stack>

                <Box sx={{mt:2,mb:2}}>
                    <Button fullWidth variant="outlined" startIcon={<AddIcon/>} onClick={addBend}>
                        Add Bend
                    </Button>
                </Box>

                <Typography variant="subtitle2" fontWeight="600" color="text.secondary"
                    sx={{mb:1.5,pt:2,borderTop:"1px solid",borderColor:"divider",
                        textTransform:"uppercase",fontSize:".75rem",letterSpacing:".5px"}}>
                    Parameters
                </Typography>

                <Box sx={{
                    display:"grid",
                    gridTemplateColumns:{xs:"minmax(0,1fr) minmax(0,.65fr) minmax(0,1fr)",md:"1fr .65fr 1fr"},
                    gap:1.5,width:"100%",mb:3,
                    "& > *":{minWidth:0,
                        "& input::-webkit-outer-spin-button,& input::-webkit-inner-spin-button":{
                            WebkitAppearance:"none",margin:0
                        },
                        "& input[type=number]":{MozAppearance:"textfield"}
                    }
                }}>
                    <ParamField
                        label="Thickness"
                        value={thickness}
                        onChange={value=>updateParam("thickness",value)}
                        step={1}
                        endAdornment={
                            <>
                                <Box sx={UNIT_SX}>mm</Box>
                                <IconButton size="small" onClick={e=>setThicknessMenuAnchor(e.currentTarget)}
                                    sx={{p:.25,color:"text.secondary"}}>
                                    <KeyboardArrowDownIcon fontSize="small"/>
                                </IconButton>
                            </>
                        }
                    />

                    <ParamField
                        label="K-Factor"
                        value={kFactor}
                        onChange={value=>updateParam("kFactor",value)}
                        max={1}
                        step={.01}
                    />

                    <ParamField
                        label="R_tool"
                        value={rTool}
                        onChange={value=>updateParam("rTool",value)}
                        step={1}
                        endAdornment={<Box sx={UNIT_SX}>mm</Box>}
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
                            selected={thickness===value}
                            onClick={()=>{updateParam("thickness",value);setThicknessMenuAnchor(null);}}
                        >
                            {value}
                        </MenuItem>
                    ))}
                </Menu>

                <Stack spacing={1} sx={{p:2,borderRadius:"8px",border:"1px solid"}}>
                    <ResultRow label="Blank length" value={`${blankLength.toFixed(2)} mm`}/>

                    {refLength!==null&&<ResultRow label="Reference" value={`${refLength.toFixed(2)} mm`}/>}

                    {machineParams&&(
                        <Stack spacing={.8} sx={{mt:1,pt:1,borderTop:"1px dashed",borderColor:"grey.300"}}>
                            <ResultRow caption label="Stop position" value={`${machineParams.stopPosition} mm`}/>
                            <ResultRow caption label="Bend angle" value={`${machineParams.bendAngle}°`}/>
                            <ResultRow caption label="Gap folding" value={`${machineParams.gapFolding} mm`}/>
                        </Stack>
                    )}
                </Stack>
            </Paper>
        </Box>
    );
}
