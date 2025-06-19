import React from "react";
import { useSelector } from "react-redux";

const WithRoleContent = ({ allowedRoles, children }) => {
    const jwtUserDetails = useSelector(state => state.jwtUser.userDetails);

    if (jwtUserDetails?.roles?.some(role => allowedRoles.includes(role))) {
        return <>{children}</>;
    } else {
        return null;
    }
};

export default WithRoleContent;
