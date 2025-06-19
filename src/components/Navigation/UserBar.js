import * as React from "react";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useUserLogoutMutation } from "../../services/Slice/authApi.js";
import { useDispatch, useSelector } from "react-redux";
import { Avatar, IconButton } from "@mui/material";
import { openDialog } from "../../services/Slice/dialogSlice";
import { clearJwtUserDetails } from "../../services/Slice/jwtUserSlice"; // action для очистки пользователя

function UserBar() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [anchorElUser, setAnchorElUser] = useState(null);

    const jwtUserDetails = useSelector(state => state.jwtUser.userDetails);

    const [logoutUser] = useUserLogoutMutation();

    const handleOpenUserMenu = (event) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const handleLogoutMenu = async () => {
        await logoutUser();
        dispatch(clearJwtUserDetails());
        handleCloseUserMenu();
    };

    const handleLogin = () => {
        dispatch(
            openDialog({
                title: "Login",
                maxWidth: "sm",
                componentKey: "LoginCard",
                props: {},
            })
        );
    };

    return (
        <>
            {jwtUserDetails?.sub ? (
                <>
                    <Tooltip title={jwtUserDetails.sub}>
                        <IconButton onClick={handleOpenUserMenu}>
                            <Avatar>
                                {jwtUserDetails.sub
                                    .split(" ")
                                    .slice(0, 2)
                                    .map((word) => word[0])
                                    .join("")}
                            </Avatar>
                        </IconButton>
                    </Tooltip>
                    <Menu
                        sx={{ mt: "45px" }}
                        id="menu-appbar"
                        anchorEl={anchorElUser}
                        anchorOrigin={{
                            vertical: "top",
                            horizontal: "right",
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: "top",
                            horizontal: "right",
                        }}
                        open={Boolean(anchorElUser)}
                        onClose={handleCloseUserMenu}
                    >
                        <MenuItem
                            onClick={() => {
                                navigate("/my_account");
                                handleCloseUserMenu();
                            }}
                            sx={{
                                "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.1)" },
                            }}
                        >
                            <Typography textAlign="center">Account</Typography>
                        </MenuItem>

                        <MenuItem
                            onClick={handleLogoutMenu}
                            sx={{
                                "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.1)" },
                            }}
                        >
                            <Typography textAlign="center">Logout</Typography>
                        </MenuItem>
                    </Menu>
                </>
            ) : (
                <Button
                    onClick={handleLogin}
                    sx={{
                        textTransform: "none",
                        fontSize: "0.9rem",
                    }}
                >
                    Login
                </Button>
            )}
        </>
    );
}

export default UserBar;
