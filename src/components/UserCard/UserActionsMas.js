import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import React from "react";

export const UserActionsMas = (user) => [

    {
        role: "USER_EDIT",
        title: `Edit user ${user.username}`,
        maxWidth: "md",
        componentKey: "UserEditPropertiesCard",
        props: {
            user: user,
         },
        content: <EditIcon sx={{ fontSize: "1.2rem" }}/>,
    },
    {
        role: "USER_DEL",
        title: `Delete user ${user.username}`,
        componentKey: "DeleteUser",
        props: {
            itemId: user.id,
            bodyText: `Are you sure you want to delete user ${user.username}?`,
        },
        content: <DeleteForeverIcon color="error" sx={{ fontSize: "1.2rem" }}/>,
    },

];
