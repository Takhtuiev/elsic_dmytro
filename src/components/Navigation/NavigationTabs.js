import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Box,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    useTheme,
    Typography,
    Button,
    Drawer,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

import { TOP_MENU } from '../../CONSTANTS/Constants';
import UserBar from './UserBar';
import ThemeSwitch from './ThemeSwitch/ThemeSwitch';

export default function NavigationMenu() {
    const theme = useTheme();
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const currentPath = location.pathname;

    // Определяем "активный" путь по URL
    const routePath = useMemo(() => {
        return TOP_MENU.find((item) => currentPath.startsWith(item.href))?.href ||
            (currentPath === '/' ? '/' : '');
    }, [currentPath]);

    // Проверка: активен ли элемент меню
    const isActive = useCallback(
        (href: string) => routePath === href,
        [routePath]
    );

    // Стиль для ссылок, зависящий от активности и темы
    const getLinkStyle = useCallback(
        (active: boolean) => ({
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
        }),
        [theme]
    );

    // Рендер одного пункта навигации
    const renderNavLink = useCallback(
        (name: string, href: string) => (
            <Box
                key={href}
                component={Link}
                to={href}
                sx={getLinkStyle(isActive(href))}
            >
                {name}
            </Box>
        ),
        [getLinkStyle, isActive]
    );

    // Мемоизируем "Home" ссылку, потому что не зависит от стейта
    const homeLinkElement = useMemo(() => (
        <Box
            component={Link}
            to="/"
            sx={{
                px: 2,
                py: 1,
                textDecoration: 'none',
                color: theme.palette.text.primary,
                fontWeight: 500,
                fontSize: { xs: '1.1rem', sm: '1rem' },
                textAlign: { xs: 'center', sm: 'left' },
                flexGrow: { xs: 1, sm: 0 },
                letterSpacing: '0.05rem',
                transition: 'color 0.3s ease',
                userSelect: 'none',
                '&:hover': {
                    color: theme.palette.primary.dark,
                },
            }}
        >
            Home
        </Box>
    ), [theme]);

    // Мемоизируем рендер пунктов меню (зависит от routePath, т.к. влияет на isActive)
    const menuItems = useMemo(() =>
            TOP_MENU.map(({ name, href }) => renderNavLink(name, href)),
        [renderNavLink]
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
                zIndex: 10,
            }}
        >
            {/* --- Desktop menu --- */}
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
                {homeLinkElement}

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', rowGap: 0 }}>
                    {menuItems}
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <ThemeSwitch />
                    <UserBar />
                </Box>
            </Box>

            {/* --- Mobile menu --- */}
            <Box
                sx={{
                    display: { xs: 'flex', sm: 'none' },
                    alignItems: 'center',
                    width: '100%',
                    justifyContent: 'space-between',
                    zIndex: 1,
                    gap: 1,
                }}
            >
                {/* Кнопка меню */}
                <IconButton
                    size="large"
                    onClick={() => setDrawerOpen(true)}
                    sx={{ color: theme.palette.text.primary }}
                    aria-label="menu"
                >
                    <MenuIcon />
                </IconButton>

                {homeLinkElement}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThemeSwitch />
                    <UserBar />
                </Box>

                {/* Drawer меню */}
                <Drawer
                    anchor="left"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
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
                    {/* Заголовок с кнопкой назад */}
                    <ListItemButton
                        onClick={() => setDrawerOpen(false)}
                        sx={{ px: 1, py: 1, color: "primary.main" }}
                    >
                        <ChevronLeftIcon sx={{ mr: 1 }} />
                        <Typography variant="h6" color="primary">Меню</Typography>
                    </ListItemButton>

                    {/* Список пунктов */}
                    <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                        <List disablePadding>
                            {TOP_MENU.map(({ name, href }) => (
                                <ListItemButton
                                    key={href}
                                    component={Link}
                                    to={href}
                                    onClick={() => setDrawerOpen(false)}
                                    sx={{ px: 2, py: 1.2 }}
                                >
                                    <ListItemText primary={name} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>

                    {/* Кнопка закрытия */}
                    <Box sx={{ p: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            fullWidth
                            onClick={() => setDrawerOpen(false)}
                        >
                            Закрити
                        </Button>
                    </Box>
                </Drawer>
            </Box>
        </Box>
    );
}
