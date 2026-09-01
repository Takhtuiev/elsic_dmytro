import React, { useState } from "react";
import {
    Avatar,
    Box,
    Button,
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Typography,
    useTheme,
} from "@mui/material";
import {
    AccountCircleOutlined,
    LogoutOutlined,
} from "@mui/icons-material";
import {
    SignInButton,
    useClerk,
    useUser,
} from "@clerk/clerk-react";
import { dark } from "@clerk/ui/themes";

function UserBar() {
    const { user, isLoaded } = useUser();
    const { signOut, openUserProfile } = useClerk();
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    if (!isLoaded) return null;

    const clerkAppearance = isDark ? { theme: dark } : {};

    if (!user) {
        return (
            <SignInButton mode="modal" appearance={clerkAppearance}>
                <Button
                    variant="outlined"
                    sx={{
                        minWidth: 78,
                        height: 36,
                        px: 1.8,
                        borderRadius: 1.5,
                        textTransform: "none",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        letterSpacing: 0.2,
                        color: "text.primary",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        "&:hover": {
                            bgcolor: "action.hover",
                            borderColor: "text.secondary",
                        },
                    }}
                >
                    Login
                </Button>
            </SignInButton>
        );
    }
    
    const name =
        user.fullName ||
        user.firstName ||
        user.username ||
        "User";

    const email =
        user.primaryEmailAddress?.emailAddress || "";

    const handleOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleProfile = () => {
        handleClose();
        openUserProfile({
            appearance: clerkAppearance,
        });
    };

    const handleSignOut = async () => {
        handleClose();
        await signOut();
    };

    return (
        <>
            <IconButton
                onClick={handleOpen}
                sx={{
                    width: 42,
                    height: 42,
                    p: 0.5,
                    borderRadius: "50%",
                    transition: "all .2s ease",
                    "&:hover": {
                        bgcolor: isDark
                            ? "rgba(255,255,255,.08)"
                            : "rgba(0,0,0,.05)",
                    },
                    "&:focus-visible": {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                    },
                }}
            >
                <Avatar
                    src={user.imageUrl}
                    alt={name}
                    sx={{
                        width: 34,
                        height: 34,
                        fontSize: 14,
                        fontWeight: 700,
                        bgcolor: "primary.main",
                    }}
                >
                    {name.charAt(0).toUpperCase()}
                </Avatar>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1,
                            width: 280,
                            borderRadius: 2.5,
                            overflow: "hidden",
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            boxShadow: isDark
                                ? "0 16px 45px rgba(0,0,0,.45)"
                                : "0 12px 35px rgba(20,30,50,.12)",
                            "& .MuiMenuItem-root": {
                                borderRadius: 1.5,
                                mx: 0.75,
                                my: 0.25,
                                py: 1,
                            },
                        },
                    },
                }}
            >
                <Box sx={{ px: 2, py: 1.75 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                        }}
                    >
                        <Avatar
                            src={user.imageUrl}
                            alt={name}
                            sx={{
                                width: 44,
                                height: 44,
                                fontWeight: 700,
                                bgcolor: "primary.main",
                            }}
                        >
                            {name.charAt(0).toUpperCase()}
                        </Avatar>

                        <Box sx={{ minWidth: 0 }}>
                            <Typography
                                fontWeight={700}
                                noWrap
                                sx={{ lineHeight: 1.3 }}
                            >
                                {name}
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                                noWrap
                                sx={{ mt: 0.25 }}
                            >
                                {email}
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                <Divider />

                <Box sx={{ py: 0.75 }}>
                    <MenuItem onClick={handleProfile}>
                        <ListItemIcon>
                            <AccountCircleOutlined fontSize="small" />
                        </ListItemIcon>

                        <ListItemText
                            primary="Profile"
                            secondary="Manage your account"
                        />
                    </MenuItem>

                    <MenuItem
                        onClick={handleSignOut}
                        sx={{
                            color: "error.main",
                            "& .MuiListItemIcon-root": {
                                color: "error.main",
                            },
                        }}
                    >
                        <ListItemIcon>
                            <LogoutOutlined fontSize="small" />
                        </ListItemIcon>

                        <ListItemText primary="Sign out" />
                    </MenuItem>
                </Box>
            </Menu>
        </>
    );
}

export default UserBar;