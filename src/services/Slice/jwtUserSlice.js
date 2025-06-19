
import { createSlice } from "@reduxjs/toolkit";

const jwtUserSlice = createSlice({
    name: "jwtUser",
    initialState: {
        userDetails: null,
    },
    reducers: {
        setJwtUserDetails: (state, action) => {
            state.userDetails = action.payload;
        },
        clearJwtUserDetails: (state) => {
            state.userDetails = null;
        },
    },
});

export const { setJwtUserDetails, clearJwtUserDetails } = jwtUserSlice.actions;
export default jwtUserSlice.reducer;
