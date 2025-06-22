import { createSlice } from "@reduxjs/toolkit";

const jwtUserSlice = createSlice({
    name: "jwtUser",
    initialState: {
        userDetails: null,
        isAuthenticated: false,
    },
    reducers: {
        setJwtUserDetails: (state, action) => {
            state.userDetails = action.payload;
            state.isAuthenticated = true;
            localStorage.setItem("jwtUser", JSON.stringify(action.payload));
        },
        clearJwtUserDetails: (state) => {
            state.userDetails = null;
            state.isAuthenticated = false;
            localStorage.removeItem("jwtUser");
        },
        updateJwtUserDetails: (state, action) => {
            state.userDetails = {
                ...state.userDetails,
                ...action.payload,
            };
            localStorage.setItem("jwtUser", JSON.stringify(state.userDetails));
        },
        loadJwtUserFromStorage: (state) => {
            const storedUser = localStorage.getItem("jwtUser");
            if (storedUser) {
                state.userDetails = JSON.parse(storedUser);
                state.isAuthenticated = true;
            }
        },
    },
});

export const {
    setJwtUserDetails,
    clearJwtUserDetails,
    updateJwtUserDetails,
    loadJwtUserFromStorage
} = jwtUserSlice.actions;

export const selectJwtUserDetails = (state) => state.jwtUser.userDetails;
export const selectIsAuthenticated = (state) => state.jwtUser.isAuthenticated;

export default jwtUserSlice.reducer;
