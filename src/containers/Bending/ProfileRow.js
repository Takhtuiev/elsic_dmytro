import React,{memo,useState} from "react";
import {
    Box,IconButton,InputAdornment,TextField,Tooltip,useTheme,
    Menu,MenuItem
} from "@mui/material";
import HeightIcon from "@mui/icons-material/Height";
import DeleteIcon from "@mui/icons-material/Clear";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import AdjustIcon from "@mui/icons-material/Adjust";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

const handleNumberKeyDown=e=>{
    const allowed=["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab","Home","End"];
    if(allowed.includes(e.key)||e.ctrlKey||e.metaKey)return;
    if(!/^[0-9.,]$/.test(e.key))return e.preventDefault();
    if(/[.,]/.test(e.key)&&/[.,]/.test(e.currentTarget.value))e.preventDefault();
};

const sanitizeNumber=value=>{
    let result=value.replace(",",".").replace(/[^0-9.]/g,"");
    const parts=result.split(".");
    return parts.length>2?parts[0]+"."+parts.slice(1).join(""):result;
};

const ProfileRow=memo(({
    shelf,bend,index,verticalShelf,firstBendIndex,bendViewMode,
    onShelfChange,onShelfSideChange,onVerticalShelfChange,
    onBendChange,onBendDirectionChange,onSelectFirstBend,
    onRemoveBend,canRemove
})=>{
    const theme=useTheme();
    const [angleMenuAnchor,setAngleMenuAnchor]=useState(null);

    const isVertical=verticalShelf===index+1;
    const isSelected=firstBendIndex===index;

    const iconBtnStyle=(active=false,color="primary.main")=>({
        borderRadius:"6px",border:"1px solid",
        borderColor:active?color:"divider",
        backgroundColor:"background.paper",
        color:active?color:"text.secondary",
        width:36,height:36,p:0,flexShrink:0
    });

    const bendColor=isSelected
        ?bendViewMode==="toEnd"?"success.main":"warning.main"
        :"primary.main";

    return(
        <Box sx={{display:"flex",flexDirection:"column",width:"100%"}}>
            <Box sx={{
                display:"flex",alignItems:"center",gap:1,width:"100%",p:1,
                borderRadius:"6px",border:"1px solid",
                borderColor:"divider",backgroundColor:"background.paper"
            }}>
                <TextField
                    label={`Leg ${index+1}`}
                    type="text"
                    inputMode="decimal"
                    value={shelf.length}
                    size="small"
                    fullWidth
                    onKeyDown={handleNumberKeyDown}
                    onChange={e=>onShelfChange(index,sanitizeNumber(e.target.value))}
                    slotProps={{
                        htmlInput:{min:0,step:0.01},
                        input:{
                            endAdornment:<InputAdornment position="end">
                                <Box sx={{fontSize:"0.7rem"}}>mm</Box>
                            </InputAdornment>
                        }
                    }}
                />

                <Tooltip title="Switch side">
                    <IconButton
                        size="small"
                        onClick={()=>onShelfSideChange(
                            index,shelf.side==="right"?"left":"right"
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
                    firstBendIndex!==-1
                        ?"Disabled when an angle is selected"
                        :"Mark as vertical"
                }>
                    <span style={{display:"inline-flex"}}>
                        <IconButton
                            size="small"
                            color={isVertical?"primary":"default"}
                            onClick={()=>onVerticalShelfChange(index)}
                            disabled={firstBendIndex!==-1}
                            sx={{
                                ...iconBtnStyle(isVertical),
                                "&.Mui-disabled":{
                                    borderColor:"divider",
                                    backgroundColor:"action.hover",
                                    color:"text.disabled"
                                }
                            }}
                        >
                            <HeightIcon fontSize="small"/>
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {bend&&(
                <Box sx={{
                    display:"flex",alignItems:"center",width:"100%",
                    position:"relative",py:1.5,pl:4,boxSizing:"border-box"
                }}>
                    <svg
                        style={{
                            position:"absolute",left:"12px",top:0,bottom:0,
                            height:"100%",width:"17px"
                        }}
                        viewBox="0 0 17 100"
                        preserveAspectRatio="none"
                    >
                        <path
                            d="M2,0 L15,50 L2,100"
                            fill="none"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                            style={{
                                stroke:isSelected
                                    ?theme.palette.primary.main
                                    :theme.palette.text.secondary,
                                transition:"stroke 0.2s ease"
                            }}
                        />
                    </svg>

                    <Box sx={{
                        display:"flex",alignItems:"center",gap:1,width:"100%",
                        p:1,borderRadius:"6px",border:"1px solid",
                        borderColor:isSelected?"primary.main":"divider",
                        backgroundColor:"action.hover"
                    }}>
                        <TextField
                            label={`Angle ${index+1}`}
                            type="text"
                            inputMode="decimal"
                            value={bend.angle}
                            size="small"
                            fullWidth
                            onKeyDown={handleNumberKeyDown}
                            onChange={e=>onBendChange(index,sanitizeNumber(e.target.value))}
                            slotProps={{
                                htmlInput:{min:0,max:180,step:0.01},
                                input:{
                                    endAdornment:<InputAdornment position="end">
                                        <Box sx={{display:"flex",alignItems:"center"}}>
                                            <Box sx={{fontSize:"0.8rem",mr:0.2}}>°</Box>
                                            <IconButton
                                                size="small"
                                                onClick={e=>setAngleMenuAnchor(e.currentTarget)}
                                                sx={{p:0.25,color:"text.secondary"}}
                                            >
                                                <KeyboardArrowDownIcon fontSize="small"/>
                                            </IconButton>
                                        </Box>
                                    </InputAdornment>
                                }
                            }}
                        />

                        <Menu
                            anchorEl={angleMenuAnchor}
                            open={Boolean(angleMenuAnchor)}
                            onClose={()=>setAngleMenuAnchor(null)}
                        >
                            {[90,135].map(angle=>(
                                <MenuItem
                                    key={angle}
                                    onClick={()=>{
                                        onBendChange(index,String(angle));
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
                                    onClick={()=>onRemoveBend(index)}
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
                                onClick={()=>onBendDirectionChange(
                                    index,bend.direction==="right"?"left":"right"
                                )}
                                sx={iconBtnStyle(true)}
                            >
                                {bend.direction==="right"
                                    ?<RedoIcon
                                        fontSize="small"
                                        style={{transform:"rotate(-90deg)"}}
                                    />
                                    :<UndoIcon
                                        fontSize="small"
                                        style={{transform:"rotate(90deg)"}}
                                    />
                                }
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Section view: click to switch">
                            <IconButton
                                size="small"
                                onClick={()=>onSelectFirstBend(index)}
                                sx={iconBtnStyle(isSelected,bendColor)}
                            >
                                {isSelected
                                    ?<AdjustIcon fontSize="small"/>
                                    :<RadioButtonUncheckedIcon fontSize="small"/>
                                }
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            )}
        </Box>
    );
});

export default ProfileRow;
