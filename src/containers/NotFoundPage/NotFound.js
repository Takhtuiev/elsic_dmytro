import {Alert, Typography} from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import {Box} from "@mui/system";

const NotFound = ({ message = "Ні чого не знайдено...", sx }) => {
    return (
        <Box display="flex" justifyContent="center">
            <Alert
                severity="warning"
                variant="outlined"
                icon={<WarningIcon sx={sx} />}
                sx={{
                    m: 1,
                    maxWidth: 'sm',
                    backgroundColor: theme => theme.palette.background.paper,
                    ...sx
                }}
            >
                <Typography>{message}</Typography>
            </Alert>
        </Box>    )
};

export default NotFound;
