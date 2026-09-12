import React,{memo,useState} from "react";
import {
    Box,IconButton,InputAdornment,TextField,Tooltip,useTheme,
    Menu,MenuItem
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Clear";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

const BendSelectIcon=({isSelected,bendSide})=>(
    <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        style={{display:"block",flexShrink:0}}
    >
        <path
            d="M2.25 7 L10 20.42 L25.5 20.42"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />

        <path
            d="M17 20.42 A7 7 0 0 0 6.5 14.36"
            stroke="currentColor"
            strokeWidth=".7"
            strokeLinecap="round"
        />

        {isSelected&&(
            bendSide==="toEnd"
                ?<path
                    d="M10 5 L14 9 L18 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                :<path
                    d="M10 9 L14 5 L18 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
        )}
    </svg>
);

const VerticalIcon=()=>(
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{display:"block",flexShrink:0}}
    >
        <path
            d="M11 1V23M13 1V23"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
        />
    </svg>
);

const handleNumberKeyDown=e=>{
    const allowed=[
        "Backspace","Delete","ArrowLeft","ArrowRight",
        "ArrowUp","ArrowDown","Tab","Home","End"
    ];

    if(allowed.includes(e.key)||e.ctrlKey||e.metaKey) return;

    if(
        !/^[0-9.,]$/.test(e.key)||
        (/[.,]/.test(e.key)&&/[.,]/.test(e.currentTarget.value))
    )
        e.preventDefault();
};

const sanitizeNumber=value=>{
    const result=value.replace(",",".").replace(/[^0-9.]/g,"");
    const [first,...rest]=result.split(".");

    return rest.length
        ?`${first}.${rest.join("")}`
        :result;
};

