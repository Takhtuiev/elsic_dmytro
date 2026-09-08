import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import {
    Box,Button,IconButton,InputAdornment,Menu,MenuItem,
    Paper,Slider,Stack,TextField,Tooltip,Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FlipIcon from "@mui/icons-material/Flip";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import {useDispatch,useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";

import ProfileRow from "./ProfileRow";
import BendingPreviewPage from "./BendingPreviewPage";
import {
    calculateBlankLength,
    calculateOuterLengthToEnd,
    calculateBendingMachineParams
} from "./Calculations";
import buildProfileGeometry from "./BuildProfileGeometry";
import {setProfile} from "../../Store/bendingSlice";


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

    profileRotation:0,
    profileMirrored:false,
    selectedBendIndex:-1,
    bendViewMode:"toEnd"
};


const UNIT_SX={
    fontSize:"0.7rem",
    ml:0,
    mr:0,
    p:0
};


const ResultRow=({label,value,caption=false})=>(
    <Box sx={{
        display:"flex",
        justifyContent:"space-between",
        alignItems:"center"
    }}>
        <Typography
            variant={caption?"caption":"body2"}
            color="text.secondary"
        >
            {label}:
        </Typography>

        <Typography
            variant={caption?"caption":"body2"}
            fontWeight="600"
            sx={{ml:"auto"}}
        >
            {value}
        </Typography>
    </Box>
);


const ParamField=({
                      label,
                      value,
                      onChange,
                      min=0,
                      step=1,
                      max,
                      endAdornment
                  })=>(
    <TextField
        label={label}
        type="number"
        size="small"
        value={value}
        onChange={e=>onChange(Number(e.target.value)||0)}
        slotProps={{
            htmlInput:{min,max,step},
            ...(endAdornment&&{
                input:{
                    endAdornment:
                        <InputAdornment
                            position="end"
                            sx={UNIT_SX}
                        >
                            {endAdornment}
                        </InputAdornment>
                }
            })
        }}
    />
);


export default function Biegeberechnung(){

    const savedProfile=useSelector(
        state=>state.bending.profile
    );

    const [state,setState]=useState(
        ()=>savedProfile??INITIAL_STATE
    );


    /*
     * Временный угол Slider.
     *
     * null = Slider не двигается.
     * Число = временный угол, который ещё
     * не записан в profile.
     */
    const [rotationPreview,setRotationPreview]=useState(null);


    /*
     * Индекс полки, которую пользователь
     * назначил вертикальной.
     */
    const [verticalShelfIndex,setVerticalShelfIndex]=
        useState(null);


    const [thicknessMenuAnchor,setThicknessMenuAnchor]=
        useState(null);

    const dispatch=useDispatch();
    const navigate=useNavigate();


    /*
     * Запоминаем обычную ориентацию перед
     * выбором угла.
     */
    const savedProfileRotation=useRef(0);
    const savedProfileMirrored=useRef(false);


    useEffect(()=>{
        dispatch(setProfile(state));
    },[state,dispatch]);


    const updateParam=useCallback(
        (name,value)=>
            setState(prev=>({
                ...prev,
                [name]:value
            })),
        []
    );


    const updateNestedItem=useCallback(
        (type,index,name,value)=>{
            setState(prev=>({
                ...prev,
                [type]:prev[type].map((item,i)=>
                    i===index
                        ?{...item,[name]:value}
                        :item
                )
            }));
        },
        []
    );


    const handleSelectBend=useCallback(index=>{
        setState(prev=>{

            const before=prev.shelves.slice(0,index+1);
            const after=prev.shelves.slice(index+1);

            const lengthBefore=before.reduce(
                (sum,s)=>sum+Number(s.length||0),0
            );

            const lengthAfter=after.reduce(
                (sum,s)=>sum+Number(s.length||0),0
            );

            let selectedSide;

            if(lengthBefore<lengthAfter)
                selectedSide="fromStart";
            else if(lengthBefore>lengthAfter)
                selectedSide="toEnd";
            else
                selectedSide=
                    before.length<=after.length
                        ?"fromStart"
                        :"toEnd";


            const geometry=buildProfileGeometry(prev);


            const getShelfVector=(shelfIndex,fromEnd=false)=>{
                const p1=geometry.sideA?.[shelfIndex];
                const p2=geometry.sideA?.[shelfIndex+1];

                if(!p1||!p2)
                    return null;

                return fromEnd
                    ?{
                        x:p1.x-p2.x,
                        y:p1.y-p2.y
                    }
                    :{
                        x:p2.x-p1.x,
                        y:p2.y-p1.y
                    };
            };


            const getRotation=(side,mirrored)=>{
                const shelfIndex=
                    side==="fromStart"
                        ?index
                        :index+1;

                let v=getShelfVector(shelfIndex);

                if(!v)
                    return prev.profileRotation;

                if(mirrored)
                    v={x:-v.x,y:v.y};

                let angle=
                    Math.atan2(v.y,v.x)*180/Math.PI;

                if(side==="fromStart")
                    angle+=180;

                return -angle;
            };


            const isOppositeShelfDown=(
                side,
                mirrored,
                rotation
            )=>{
                const oppositeIndex=
                    side==="fromStart"
                        ?index+1
                        :index;

                const oppositeFromEnd=
                    side==="toEnd";

                let v=getShelfVector(
                    oppositeIndex,
                    oppositeFromEnd
                );

                if(!v)
                    return false;

                if(mirrored)
                    v={x:-v.x,y:v.y};

                const rad=rotation*Math.PI/180;

                const rotatedY=
                    v.x*Math.sin(rad)+
                    v.y*Math.cos(rad);

                return rotatedY>0;
            };


            const applyView=side=>{
                let mirrored=prev.profileMirrored;

                let rotation=getRotation(
                    side,
                    mirrored
                );

                if(isOppositeShelfDown(
                    side,
                    mirrored,
                    rotation
                )){
                    mirrored=!mirrored;

                    rotation=getRotation(
                        side,
                        mirrored
                    );
                }

                return {
                    mirrored,
                    rotation
                };
            };


            /*
             * 1. Новый угол — первая сторона.
             */
            if(prev.selectedBendIndex!==index){

                savedProfileRotation.current=
                    prev.profileRotation;

                savedProfileMirrored.current=
                    prev.profileMirrored;

                const {
                    mirrored,
                    rotation
                }=applyView(selectedSide);

                return {
                    ...prev,
                    selectedBendIndex:index,
                    bendViewMode:selectedSide,
                    profileMirrored:mirrored,
                    profileRotation:rotation
                };
            }


            /*
             * 2. Тот же угол — вторая сторона.
             */
            const nextSide=
                selectedSide==="fromStart"
                    ?"toEnd"
                    :"fromStart";

            if(prev.bendViewMode===selectedSide){

                const {
                    mirrored,
                    rotation
                }=applyView(nextSide);

                return {
                    ...prev,
                    selectedBendIndex:index,
                    bendViewMode:nextSide,
                    profileMirrored:mirrored,
                    profileRotation:rotation
                };
            }


            /*
             * 3. Тот же угол — снять выбор.
             */
            return {
                ...prev,
                selectedBendIndex:-1,
                bendViewMode:"toEnd",
                profileRotation:
                savedProfileRotation.current,
                profileMirrored:
                savedProfileMirrored.current
            };
        });
    },[]);


    /*
     * Назначаем конкретную полку вертикальной
     * и сразу рассчитываем угол для неё.
     */
    const handleVerticalShelfChange=useCallback(index=>{
        setVerticalShelfIndex(index);

        setState(prev=>{
            const geometry=buildProfileGeometry(prev);

            const p1=geometry.sideA?.[index];
            const p2=geometry.sideA?.[index+1];

            if(!p1||!p2)
                return prev;

            let dx=p2.x-p1.x;
            const dy=p2.y-p1.y;

            if(prev.profileMirrored)
                dx=-dx;

            const profileRotation=
                (-Math.PI/2-
                    Math.atan2(dy,dx))*
                180/Math.PI;

            return {
                ...prev,
                profileRotation
            };
        });
    },[]);


    /*
     * Slider меняет только временный угол.
     */
    const handleProfileRotationChange=useCallback(value=>{
        setRotationPreview(Number(value));
    },[]);


    /*
     * После отпускания:
     *
     * 1. временный угол записывается в profile;
     * 2. временный угол сбрасывается в null.
     */

    const handleProfileRotationCommitted=useCallback(value=>{
        const rotation=Number(value);

        setState(prev=>({
            ...prev,
            profileRotation:rotation
        }));

        setVerticalShelfIndex(null);
        setRotationPreview(null);
    },[]);




    /*
     * Зеркалим профиль.
     *
     * Если вертикальная полка была выбрана,
     * после зеркалирования именно она снова
     * устанавливается вертикально.
     */
    const handleProfileMirrorChange=useCallback(value=>{
        setState(prev=>({
            ...prev,
            profileMirrored:Boolean(value),
            profileRotation:-prev.profileRotation
        }));

    },[]);



    const addBend=useCallback(()=>setState(prev=>({
        ...prev,
        bends:[
            ...prev.bends,
            {angle:180,direction:"right"}
        ],
        shelves:[
            ...prev.shelves,
            {length:50,side:"right"}
        ]
    })),[]);


    const removeBend=useCallback(index=>{
        setState(prev=>{
            const bends=prev.bends.filter(
                (_,i)=>i!==index
            );

            const shelves=prev.shelves.filter(
                (_,i)=>i!==index+1
            );

            let selectedBendIndex=
                prev.selectedBendIndex;

            if(selectedBendIndex===index)
                selectedBendIndex=-1;
            else if(selectedBendIndex>index)
                selectedBendIndex--;

            return {
                ...prev,
                bends,
                shelves,
                selectedBendIndex
            };
        });
    },[]);


    const {
        selectedBendIndex,
        bendViewMode,
        bends,
        shelves,
        thickness,
        kFactor,
        rTool
    }=state;


    const distanceToOuterApex=useMemo(()=>{
        if(selectedBendIndex<0)
            return 0;

        return Number(
            calculateOuterLengthToEnd(state).toFixed(2)
        );
    },[state,selectedBendIndex]);


    const selectedBend=
        bends[selectedBendIndex]||null;


    const machineParams=useMemo(()=>{
        if(!selectedBend)
            return null;

        return calculateBendingMachineParams({
            alpha:selectedBend.angle,
            lInput:distanceToOuterApex,
            isInnerMode:false,
            t:thickness,
            rTool
        });
    },[
        selectedBend,
        distanceToOuterApex,
        thickness,
        rTool
    ]);


    const blankLength=calculateBlankLength(state);


    /*
     * Пока Slider двигается —
     * показываем временное значение.
     *
     * Иначе показываем сохранённый угол профиля.
     */
    const sliderRotation=
        rotationPreview??state.profileRotation;


    return(
        <Box sx={{
            display:"flex",
            gap:2,
            p:{xs:1,sm:2},
            width:"100%",
            flexDirection:{xs:"column",md:"row"},
            alignItems:"flex-start"
        }}>

            <Box sx={{
                flex:1,
                minWidth:0,
                width:"100%",
                order:{xs:1,md:2}
            }}>

                <Paper
                    elevation={2}
                    sx={{
                        mt:2,
                    }}
                >

                    <Stack
                        direction="row"
                        alignItems="center"
                        sx={{
                            px:2,
                            pt:2,
                            pb:0,
                            width:"100%",
                            minWidth:0
                        }}
                    >
                        <Typography
                            variant="subtitle1"
                            fontWeight="500"
                            color="text.secondary"
                            sx={{
                                flexShrink:0,
                                whiteSpace:"nowrap"
                            }}
                        >
                            Bend Profile
                        </Typography>


                        <Slider
                            value={sliderRotation}
                            min={-180}
                            max={180}
                            step={1}
                            size="small"
                            disabled={selectedBendIndex>=0}

                            onChange={(_,value)=>
                                handleProfileRotationChange(value)
                            }

                            onChangeCommitted={(_,value)=>
                                handleProfileRotationCommitted(value)
                            }

                            sx={{
                                flex:1,
                                minWidth:80,
                                mx:2,
                                py:0,
                                color:"text.secondary",
                                opacity:.65,

                                "& .MuiSlider-rail":{
                                    height:1,
                                    opacity:.45
                                },

                                "& .MuiSlider-track":{
                                    height:1
                                },

                                "& .MuiSlider-thumb":{
                                    width:7,
                                    height:7,
                                    boxShadow:"none"
                                }
                            }}
                        />


                        <Tooltip title="Mirror">
                            <IconButton
                                size="small"
                                disabled={selectedBendIndex>=0}
                                onClick={()=>
                                    handleProfileMirrorChange(
                                        !state.profileMirrored
                                    )
                                }
                                sx={{
                                    width:28,
                                    height:28,
                                    flexShrink:0
                                }}
                            >
                                <FlipIcon
                                    sx={{
                                        fontSize:17,
                                        transform:
                                            state.profileMirrored
                                                ?"scaleX(-1)"
                                                :"none"
                                    }}
                                />
                            </IconButton>
                        </Tooltip>


                        <Tooltip title="Full screen">
                            <IconButton
                                size="small"
                                onClick={()=>
                                    navigate(
                                        "/biegeberechnung/preview"
                                    )
                                }
                                sx={{
                                    ml:4,
                                    width:28,
                                    height:28,
                                    flexShrink:0,
                                    color:"text.secondary"
                                }}
                            >
                                <FullscreenIcon
                                    fontSize="small"
                                />
                            </IconButton>
                        </Tooltip>

                    </Stack>

                    <Box sx={{
                        width:"100%",
                        height:"65vh",
                        minHeight:500,
                        maxHeight:700
                    }}>
                        <BendingPreviewPage
                            profile={state}
                            blankLength={blankLength}
                            machineParams={machineParams}
                            rotationPreview={rotationPreview}
                        />
                    </Box>

                </Paper>

            </Box>


            <Paper elevation={2} sx={{
                p:{xs:2,sm:3},
                width:{xs:"100%",md:"22rem"},
                maxWidth:"100%",
                boxSizing:"border-box",
                flexShrink:0,
                order:{xs:2,md:1}
            }}>

                <Typography
                    variant="subtitle2"
                    fontWeight="600"
                    color="text.secondary"
                    sx={{
                        mb:1.5,
                        textTransform:"uppercase",
                        fontSize:".75rem",
                        letterSpacing:".5px"
                    }}
                >
                    Shelves & Bends
                </Typography>


                <Stack spacing={0}>
                    {shelves.map((shelf,index)=>(
                        <ProfileRow
                            key={index}
                            shelf={shelf}
                            index={index}
                            bend={bends[index]}
                            selectedBendIndex={selectedBendIndex}
                            bendViewMode={bendViewMode}
                            isVertical={verticalShelfIndex===index}
                            onVerticalShelfChange={handleVerticalShelfChange}
                            onShelfChange={(index,value)=>
                                updateNestedItem(
                                    "shelves",
                                    index,
                                    "length",
                                    value
                                )
                            }

                            onBendChange={(index,value)=>
                                updateNestedItem(
                                    "bends",
                                    index,
                                    "angle",
                                    value
                                )
                            }

                            onShelfSideChange={(index,value)=>
                                updateNestedItem(
                                    "shelves",
                                    index,
                                    "side",
                                    value
                                )
                            }

                            onBendDirectionChange={(index,value)=>
                                updateNestedItem(
                                    "bends",
                                    index,
                                    "direction",
                                    value
                                )
                            }

                            onRemoveBend={removeBend}
                            onSelectBend={handleSelectBend}

                            canRemove={
                                !!bends[index]&&
                                bends.length>1
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
                        fontSize:".75rem",
                        letterSpacing:".5px"
                    }}
                >
                    Parameters
                </Typography>


                <Box sx={{
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
                }}>

                    <ParamField
                        label="Thickness"
                        value={thickness}
                        onChange={value=>
                            updateParam(
                                "thickness",
                                value
                            )
                        }
                        step={1}
                        endAdornment={
                            <>
                                <Box sx={UNIT_SX}>
                                    mm
                                </Box>

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
                            </>
                        }
                    />


                    <ParamField
                        label="K-Factor"
                        value={kFactor}
                        onChange={value=>
                            updateParam(
                                "kFactor",
                                value
                            )
                        }
                        max={1}
                        step={.01}
                    />


                    <ParamField
                        label="R_tool"
                        value={rTool}
                        onChange={value=>
                            updateParam(
                                "rTool",
                                value
                            )
                        }
                        step={1}
                        endAdornment={
                            <Box sx={UNIT_SX}>
                                mm
                            </Box>
                        }
                    />

                </Box>


                <Menu
                    anchorEl={thicknessMenuAnchor}
                    open={Boolean(thicknessMenuAnchor)}
                    onClose={()=>
                        setThicknessMenuAnchor(null)
                    }
                >
                    {[4,5,6,8,10].map(value=>(
                        <MenuItem
                            key={value}
                            selected={thickness===value}
                            onClick={()=>{
                                updateParam(
                                    "thickness",
                                    value
                                );
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

                    <ResultRow
                        label="Blank length"
                        value={
                            `${blankLength.toFixed(2)} mm`
                        }
                    />


                    {distanceToOuterApex>0&&(
                        <ResultRow
                            label="Reference"
                            value={
                                `${distanceToOuterApex.toFixed(2)} mm`
                            }
                        />
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

                            <ResultRow
                                caption
                                label="Stop position"
                                value={
                                    `${machineParams.stopPosition} mm`
                                }
                            />

                            <ResultRow
                                caption
                                label="Bend angle"
                                value={
                                    `${machineParams.bendAngle}°`
                                }
                            />

                            <ResultRow
                                caption
                                label="Gap folding"
                                value={
                                    `${machineParams.gapFolding} mm`
                                }
                            />

                        </Stack>
                    )}

                </Stack>

            </Paper>

        </Box>
    );
}
