import {createSlice} from "@reduxjs/toolkit";

const initialState = {
    profile: null
};

const bendingSlice = createSlice({
    name: "bending",
    initialState,

    reducers: {
        setProfile: (state, action) => {
            state.profile = action.payload;
        },

        clearProfile: state => {
            state.profile = null;
        }
    }
});

export const {
    setProfile,
    clearProfile
} = bendingSlice.actions;

export default bendingSlice.reducer;