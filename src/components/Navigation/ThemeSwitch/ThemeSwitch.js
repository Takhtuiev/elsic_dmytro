import {IconButton, useTheme} from "@mui/material";
import {useColorMode} from "../../../Providers/ColorModeProvider";
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Tooltip from "@mui/material/Tooltip";


function ThemeSwitch() {
    const theme = useTheme();
    const colorMode = useColorMode();

    return (
        <Tooltip title={theme.palette.mode === 'light' ? 'dark' : 'light'}>
            <IconButton
                onClick={colorMode.toggleColorMode}
            >
                {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
        </Tooltip>
    );
}

export default ThemeSwitch;