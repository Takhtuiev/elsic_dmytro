import {Box} from "@mui/system";

function MyImageBox({ url, name, onClick, sx}) {

    return (
        <Box
            component="img"
            sx={{
                height: '100%',
                width: '100%',
                objectFit: 'contain',
                cursor: onClick ? 'pointer' : '',
                transition: 'transform 0.3s ease-in-out', // Плавное увеличение
                '&:hover': {
                    transform: 'scale(1.1)', // Увеличение на 20% при наведении
                },
                ...sx,
            }}
            src={url}
            onClick={onClick}
            alt={name}
            loading="lazy"
            decoding="async"
        />
    );
}

export default MyImageBox;