const ProfileRow=memo(({
                           shelf,
                           bend,
                           index,
                           bendIndex,
                           bendSide,
                           onUpdate,
                           onVerticalShelfChange,
                           isVertical,
                           onSelectBend,
                           onRemoveBend,
                           canRemove
                       })=>{
    const theme=useTheme();
    const [angleMenuAnchor,setAngleMenuAnchor]=useState(null);

    const isSelected=bendIndex===index;

    const iconBtnStyle=(active=false,color="primary.main")=>({
        borderRadius:"6px",
        border:"1px solid",
        borderColor:active?color:"divider",
        backgroundColor:"background.paper",
        color:active?color:"text.secondary",
        width:36,
        height:36,
        p:0,
        flexShrink:0
    });

    const numberField=(label,value,onChange,unit,extra={})=>(
        <TextField
            label={label}
            type="text"
            inputMode="decimal"
            value={value}
            size="small"
            fullWidth
            onKeyDown={handleNumberKeyDown}
            onChange={e=>onChange(sanitizeNumber(e.target.value))}
            slotProps={{
                htmlInput:{
                    min:0,
                    step:.01,
                    ...extra
                },
                input:{
                    endAdornment:unit&&(
                        <InputAdornment position="end">
                            {unit}
                        </InputAdornment>
                    )
                }
            }}
        />
    );

    const updateShelf=(field,value)=>
        onUpdate("shelves",index,field,value);

    const updateBend=(field,value)=>
        onUpdate("bends",index,field,value);

    return(
        <Box sx={{
            display:"flex",
            flexDirection:"column",
            width:"100%"
        }}>
            {/* Shelf */}
            <Box sx={{
                display:"flex",
                alignItems:"center",
                gap:1,
                width:"100%",
                p:1,
                borderRadius:"6px",
                border:"1px solid",
                borderColor:"divider",
                backgroundColor:"background.paper"
            }}>
                {numberField(
                    `Leg ${index+1}`,
                    shelf.length,
                    value=>updateShelf("length",value),
                    <Box sx={{fontSize:".8rem"}}>
                        mm
                    </Box>
                )}

                <Tooltip title="Switch side">
                    <IconButton
                        size="small"
                        onClick={()=>updateShelf(
                            "side",
                            shelf.side==="right"
                                ?"left"
                                :"right"
                        )}
                        sx={iconBtnStyle(true)}
                    >
                        {shelf.side==="right"
                            ?<ArrowForwardIcon fontSize="small"/>
                            :<ArrowBackIcon fontSize="small"/>
                        }
                    </IconButton>
                </Tooltip>

                <Tooltip title={
                    bendIndex!==-1
                        ?"Disabled when an angle is selected"
                        :isVertical
                            ?"Vertical shelf"
                            :"Make vertical"
                }>
                    <span style={{display:"inline-flex"}}>
                        <IconButton
                            size="small"
                            onClick={()=>onVerticalShelfChange(index)}
                            disabled={bendIndex!==-1}
                            sx={{
                                ...iconBtnStyle(isVertical),
                                "&:hover":{
                                    borderColor:"primary.main",
                                    color:"primary.main"
                                },
                                "&.Mui-disabled":{
                                    opacity:1,
                                    borderColor:"divider",
                                    backgroundColor:"action.hover",
                                    color:"text.disabled"
                                }
                            }}
                        >
                            <VerticalIcon/>
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {/* Bend */}
            {bend&&(
                <Box sx={{
                    display:"flex",
                    alignItems:"center",
                    width:"100%",
                    position:"relative",
                    py:1.5,
                    pl:4,
                    boxSizing:"border-box"
                }}>
                    <svg
                        style={{
                            position:"absolute",
                            left:12,
                            top:0,
                            bottom:0,
                            height:"100%",
                            width:17
                        }}
                        viewBox="0 0 17 100"
                        preserveAspectRatio="none"
                    >
                        <path
                            d="M2,0 L15,50 L2,100"
                            fill="none"
                            strokeWidth="1.5"
                            style={{
                                stroke:theme.palette.divider
                            }}
                        />
                    </svg>

                    <Box sx={{
                        display:"flex",
                        alignItems:"center",
                        gap:1,
                        width:"100%",
                        p:1,
                        borderRadius:"6px",
                        border:"1px solid",
                        borderColor:isSelected
                            ?"primary.main"
                            :"divider",
                        backgroundColor:"action.hover"
                    }}>
                        {numberField(
                            `Angle ${index+1}`,
                            bend.angle,
                            value=>updateBend("angle",value),
                            <Box sx={{
                                display:"flex",
                                alignItems:"center"
                            }}>
                                °
                                 <IconButton
                                    size="small"
                                    onClick={e=>
                                        setAngleMenuAnchor(
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
                            </Box>,
                            {max:180}
                        )}

                        <Menu
                            anchorEl={angleMenuAnchor}
                            open={Boolean(angleMenuAnchor)}
                            onClose={()=>
                                setAngleMenuAnchor(null)
                            }
                        >
                            {[90,135].map(angle=>(
                                <MenuItem
                                    key={angle}
                                    onClick={()=>{
                                        updateBend(
                                            "angle",
                                            String(angle)
                                        );
                                        setAngleMenuAnchor(null);
                                    }}
                                >
                                    {angle}°
                                </MenuItem>
                            ))}
                        </Menu>

                        {canRemove&&(
                            <Tooltip title="Delete angle">
                                <IconButton
                                    size="small"
                                    onClick={()=>
                                        onRemoveBend(index)
                                    }
                                    sx={{
                                        ...iconBtnStyle(),
                                        "&:hover":{
                                            borderColor:"error.main",
                                            color:"error.main"
                                        }
                                    }}
                                >
                                    <DeleteIcon fontSize="small"/>
                                </IconButton>
                            </Tooltip>
                        )}

                        <Tooltip title="Switch bend direction">
                            <IconButton
                                size="small"
                                onClick={()=>updateBend(
                                    "direction",
                                    bend.direction==="right"
                                        ?"left"
                                        :"right"
                                )}
                                sx={iconBtnStyle(true)}
                            >
                                {bend.direction==="right"
                                    ?<RedoIcon
                                        fontSize="small"
                                        style={{
                                            transform:"rotate(-90deg)"
                                        }}
                                    />
                                    :<UndoIcon
                                        fontSize="small"
                                        style={{
                                            transform:"rotate(90deg)"
                                        }}
                                    />
                                }
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={
                            isSelected
                                ?"Selected bend — click to switch side"
                                :"Select bend for section view"
                        }>
                            <IconButton
                                size="small"
                                onClick={()=>onSelectBend(index)}
                                sx={{
                                    ...iconBtnStyle(isSelected),
                                    display:"inline-flex",
                                    alignItems:"center",
                                    justifyContent:"center"
                                }}
                            >
                                <BendSelectIcon
                                    isSelected={isSelected}
                                    bendSide={bendSide}
                                />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            )}
        </Box>
    );
});

export default ProfileRow;