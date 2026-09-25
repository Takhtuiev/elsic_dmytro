import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import {
    Box,
    Button,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    Paper,
    Slider,
    TextField,
    Tooltip,
    Typography,
    Link
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FlipIcon from "@mui/icons-material/Flip";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import DatabaseIcon from "@mui/icons-material/Storage";
import {useDispatch,useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";

import ProfileRow from "./ProfileRow";
import BendingPreviewPage from "./BendingPreviewPage";
import BendingDialog from "./BendingDialog";
import MaterialContent from "./MaterialContent";
import MachineContent from "./MachineContent";
import SimulationContent from "./SimulationContent";

import {
    calculateBlankLength,
    calculateOuterLengthToEnd,
    calculateBendingMachineParams
} from "./Calculations";
import buildProfileGeometry from "./BuildProfileGeometry";
import {setProfile} from "../../Store/bendingSlice";
import {MATERIALS,MACHINES} from "./parameters";


const INITIAL_STATE={
    name:"Detail-4301",

    material:MATERIALS["PVC_CAW_RED"],
    machine:MACHINES["MACHINE_LINE_2"],

    geometry:{
        thickness:4,
        width:430,

        shelves:[
            {length:50,side:"right"},
            {length:100,side:"right"},
            {length:150,side:"left"}
        ],

        bends:[
            {angle:90,direction:"right"},
            {angle:135,direction:"left"}
        ]
    },

    simulation:{
        target:{
            type:"minTemperature",
            value:(MATERIALS["PVC_CAW_RED"]?.minFormingTemp+MATERIALS["PVC_CAW_RED"]?.maxFormingTemp)/2
        },

        temperatures:{
            ambientC:20,
            ambientRadiationC:20,
            initialC:20
        },

        cooling:{
            timeSeconds:10,
            convectiveHeatTransferCoefficient:8
        },

        stopAtMaxTemperature:true,
        maxTimeSeconds:1800
    },

    view:{
        rotation:0,
        mirrored:false,
        bendIndex:-1,
        bendSide:"toEnd"
    }
};

const setByPath=(object,path,value)=>{
    const result=Array.isArray(object)
        ?[...object]
        :{...object};

    let current=result;

    for(let i=0;i<path.length-1;i++){
        const key=path[i];

        current[key]=Array.isArray(current[key])
            ?[...current[key]]
            :{...current[key]};

        current=current[key];
    }

    current[path[path.length-1]]=value;

    return result;
};

const getShelfVector=(geometry,index,fromEnd=false)=>{
    const p1=geometry.sideA?.[index];
    const p2=geometry.sideA?.[index+1];

    if(!p1||!p2)return null;

    return fromEnd
        ?{x:p1.x-p2.x,y:p1.y-p2.y}
        :{x:p2.x-p1.x,y:p2.y-p1.y};
};


const getPreferredSide=(shelves,index)=>{
    const before=shelves.slice(0,index+1);
    const after=shelves.slice(index+1);

    const beforeLength=before.reduce(
        (sum,s)=>sum+Number(s.length||0),
        0
    );

    const afterLength=after.reduce(
        (sum,s)=>sum+Number(s.length||0),
        0
    );

    if(beforeLength<afterLength)return"fromStart";
    if(beforeLength>afterLength)return"toEnd";

    return before.length<=after.length
        ?"fromStart"
        :"toEnd";
};


const getViewRotation=(
    geometry,
    index,
    side,
    mirrored,
    currentRotation
)=>{
    const shelfIndex=
        side==="fromStart"
            ?index
            :index+1;

    let vector=getShelfVector(
        geometry,
        shelfIndex
    );

    if(!vector)return currentRotation;

    if(mirrored)
        vector={
            x:-vector.x,
            y:vector.y
        };

    let angle=
        Math.atan2(
            vector.y,
            vector.x
        )*180/Math.PI;

    if(side==="fromStart")
        angle+=180;

    return-angle;
};


const isOppositeShelfDown=(
    geometry,
    index,
    side,
    mirrored,
    rotation
)=>{
    const oppositeIndex=
        side==="fromStart"
            ?index+1
            :index;

    let vector=getShelfVector(
        geometry,
        oppositeIndex,
        side==="toEnd"
    );

    if(!vector)return false;

    if(mirrored)
        vector={
            x:-vector.x,
            y:vector.y
        };

    const rad=
        rotation*Math.PI/180;

    const y=
        vector.x*Math.sin(rad)+
        vector.y*Math.cos(rad);

    return y>0;
};


const calculateBendView=(
    geometry,
    index,
    side,
    mirrored,
    currentRotation
)=>{
    let rotation=getViewRotation(
        geometry,
        index,
        side,
        mirrored,
        currentRotation
    );

    if(
        isOppositeShelfDown(
            geometry,
            index,
            side,
            mirrored,
            rotation
        )
    ){
        mirrored=!mirrored;

        rotation=getViewRotation(
            geometry,
            index,
            side,
            mirrored,
            currentRotation
        );
    }

    return{
        rotation,
        mirrored
    };
};


const ParamField=({
                      label,
                      value,
                      onChange,
                      step=1,
                      endAdornment
                  })=>(
    <TextField
        label={label}
        size="small"
        type="number"
        value={value}
        onChange={e=>onChange(e.target.value)}
        slotProps={{
            htmlInput:{
                step,
                min:0,
                sx:{
                    "&::-webkit-outer-spin-button,&::-webkit-inner-spin-button":{
                        display:"none"
                    },
                    MozAppearance:"textfield"
                }
            },
            input:{
                endAdornment:endAdornment&&(
                    <InputAdornment position="end">
                        {endAdornment}
                    </InputAdornment>
                )
            }
        }}
    />
);


const PreviewToolbar=({
                          rotation,
                          bendIndex,
                          mirrored,
                          onRotationChange,
                          onRotationCommitted,
                          onMirror,
                          onFullscreen
                      })=>(
    <Box
        sx={{
            px:1,
            py:0,
            minHeight:42,
            display:"flex",
            alignItems:"center",
            flexShrink:0
        }}
    >
        <Slider
            value={rotation}
            min={-180}
            max={180}
            step={1}
            size="small"
            disabled={bendIndex>=0}
            onChange={(_,value)=>
                onRotationChange(value)
            }
            onChangeCommitted={(_,value)=>
                onRotationCommitted(value)
            }
            sx={{
                flex:1,
                minWidth:80,
                mx:1,
                color:"text.secondary",
                opacity:.7,
                "& .MuiSlider-thumb":{
                    width:10,
                    height:10
                }
            }}
        />

        <Tooltip title="Mirror">
            <span>
                <IconButton
                    size="small"
                    disabled={bendIndex>=0}
                    onClick={onMirror}
                >
                    <FlipIcon
                        fontSize="small"
                        sx={{
                            transform:mirrored
                                ?"scaleX(-1)"
                                :"none"
                        }}
                    />
                </IconButton>
            </span>
        </Tooltip>

        <Tooltip title="Full screen">
            <IconButton
                size="small"
                onClick={onFullscreen}
            >
                <FullscreenIcon fontSize="small"/>
            </IconButton>
        </Tooltip>
    </Box>
);


export default function Biegeberechnung(){

    const dispatch=useDispatch();
    const navigate=useNavigate();

    const savedView=useRef({
        rotation:0,
        mirrored:false
    });

    const profile=useSelector(
        state=>state.bending.profile
    );

    const [state,setState]=useState(
        profile??INITIAL_STATE
    );

    const [
        rotationPreview,
        setRotationPreview
    ]=useState(null);

    const [
        verticalShelfIndex,
        setVerticalShelfIndex
    ]=useState(null);

    const [
        thicknessMenuAnchor,
        setThicknessMenuAnchor
    ]=useState(null);

    const [
        materialDialogOpen,
        setMaterialDialogOpen
    ]=useState(false);

    const [
        machineDialogOpen,
        setMachineDialogOpen
    ]=useState(false);

    const [
        simulationDialogOpen,
        setSimulationDialogOpen
    ]=useState(false);

    useEffect(()=>{
        dispatch(setProfile(state));
    },[state,dispatch]);

    const {
        material,
        machine,
        geometry,
        simulation,
        view
    }=state;

    const {
        thickness,
        width,
        shelves,
        bends
    }=geometry;

    const {
        rotation,
        mirrored,
        bendIndex,
        bendSide
    }=view;

    const selectedBend=
        bends[bendIndex]??null;

    const updateState=useCallback(
        changes=>{
            setState(prev=>({
                ...prev,
                ...changes
            }));
        },
        []
    );

    const updateGeometry=useCallback(
        changes=>{
            setState(prev=>{
                if(changes.path){
                    const [collection,index,field]=changes.path;

                    const nextGeometry=setByPath(
                        prev.geometry,
                        changes.path,
                        changes.value
                    );

                    let nextView=prev.view;

                    const selectedShelfIndex=
                        bendSide==="fromStart"
                            ?bendIndex
                            :bendIndex+1;

                    if(
                        collection==="bends"&&
                        (field==="angle"||field==="direction")&&
                        index<=selectedShelfIndex
                    ){

                        const geometryProfile={
                            ...prev,
                            ...nextGeometry,
                            rTool:prev.machine?.rTool,
                            kFactor:prev.material?.kFactor
                        };

                        const geometry=
                            buildProfileGeometry(
                                geometryProfile
                            );

                        nextView={
                            ...prev.view,
                            ...calculateBendView(
                                geometry,
                                bendIndex,
                                bendSide,
                                prev.view.mirrored,
                                prev.view.rotation
                            )
                        };
                    }

                    return{
                        ...prev,
                        geometry:nextGeometry,
                        view:nextView
                    };
                }

                return{
                    ...prev,
                    geometry:{
                        ...prev.geometry,
                        ...changes
                    }
                };
            });
        },
        [bendIndex,bendSide]
    );

    const geometryProfile=useMemo(
        ()=>({
            ...state,
            ...geometry,
            kFactor:material?.kFactor,
            rTool:machine?.rTool
        }),
        [
            state,
            geometry,
            material,
            machine
        ]
    );

    const builtGeometry=useMemo(
        ()=>buildProfileGeometry(geometryProfile),
        [geometryProfile]
    );

    const handleSelectBend=useCallback(
        index=>{
            setState(prev=>{
                const geometryProfile={
                    ...prev,
                    ...prev.geometry,
                    rTool:prev.machine?.rTool,
                    kFactor:prev.material?.kFactor
                };

                const geometry=
                    buildProfileGeometry(
                        geometryProfile
                    );

                const preferredSide=
                    getPreferredSide(
                        prev.geometry.shelves,
                        index
                    );

                // Выбран другой угол
                if(
                    prev.view.bendIndex!==index
                ){
                    // Сохраняем исходный вид только при первом выборе
                    if(prev.view.bendIndex<0){
                        savedView.current={
                            rotation:
                            prev.view.rotation,
                            mirrored:
                            prev.view.mirrored
                        };
                    }

                    const nextView=
                        calculateBendView(
                            geometry,
                            index,
                            preferredSide,
                            prev.view.mirrored,
                            prev.view.rotation
                        );

                    return{
                        ...prev,
                        view:{
                            ...prev.view,
                            bendIndex:index,
                            bendSide:preferredSide,
                            ...nextView
                        }
                    };
                }

                // Та же позиция уже выбрана:
                // снимаем выбор и возвращаем исходный view
                if(
                    prev.view.bendSide!==preferredSide
                ){
                    return{
                        ...prev,
                        view:{
                            ...prev.view,
                            bendIndex:-1,
                            bendSide:"toEnd",
                            ...savedView.current
                        }
                    };
                }

                // Переключаем ту же деталь на противоположную сторону
                const nextSide=
                    prev.view.bendSide==="fromStart"
                        ?"toEnd"
                        :"fromStart";

                const nextView=
                    calculateBendView(
                        geometry,
                        index,
                        nextSide,
                        prev.view.mirrored,
                        prev.view.rotation
                    );

                return{
                    ...prev,
                    view:{
                        ...prev.view,
                        bendSide:nextSide,
                        ...nextView
                    }
                };
            });
        },
        []
    );

    const handleVerticalShelfChange=
        useCallback(index=>{
            setState(prev=>{
                const geometryProfile={
                    ...prev,
                    ...prev.geometry,
                    rTool:prev.machine?.rTool,
                    kFactor:prev.material?.kFactor
                };

                const geometry=
                    buildProfileGeometry(
                        geometryProfile
                    );

                const vector=getShelfVector(
                    geometry,
                    index
                );

                if(!vector)return prev;

                const dx=prev.view.mirrored
                    ?-vector.x
                    :vector.x;

                const baseRotation=
                    (
                        -Math.PI/2-
                        Math.atan2(
                            vector.y,
                            dx
                        )
                    )*180/Math.PI;

                const normalize=a=>
                    ((a+180)%360+360)%360-180;

                const distance=(a,b)=>
                    Math.abs(
                        normalize(a-b)
                    );

                const rotation0=
                    baseRotation;

                const rotation180=
                    baseRotation+180;

                const current=
                    prev.view.rotation;

                const isVertical=
                    distance(
                        current,
                        rotation0
                    )<1||
                    distance(
                        current,
                        rotation180
                    )<1;

                const rotation=
                    isVertical
                        ?distance(
                            current,
                            rotation0
                        )<1
                            ?rotation180
                            :rotation0
                        :distance(
                            current,
                            rotation0
                        )<=distance(
                            current,
                            rotation180
                        )
                            ?rotation0
                            :rotation180;

                return{
                    ...prev,
                    view:{
                        ...prev.view,
                        rotation
                    }
                };
            });

            setVerticalShelfIndex(index);
        },[]);

    const handleProfileRotationChange=
        useCallback(
            value=>
                setRotationPreview(
                    Number(value)
                ),
            []
        );

    const handleProfileRotationCommitted=
        useCallback(
            value=>{
                updateState({
                    view:{
                        ...view,
                        rotation:Number(value)
                    }
                });

                setVerticalShelfIndex(null);
                setRotationPreview(null);
            },
            [updateState,view]
        );

    const handleProfileMirrorChange=
        useCallback(
            value=>{
                updateState({
                    view:{
                        ...view,
                        mirrored:Boolean(value),
                        rotation:-view.rotation
                    }
                });
            },
            [updateState,view]
        );

    const addBend=useCallback(()=>{
        updateGeometry({
            shelves:[
                ...shelves,
                {
                    length:50,
                    side:"right"
                }
            ],

            bends:[
                ...bends,
                {
                    angle:180,
                    direction:"right"
                }
            ]
        });
    },[
        shelves,
        bends,
        updateGeometry
    ]);

    const removeBend=useCallback(
        index=>{
            setState(prev=>{
                let nextIndex=
                    prev.view.bendIndex;

                if(nextIndex===index)
                    nextIndex=-1;
                else if(nextIndex>index)
                    nextIndex--;

                return{
                    ...prev,

                    geometry:{
                        ...prev.geometry,

                        bends:
                            prev.geometry.bends.filter(
                                (_,i)=>i!==index
                            ),

                        shelves:
                            prev.geometry.shelves.filter(
                                (_,i)=>i!==index+1
                            )
                    },

                    view:{
                        ...prev.view,
                        bendIndex:nextIndex
                    }
                };
            });
        },
        []
    );

    const distanceToOuterApex=useMemo(
        ()=>bendIndex<0
            ?0
            :Number(
                calculateOuterLengthToEnd(
                    geometryProfile,
                    bendIndex,
                    bendSide
                ).toFixed(2)
            ),
        [
            geometryProfile,
            bendIndex,
            bendSide
        ]
    );

    const machineParams=useMemo(
        ()=>selectedBend
            ?calculateBendingMachineParams({
                alpha:selectedBend.angle,
                lInput:distanceToOuterApex,
                isInnerMode:false,
                t:thickness,
                rTool:machine?.rTool
            })
            :null,
        [
            selectedBend,
            distanceToOuterApex,
            thickness,
            machine
        ]
    );

    const blankLength=useMemo(
        ()=>calculateBlankLength(
            geometryProfile
        ),
        [geometryProfile]
    );

    const sliderRotation=
        rotationPreview??rotation;

    return(
        <Box
            sx={{
                display:"grid",
                gridTemplateColumns:
                    "22rem minmax(22rem,1fr)",
                gridTemplateAreas:
                    `"editor preview"`,
                gap:2,
                m:1,

                "@media (max-width:calc(22rem + 22rem + 16px))":{
                    gridTemplateColumns:"1fr",
                    gridTemplateAreas:`
                        "preview"
                        "editor"
                    `,
                    mx:0
                }
            }}
        >
            <Paper
                sx={{
                    gridArea:"preview",
                    minWidth:0,
                    maxHeight:600,
                    display:"flex",
                    flexDirection:"column",
                    overflow:"hidden"
                }}
            >
                <PreviewToolbar
                    rotation={sliderRotation}
                    bendIndex={bendIndex}
                    mirrored={mirrored}
                    onRotationChange={
                        handleProfileRotationChange
                    }
                    onRotationCommitted={
                        handleProfileRotationCommitted
                    }
                    onMirror={()=>
                        handleProfileMirrorChange(
                            !mirrored
                        )
                    }
                    onFullscreen={()=>
                        navigate(
                            "/biegeberechnung/preview"
                        )
                    }
                />

                <Box
                    sx={{
                        flex:1,
                        minHeight:0,
                        minWidth:0,
                        overflow:"hidden",
                        p:1
                    }}
                >
                    <BendingPreviewPage
                        profile={geometryProfile}
                        geometry={builtGeometry}
                        machine={machine}
                        blankLength={blankLength}
                        machineParams={machineParams}
                        simulation={simulation}
                        rotationPreview={rotationPreview}
                    />
                </Box>
            </Paper>

            <Paper
                sx={{
                    gridArea:"editor",
                    minWidth:0
                }}
            >
                {shelves.map((shelf,index)=>(
                    <ProfileRow
                        key={index}
                        shelf={shelf}
                        shelves={shelves}
                        index={index}
                        bend={bends[index]}
                        bends={bends}
                        bendIndex={bendIndex}
                        bendSide={bendSide}
                        isVertical={
                            verticalShelfIndex===index
                        }
                        onUpdate={updateGeometry}
                        onSelectBend={()=>
                            handleSelectBend(index)
                        }
                        onVerticalShelfChange={()=>
                            handleVerticalShelfChange(index)
                        }
                        onRemoveBend={()=>
                            removeBend(index)
                        }
                        canRemove={
                            bends.length>1
                        }
                    />
                ))}

                <Box sx={{p:1}}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<AddIcon/>}
                        onClick={addBend}
                    >
                        Add Bend
                    </Button>
                </Box>

                <Box
                    sx={{
                        p:1,
                        display:"flex",
                        flexDirection:"column",
                        gap:1
                    }}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{mb:1}}
                    >
                        Parameters
                    </Typography>

                    <Box sx={{mb:1}}>
                        <TextField
                            label="Machine"
                            value={machine?.name||""}
                            onClick={()=>
                                setMachineDialogOpen(true)
                            }
                            size="small"
                            fullWidth
                            slotProps={{
                                htmlInput:{
                                    readOnly:true,
                                    tabIndex:-1
                                },
                                input:{
                                    endAdornment:(
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={e=>{
                                                    e.stopPropagation();

                                                    setMachineDialogOpen(
                                                        true
                                                    );
                                                }}
                                            >
                                                <DatabaseIcon
                                                    fontSize="small"
                                                />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }
                            }}
                            sx={{
                                "& .MuiInputBase-root":{
                                    cursor:"pointer"
                                },
                                "& .MuiInputBase-input":{
                                    cursor:"pointer",
                                    userSelect:"none"
                                }
                            }}
                        />
                    </Box>

                    <Box sx={{mb:1}}>
                        <TextField
                            label="Material"
                            value={material?.name||""}
                            onClick={()=>
                                setMaterialDialogOpen(true)
                            }
                            size="small"
                            fullWidth
                            slotProps={{
                                htmlInput:{
                                    readOnly:true,
                                    tabIndex:-1
                                },
                                input:{
                                    endAdornment:(
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={e=>{
                                                    e.stopPropagation();

                                                    setMaterialDialogOpen(
                                                        true
                                                    );
                                                }}
                                            >
                                                <DatabaseIcon
                                                    fontSize="small"
                                                />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }
                            }}
                            sx={{
                                "& .MuiInputBase-root":{
                                    cursor:"pointer"
                                },
                                "& .MuiInputBase-input":{
                                    cursor:"pointer",
                                    userSelect:"none"
                                }
                            }}
                        />
                    </Box>

                    <Box
                        sx={{
                            display:"grid",
                            gridTemplateColumns:
                                "1fr 1fr",
                            gap:1
                        }}
                    >
                        <ParamField
                            label="Thickness"
                            value={thickness}
                            step=".1"
                            onChange={value=>
                                updateGeometry({
                                    thickness:
                                        value===""
                                            ?""
                                            :Number(value)
                                })
                            }
                            endAdornment={
                                <Box
                                    sx={{
                                        display:"flex",
                                        alignItems:"center"
                                    }}
                                >
                                    <Box
                                        sx={{
                                            fontSize:"0.8rem"
                                        }}
                                    >
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
                                            color:
                                                "text.secondary"
                                        }}
                                    >
                                        <KeyboardArrowDownIcon
                                            fontSize="small"
                                        />
                                    </IconButton>
                                </Box>
                            }
                        />

                        <ParamField
                            label="Part width"
                            value={width}
                            step=".1"
                            onChange={value=>
                                updateGeometry({
                                    width:
                                        value===""
                                            ?""
                                            :Number(value)
                                })
                            }
                            endAdornment={
                                <Box
                                    sx={{
                                        fontSize:"0.8rem"
                                    }}
                                >
                                    mm
                                </Box>
                            }
                        />
                    </Box>

                    <Box sx={{mb:1}}>
                        <TextField
                            label="Simulation parameters"
                            value="Simulation settings"
                            onClick={()=>
                                setSimulationDialogOpen(true)
                            }
                            size="small"
                            fullWidth
                            slotProps={{
                                htmlInput:{
                                    readOnly:true,
                                    tabIndex:-1
                                },
                                input:{
                                    endAdornment:(
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={e=>{
                                                    e.stopPropagation();

                                                    setSimulationDialogOpen(
                                                        true
                                                    );
                                                }}
                                            >
                                                <DatabaseIcon
                                                    fontSize="small"
                                                />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }
                            }}
                            sx={{
                                "& .MuiInputBase-root":{
                                    cursor:"pointer"
                                },
                                "& .MuiInputBase-input":{
                                    cursor:"pointer",
                                    userSelect:"none"
                                }
                            }}
                        />
                    </Box>
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
                            selected={
                                thickness===value
                            }
                            onClick={()=>{
                                updateGeometry({
                                    thickness:value
                                });

                                setThicknessMenuAnchor(
                                    null
                                );
                            }}
                        >
                            {value} mm
                        </MenuItem>
                    ))}
                </Menu>

                <BendingDialog
                    open={materialDialogOpen}
                    title="Material"
                    value={material}
                    onClose={()=>
                        setMaterialDialogOpen(false)
                    }
                    onApply={value=>{
                        updateState({
                            material:value
                        });

                        setMaterialDialogOpen(false);
                    }}
                >
                    <MaterialContent
                        materials={MATERIALS}
                    />
                </BendingDialog>

                <BendingDialog
                    open={machineDialogOpen}
                    title="Machine"
                    value={machine}
                    onClose={()=>
                        setMachineDialogOpen(false)
                    }
                    onApply={value=>{
                        updateState({
                            machine:value
                        });

                        setMachineDialogOpen(false);
                    }}
                >
                    <MachineContent
                        machines={MACHINES}
                    />
                </BendingDialog>

                <BendingDialog
                    open={simulationDialogOpen}
                    title="Simulation parameters"
                    value={simulation}
                    onClose={()=>
                        setSimulationDialogOpen(false)
                    }
                    onApply={value=>{
                        updateState({
                            simulation:value
                        });

                        setSimulationDialogOpen(false);
                    }}
                >
                    <SimulationContent/>
                </BendingDialog>

                <Box
                    sx={{
                        px:1,
                        pb:1,
                        pt:.5,
                        textAlign:"center"
                    }}
                >
                    <Link
                        component="button"
                        type="button"
                        underline="hover"
                        onClick={()=>
                            navigate("/heating-methodology_de")
                        }
                        sx={{
                            fontSize:"0.8rem",
                            cursor:"pointer"
                        }}
                    >
                        Heating methodology
                    </Link>
                </Box>
            </Paper>
        </Box>
    );
}