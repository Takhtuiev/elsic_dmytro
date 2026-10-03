import React from "react";
import {useDispatch,useSelector} from "react-redux";

import BendingDialog from "./BendingDialog";

import {
    selectCurrentDialog,
    updateDialogDraft,
    closeDialog
} from "../Store/dialogSlice";

import MaterialContent from "../containers/Bending/MaterialContent";
import MaterialEditContent from "../containers/Bending/MaterialEditContent";
import MachineContent from "../containers/Bending/MachineContent";
import SimulationContent from "../containers/Bending/SimulationContent";
import MachineEditContent from "../containers/Bending/MachineEditContent";

const dialogContent={
    material:MaterialContent,
    "material-edit":MaterialEditContent,
    machine:MachineContent,
    "machine-edit":MachineEditContent,
    simulation:SimulationContent,
};
export default function DialogManager(){
    const dispatch=useDispatch();
    const dialog=useSelector(selectCurrentDialog);

    if(!dialog){
        return null;
    }

    const Content=dialogContent[dialog.dialogType];

    if(!Content){
        console.error(
            `Unknown dialog type: ${dialog.dialogType}`
        );
        return null;
    }

    const handleChange=value=>{
        dispatch(
            updateDialogDraft(value)
        );
    };

    const handleClose=()=>{
        dispatch(closeDialog());
    };

    const handleApply=value=>{
        dispatch(
            closeDialog({
                value
            })
        );
    };

    return(
        <BendingDialog
            open
            title={dialog.title}
            value={dialog.draft}
            onChange={handleChange}
            onClose={handleClose}
            onApply={handleApply}
            renderContent={({value,onChange})=>(
                <Content
                    {...dialog.data}
                    value={value}
                    onChange={onChange}
                />
            )}
        />
    );
}