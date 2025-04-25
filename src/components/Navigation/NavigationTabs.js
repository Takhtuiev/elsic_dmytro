import * as React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Typography, Menu, MenuItem, Tab, Tabs, Box, useTheme, alpha } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { TOP_MENU } from '../../CONSTANTS/Constants';
import UserBar from './UserBar';
import ThemeSwitch from './ThemeSwitch/ThemeSwitch';

function NavigationTabs() {
    const theme = useTheme(); // Получаем текущую тему

    const [anchorElNav, setAnchorElNav] = useState(null);
    const currentPath = useLocation().pathname;

    const routePath = TOP_MENU.find((item) =>
        currentPath.startsWith(item.href))?.href || (currentPath === '/' ? '/' : false);

    const handleOpenNavMenu = (event) => setAnchorElNav(event.currentTarget);
    const handleCloseNavMenu = () => setAnchorElNav(null);

    const homeTab = (
        <Tab
            label="Home"
            component={Link}
            value="/"
            to="/"
            sx={{
                color: theme.palette.text.primary,
                '&.Mui-selected': {
                    color: theme.palette.primary.main,
                },
                '&:hover': { color: theme.palette.primary.dark },
            }}
        />
    );

    return (
        <AppBar
            position="static"
            sx={{
                backgroundColor: theme => theme.palette.background.paper,
                color: theme.palette.text.primary,
            }}
        >
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', px: 3 }}>

                {/* Tabs для десктопа */}
                <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>{homeTab}</Box>
                <Tabs
                    value={routePath}
                    textColor="inherit"
                    sx={{
                        display: { xs: 'none', sm: 'flex' },
                        '.MuiTabs-indicator': { backgroundColor: theme.palette.primary.main },
                    }}
                >
                    {TOP_MENU.map((item) => (
                        <Tab
                            key={item.name}
                            label={item.name}
                            component={Link}
                            value={item.href}
                            to={item.href}
                            sx={{
                                textTransform: 'none',
                                fontSize: '1rem',
                                fontWeight: 500,
                                letterSpacing: '0.05rem',
                                color: theme.palette.text.primary,
                                '&.Mui-selected': {
                                    color: theme.palette.primary.main,
                                },
                                '&:hover': { color: theme.palette.primary.dark },
                            }}
                        />
                    ))}
                </Tabs>

                {/* Меню для мобильных */}
                <Box sx={{ display: { sm: 'none', xs: 'flex' } }}>
                    <IconButton size="large" sx={{ color: theme.palette.text.primary }} onClick={handleOpenNavMenu}>
                        <MenuIcon />
                    </IconButton>
                    <Menu
                        id="menu-appbar"
                        anchorEl={anchorElNav}
                        open={Boolean(anchorElNav)}
                        onClose={handleCloseNavMenu}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        keepMounted
                        sx={{
                            '& .MuiPaper-root': {
                                backgroundColor: theme.palette.background.paper,
                                borderRadius: 2,
                            },
                        }}
                    >
                        {TOP_MENU.map((item) => (
                            <MenuItem
                                key={item.name}
                                component={Link}
                                to={item.href}
                                onClick={handleCloseNavMenu}
                                sx={{
                                    color: theme.palette.text.primary,
                                    '&:hover': { backgroundColor: alpha(theme.palette.primary.light, 0.2) },
                                }}
                            >
                                <Typography>{item.name}</Typography>
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>
                <Box sx={{ display: { sm: 'none', xs: 'flex' } }}>{homeTab}</Box>

                {/* Блок переключателя темы и пользователя */}
                <Box sx={{ display: 'flex', maxWidth: '16rem', gap: 2, alignItems: 'center' }}>
                    <ThemeSwitch />
                    <UserBar />
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default NavigationTabs;
