import * as React from "react";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {useNavigate} from "react-router-dom";
import {lazy, Suspense, useState} from "react";
import {useUserLogoutMutation} from "../../services/api/authApi.js";
import {useJwtUserDetails} from "../../Providers/JwtProvider";
import {styled} from "@mui/material/styles";
import LoadingSpinner from "../MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import {Avatar, IconButton} from "@mui/material";

const LoginRegistrationModal = lazy(() => import('../ModalWindow/LoginRegistration/DialogLoginRegistration'));

function UserBar() {

    const [logoutUser, { isLoading: logoutResp, error, reset }] = useUserLogoutMutation();
    const { jwtUserDetails, setJwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя
    const [anchorElUser, setAnchorElUser] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const navigate = useNavigate();

    const handleOpenUserMenu = (event) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const handleLogoutMenu = async () => {
        await logoutUser();
        setJwtUserDetails(null);
        handleCloseUserMenu();
    };


    return (
        <>
            {jwtUserDetails?.sub
                ?
                <>
                    <Tooltip title={jwtUserDetails.sub}>
                        <IconButton
                            onClick={handleOpenUserMenu}
                        >
                            <Avatar >
                                {jwtUserDetails?.sub.split(' ').slice(0, 2).map(word => word[0]).join('')}
                            </Avatar>
                        </IconButton>
                    </Tooltip>
                    <Menu
                        sx={{mt: '45px'}}
                        id="menu-appbar"
                        anchorEl={anchorElUser}
                        anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        open={Boolean(anchorElUser)}
                        onClose={handleCloseUserMenu}
                    >
                        <MenuItem
                            onClick={() => {
                                navigate('/my_account');
                                handleCloseUserMenu();
                            }}
                            sx = {{
                                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' }
                            }}
                        >
                            <Typography textAlign="center">Account</Typography>
                        </MenuItem>

                        <MenuItem
                            onClick={handleLogoutMenu}
                            sx = {{
                                '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.1)' }
                            }}
                        >
                            <Typography textAlign="center">Logout</Typography>
                        </MenuItem>

                    </Menu>
                </>
                :
                <Button  // "LOGIN"
                        onClick={() => {
                            setShowLogin(true)
                        }}
                        sx={{
                            textTransform: 'none',
                            fontSize: '0.9rem',
                        }}
                >
                    Login
                </Button>
            }

            {showLogin &&
                <Suspense fallback={<LoadingSpinner/>} >
                    <LoginRegistrationModal
                        show={showLogin}
                        setShow={setShowLogin}
                    />
                </Suspense>
            }
        </>

    )

}

export default UserBar;
