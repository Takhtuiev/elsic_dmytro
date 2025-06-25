import * as React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Box,
    IconButton,
    MenuItem,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    useTheme,
    alpha, Typography, Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { TOP_MENU } from '../../CONSTANTS/Constants';
import UserBar from './UserBar';
import ThemeSwitch from './ThemeSwitch/ThemeSwitch';
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

const urlBackGroundImage = '/background_menu7.webp';

export default function NavigationMenu() {
    const theme = useTheme();
    const location = useLocation();
    const [anchorElNav, setAnchorElNav] = useState(null);

    const currentPath = location.pathname;
    const matchedRoute = TOP_MENU.find((item) => currentPath.startsWith(item.href))?.href;
    const routePath = matchedRoute || (currentPath === '/' ? '/' : '');

    const isActive = (href) => routePath === href;

    const linkStyle = (active) => ({
        px: 2,
        py: 1,
        textDecoration: 'none',
        color: active ? theme.palette.primary.main : theme.palette.text.primary,
        fontWeight: 500,
        letterSpacing: '0.05rem',
        fontSize: '1rem',
        transition: 'color 0.3s ease',
        '&:hover': {
            color: theme.palette.primary.dark,
        },
    });

    const renderLinkItem = (name, href) => (
        <Box
            key={name}
            component={Link}
            to={href}
            sx={linkStyle(isActive(href))}
        >
            {name}
        </Box>
    );

    return (
        <Box
            component="nav"
            sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: { xs: 2, sm: 4 },
                py: 1,
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `url(${urlBackGroundImage})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center',
                    backgroundSize: '100% auto',
                    opacity: 0.15,
                    zIndex: 0,
                },
                zIndex: 10,
            }}
        >
            {/* Десктоп меню */}
            <Box
                sx={{
                    display: { xs: 'none', sm: 'flex' },
                    width: '100%',
                    gap: 2,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 1,
                }}
            >
                <Box>
                    {renderLinkItem('Home', '/')}
                </Box>

                {/* Ссылки меню */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {TOP_MENU.map(({ name, href }) => renderLinkItem(name, href))}
                </Box>

                {/* Темы и юзербар справа */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <ThemeSwitch />
                    <UserBar />
                </Box>
            </Box>

            {/* Мобильное меню */}
            <Box
                sx={{
                    display: { xs: 'flex', sm: 'none' },
                    zIndex: 1,
                    alignItems: 'center',
                    width: '100%',
                    justifyContent: 'space-between',
                    gap: 1
                }}
            >
                {/* Кнопка открытия Drawer */}
                <IconButton
                    size="large"
                    onClick={() => setAnchorElNav(true)}
                    sx={{ color: theme.palette.text.primary }}
                    aria-label="menu"
                >
                    <MenuIcon />
                </IconButton>

                {/* Переключатель темы и пользователь */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThemeSwitch />
                    <UserBar />
                </Box>

                {/* Drawer вместо Menu */}
                <Drawer
                    anchor="left"
                    open={Boolean(anchorElNav)}
                    onClose={() => setAnchorElNav(false)}
                    slotProps={{
                        paper: {
                            sx: {
                                width: 240,
                                backgroundColor: theme.palette.background.paper,
                                pt: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                            },
                        },
                    }}
                >
                    {/* Заголовок */}


                    {/* Список меню */}
                    <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                        <List disablePadding>
                            <ListItemButton
                                onClick={() => setAnchorElNav(false)}
                                sx={{ px: 1, py: 1, color: "primary.main" }}
                            >
                                <ChevronLeftIcon sx={{ mr: 1 }} />
                                <Typography variant="h6" color="primary">Меню</Typography>
                            </ListItemButton>
                            {[{ name: 'Home', href: '/' }, ...TOP_MENU].map(({ name, href }) => (
                                <ListItemButton
                                    key={href}
                                    component={Link}
                                    to={href}
                                    onClick={() => setAnchorElNav(false)}
                                    sx={{ px: 2, py: 1.2 }}
                                >
                                    <ListItemText primary={name} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>

                    {/* Нижняя кнопка */}
                    <Box sx={{ p: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            fullWidth
                            onClick={() => setAnchorElNav(false)}
                        >
                            Закрити
                        </Button>
                    </Box>
                </Drawer>
            </Box>


        </Box>
    );
}
