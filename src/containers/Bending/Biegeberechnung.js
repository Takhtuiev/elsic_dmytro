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
import DatabaseIcon from "@mui/icons-material/Storage";
import PrintIcon from "@mui/icons-material/Print";
import {useDispatch,useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";

import ProfileRow from "./ProfileRow";

import {
    calculateBlankLength,
    calculateOuterLengthToEnd,
    calculateBendingMachineParams
} from "./Calculations";
import buildProfileGeometry from "./BuildProfileGeometry";
import {
    getShelfVector,
    getPreferredSide,
    calculateBendView
} from "./profileViewMath";
import {
    setProfile
} from "../../Store/bendingSlice";
import {
    openDialog,
    selectLastReturnedData,
    clearDialogDataReturned
} from "../../Store/dialogSlice";
import {
    MATERIALS,
    MACHINES
} from "./parameters";
import BendingPreview from "./BendingPreview";
import {BayeusianLogDialog} from "./Heating2DSimulation/BayeusianLogDialog";


const INITIAL_STATE={
    name:"Detail-4301",

    material:MATERIALS["PVC_CAW_RED"],
    machine:MACHINES["MACHINE_LINE_2"],

    geometry:{
        thickness:4,
        width:430,

        shelves:[
            {
                length:50,
                side:"right"
            },
            {
                length:100,
                side:"right"
            },
            {
                length:150,
                side:"left"
            }
        ],

        bends:[
            {
                angle:90,
                direction:"right"
            },
            {
                angle:135,
                direction:"left"
            }
        ]
    },

    simulation: {
        // --- Физические параметры ---
        target: {
            type: "minTemperature",
            value: (MATERIALS["PVC_CAW_RED"]?.minFormingTemp + MATERIALS["PVC_CAW_RED"]?.maxFormingTemp) / 2
        },
        widthHalfMm: 20,
        temperatures: { ambientC: 20, ambientRadiationC: 20, initialC: 20 },
        cooling: { timeSeconds: 10, convectiveHeatTransferCoefficient: 8 },
        stopAtMaxTemperature: true,
        maxTimeSeconds: 1800,

        // ПАРАМЕТРЫ ДЛЯ ДВИЖКА ТОЧНОСТИ ВЫЧИСЛЕНИЙ
        accuracyMode: "optimal",          // Режим по умолчанию ("fast", "optimal", "accurate")
        calculateAccuracyError: true,     // Включен ли расчет погрешности по умолчанию

        // --- Флаг движка (управляется автоматически через ui.showTimeDynamics) ---
        recordHistory: false,              // Выставили true, так как ниже showTimeDynamics: true

        // --- Флаги отображения графиков (управление из интерфейса) ---
        ui: {
            showVerticalSlice: true,   // График 1: Вертикальный срез по толщине
            showHorizontalWidth: true, // График 2: Распределение по ширине
            showTimeDynamics: true,    // График 3: Динамика во времени (История нагрева)
            showContours2D: true       // График 4: 2D Изотермы (Контуры)
        }
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
                          onMirror
                      })=>(
    <Box
        className="bending-preview-toolbar"
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

        <Tooltip title="Print">
            <IconButton
                size="small"
                onClick={()=>window.print()}
                sx={{
                    color:"text.secondary"
                }}
            >
                <PrintIcon/>
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

    const lastReturnedData=useSelector(
        selectLastReturnedData
    );

    const [state,setState]=useState(
        profile??INITIAL_STATE
    );

    const [isLogOpen, setIsLogOpen] = useState(false);

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

    useEffect(()=>{
        dispatch(setProfile(state));
    },[state,dispatch]);

    useEffect(()=>{
        if(!lastReturnedData){
            return;
        }

        const {
            dialogType,
            data
        }=lastReturnedData;

        const value=data?.value;

        if(value===undefined){
            dispatch(clearDialogDataReturned());
            return;
        }

        if(dialogType==="material"){
            setState(prev=>({
                ...prev,
                material:value
            }));
        }

        if(dialogType==="machine"){
            setState(prev=>({
                ...prev,
                machine:value
            }));
        }

        if(dialogType==="simulation"){
            setState(prev=>({
                ...prev,
                simulation:value
            }));
        }

        dispatch(clearDialogDataReturned());
    },[
        lastReturnedData,
        dispatch
    ]);

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
                    const [
                        collection,
                        index,
                        field
                    ]=changes.path;

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
                        (
                            field==="angle"||
                            field==="direction"
                        )&&
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
        ()=>buildProfileGeometry(
            geometryProfile
        ),
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

                if(
                    prev.view.bendIndex!==index
                ){
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

                if(!vector){
                    return prev;
                }

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

                if(nextIndex===index){
                    nextIndex=-1;
                }else if(nextIndex>index){
                    nextIndex--;
                }

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

    const openMaterialDialog=useCallback(()=>{
        dispatch(
            openDialog({
                id:"material",
                dialogType:"material",
                title:"Material",
                data:{
                    value:material,
                    materials:MATERIALS
                }
            })
        );
    },[
        dispatch,
        material
    ]);

    const openMachineDialog=useCallback(()=>{
        dispatch(
            openDialog({
                id:"machine",
                dialogType:"machine",
                title:"Machine",
                data:{
                    value:machine,
                    machines:MACHINES
                }
            })
        );
    },[
        dispatch,
        machine
    ]);

    const openSimulationDialog=useCallback(()=>{
        dispatch(
            openDialog({
                id:"simulation",
                dialogType:"simulation",
                title:"Simulation parameters",
                data:{
                    value:simulation
                }
            })
        );
    },[
        dispatch,
        simulation
    ]);

    return(
        <Box
            className="biege-main-page"
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
                className="bending-preview-paper"
                sx={{
                    gridArea:"preview",
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
                />

                <Box
                    className="bending-preview-content"
                    sx={{
                        flex:1,
                        minHeight:0,
                        minWidth:0,
                        overflow:"hidden",
                        p:1
                    }}
                >
                    <BendingPreview
                        profile={geometryProfile}
                        geometry={builtGeometry}
                        blankLength={blankLength}
                        machineParams={machineParams}
                        simulation={simulation}
                        rotationPreview={rotationPreview}
                    />
                </Box>
            </Paper>

            <Paper
                className="bending-editor-paper"
                sx={{
                    gridArea:"editor",
                    minWidth:0
                }}
            >
                <Box sx={{my:1}}>
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
                </Box>

                <Box sx={{p:1}}>
                    <Button
                        sx={{
                            width:"10rem",
                            mx:"auto",
                            display:"flex",
                            whiteSpace:"nowrap"
                        }}
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
                            onClick={openMachineDialog}
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
                                                    openMachineDialog();
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
                            onClick={openMaterialDialog}
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
                                                    openMaterialDialog();
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
                                            color:"text.secondary"
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
                            onClick={openSimulationDialog}
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
                                                    openSimulationDialog();
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

                {/* Блок кнопок оптимизации и логирования */}
                <Box sx={{ mt: 1, mb: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                    <Button variant="contained" fullWidth onClick={() => setIsLogOpen(true)}>
                        🚀 BO Dashboard
                    </Button>
                </Box>

                {/* Компонент диалога с кнопками управления внутри */}
                <BayeusianLogDialog
                    open={isLogOpen}
                    onClose={() => setIsLogOpen(false)}
                    parentState={state}
                    setParentState={setState}
                />


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
                                updateGeometry({
                                    thickness:value
                                });

                                setThicknessMenuAnchor(null);
                            }}
                        >
                            {value} mm
                        </MenuItem>
                    ))}
                </Menu>

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
                            navigate(
                                "/heating-methodology_de"
                            )
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