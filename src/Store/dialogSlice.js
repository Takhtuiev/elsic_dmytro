import {createSlice} from "@reduxjs/toolkit";

const initialState={
    stack:[],
    lastReturnedData:null
};

const dialogSlice=createSlice({
    name:"dialog",
    initialState,
    reducers:{
        openDialog:(state,action)=>{
            const dialog=action.payload;

            state.stack.push({
                ...dialog,
                draft:dialog.data?.value
            });
        },

        updateDialogDraft:(state,action)=>{
            const current=
                state.stack[state.stack.length-1];

            if(!current){
                return;
            }

            current.draft=action.payload;
        },

        closeDialog:(state,action)=>{
            if(!state.stack.length){
                return;
            }

            const dialog=state.stack.pop();

            state.lastReturnedData={
                dialogId:dialog.id,
                dialogType:dialog.dialogType,
                data:action.payload??null
            };
        },

        clearDialogStack:(state)=>{
            state.stack=[];
        },

        clearDialogDataReturned:(state)=>{
            state.lastReturnedData=null;
        }
    }
});

export const {
    openDialog,
    updateDialogDraft,
    closeDialog,
    clearDialogStack,
    clearDialogDataReturned
}=dialogSlice.actions;

export const selectCurrentDialog=(state)=>
    state.dialog.stack[
    state.dialog.stack.length-1
        ]??null;

export const selectDialogStack=(state)=>
    state.dialog.stack;

export const selectLastReturnedData=(state)=>
    state.dialog.lastReturnedData;

export default dialogSlice.reducer;