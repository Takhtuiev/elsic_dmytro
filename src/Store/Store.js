import {configureStore} from "@reduxjs/toolkit";
import bendingReducer from "./bendingSlice";
import dialogReducer from "./dialogSlice";

const store=configureStore({
    reducer:{
        bending:bendingReducer,
        dialog:dialogReducer
    }
});

export default store;