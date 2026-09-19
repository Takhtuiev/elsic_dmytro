import React,{useEffect,useState} from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle
} from "@mui/material";

export default function BendingDialog({
    open,
    title,
    value,
    children,
    onApply,
    onClose,
    applyDisabled=false
}){
    const [draft,setDraft]=useState(value);

    useEffect(()=>{
        if(open){
            setDraft(value);
        }
    },[open,value]);

    const handleClose=()=>{
        onClose();
    };

    const handleApply=()=>{
        onApply(draft);
    };

    return(
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="md"
            sx={{
                "& .MuiDialog-container":{
                    overflowY:"auto",
                    alignItems:{
                        xs:"flex-start",
                        sm:"center"
                    },
                    py:{
                        xs:0,
                        sm:2
                    }
                },
                "& .MuiDialog-paper":{
                    width:"100%",
                    m:{
                        xs:0,
                        sm:2
                    },
                    maxHeight:{
                        xs:"none",
                        sm:"calc(100% - 32px)"
                    },
                    borderRadius:{
                        xs:0,
                        sm:2
                    }
                }
            }}
        >

            <DialogTitle
                sx={{
                    fontWeight:600,
                    pb:1
                }}
            >
                {title}
            </DialogTitle>

            <DialogContent dividers>
                {React.cloneElement(children,{
                    value:draft,
                    onChange:setDraft
                })}
            </DialogContent>

            <DialogActions
                sx={{
                    p:2,
                    bgcolor:"background.paper"
                }}
            >

                <Button
                    onClick={handleClose}
                    color="inherit"
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    disabled={applyDisabled}
                    onClick={handleApply}
                    disableElevation
                    sx={{
                        borderRadius:1.5
                    }}
                >
                    Apply
                </Button>

            </DialogActions>

        </Dialog>
    );
}
