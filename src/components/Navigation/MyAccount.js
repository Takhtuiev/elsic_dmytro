import React, { useCallback, useState } from "react";
import {
    Avatar,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/material";
import { useClerk, useUser } from "@clerk/clerk-react";

function UserBar() {
    const { user, isLoaded } = useUser();
    const { signOut, openUserProfile } = useClerk();

    const [anchorEl, setAnchorEl] = useState(null);

    const handleOpenMenu = useCallback((event) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleCloseMenu = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleAccount = useCallback(() => {
        handleCloseMenu();
        openUserProfile();
    }, [handleCloseMenu, openUserProfile]);

    const handleLogout = useCallback(async () => {
        handleCloseMenu();
        await signOut();
    }, [handleCloseMenu, signOut]);

    if (!isLoaded) {
        return null;
    }

    if (!user) {
        return (
            <Button
                onClick={() => {
                    // Здесь позже можно использовать openSignIn()
                }}
                sx={{
                    textTransform: "none",
                    fontSize: "0.9rem",
                }}
            >
                Login
            </Button>
        );
    }

    const username =
        user.fullName ||
        user.username ||
        user.primaryEmailAddress?.emailAddress ||
        "User";

    const initials = username
        .split(" ")
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");

    return (
        <>
            <Tooltip title={username}>
                <IconButton
                    onClick={handleOpenMenu}
                    size="small"
                >
                    <Avatar
                        src={user.imageUrl}
                        sx={{
                            width: 36,
                            height: 36,
                        }}
                    >
                        {initials}
                    </Avatar>
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                sx={{
                    mt: "45px",
                }}
            >
                <MenuItem onClick={handleAccount}>
                    <Typography>
                        Account
                    </Typography>
                </MenuItem>

                <MenuItem onClick={handleLogout}>
                    <Typography>
                        Logout
                    </Typography>
                </MenuItem>
            </Menu>
        </>
    );
}

export default UserBar;