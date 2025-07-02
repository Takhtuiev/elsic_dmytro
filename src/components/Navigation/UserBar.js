import React, { useState, useCallback, useMemo } from "react";
import {
    Avatar,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useUserLogoutMutation } from "../../services/Slice/authApi";
import { clearJwtUserDetails } from "../../services/Slice/jwtUserSlice";
import { openDialog } from "../../services/Slice/dialogSlice";

function UserBar() {

    const dispatch = useDispatch();
    const navigate = useNavigate();

    // State для хранения anchor элемента для меню пользователя
    const [anchorEl, setAnchorEl] = useState(null);

    // Получаем имя пользователя из Redux state (jwtUser)
    const { sub: username } = useSelector((state) => state.jwtUser.userDetails) || {};

    // RTK Query мутация для logout пользователя
    const [logoutUser] = useUserLogoutMutation();

    // Открыть меню, сохраняя элемент, к которому привязывается меню (для позиционирования)
    const handleOpenMenu = useCallback((event) => {
        setAnchorEl(event.currentTarget);
    }, []);

    // Закрыть меню, сбросив anchor элемент
    const handleCloseMenu = useCallback(() => {
        setAnchorEl(null);
    }, []);

    // Функция выхода из системы
    const handleLogout = useCallback(async () => {
        try {
            // Вызываем logout мутацию, unwrap для обработки ошибок
            await logoutUser().unwrap();
        } catch (e) {
            // Логируем ошибку (можно добавить уведомления)
            console.error("Logout failed", e);
        } finally {
            // Очищаем данные пользователя из Redux и закрываем меню
            dispatch(clearJwtUserDetails());
            handleCloseMenu();
        }
    }, [dispatch, logoutUser, handleCloseMenu]);

    // Переход на страницу аккаунта и закрытие меню
    const handleNavigateAccount = useCallback(() => {
        navigate("/my_account");
        handleCloseMenu();
    }, [navigate, handleCloseMenu]);

    // Открыть диалоговое окно входа (логина)
    const handleLogin = useCallback(() => {
        dispatch(openDialog({
            title: "Login",
            maxWidth: "xs",
            componentKey: "LoginCard",
            props: {},
        }));
    }, [dispatch]);

    // Получаем инициалы из имени пользователя для аватара
    const initials = useMemo(() => {
        return username
            ? username
                .split(" ")
                .slice(0, 2)
                .map((word) => word.charAt(0).toUpperCase())
                .join("")
            : "";
    }, [username]);

    // Если пользователь не авторизован — показываем кнопку Login
    if (!username) {
        return (
            <Button
                onClick={handleLogin}
                sx={{ textTransform: "none", fontSize: "0.9rem" }}
            >
                Login
            </Button>
        );
    }

    // Если пользователь авторизован — показываем аватар с меню
    return (
        <>
            {/* Кнопка с аватаром и подсказкой (Tooltip) с именем пользователя */}
            <Tooltip title={username}>
                <IconButton onClick={handleOpenMenu} size={'small'}>
                    <Avatar sx={{ width: 36, height: 36 }}>{initials}</Avatar>
                </IconButton>
            </Tooltip>

            {/* Меню пользователя с пунктами "Account" и "Logout" */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                sx={{ mt: "45px" }}
            >
                {/* Переход в личный кабинет */}
                <MenuItem onClick={handleNavigateAccount}>
                    <Typography textAlign="center">Account</Typography>
                </MenuItem>
                {/* Выход из системы */}
                <MenuItem onClick={handleLogout}>
                    <Typography textAlign="center">Logout</Typography>
                </MenuItem>
            </Menu>
        </>
    );
}

export default UserBar;
