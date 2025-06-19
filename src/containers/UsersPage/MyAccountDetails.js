import React, { useEffect } from "react";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import { useGetMyAccountQuery } from "../../services/Slice/userApi";
import AccountEditCard from "../../components/UserCard/AccountEditCard";
import { Box } from "@mui/system";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import { useSelector } from "react-redux";

function MyAccountDetails() {
    const jwtUserDetails = useSelector(state => state.jwtUser.userDetails);

    const {
        data: user,
        error: errorGetUser,
        isFetching: loading,
        refetch,
    } = useGetMyAccountQuery();

    useEffect(() => {
        refetch();
    }, [jwtUserDetails, refetch]);

    if (errorGetUser) {
        return <ErrorCard error={errorGetUser} />;
    }

    return (
        <>
            <TopLinearLoading active={loading} />
            <LoadingSpinner active={loading}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <AccountEditCard user={user} />
                </Box>
            </LoadingSpinner>
        </>
    );
}

export default MyAccountDetails;
