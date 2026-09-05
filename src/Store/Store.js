import {configureStore} from "@reduxjs/toolkit";
import bendingReducer from "./bendingSlice";

const store = configureStore({
    reducer: {
        bending: bendingReducer
    }
});

export default store;