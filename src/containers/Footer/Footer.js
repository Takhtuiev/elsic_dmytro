import React from 'react';
import {
    Typography,
    Link,
    Divider,
    IconButton,
    ListItem,
} from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TelegramIcon from '@mui/icons-material/Telegram';
import { Box } from '@mui/system';

const socialMediaLinks = {
    facebook: '#',
    twitter: '#',
    instagram: '#',
};

function Footer() {
    return (
        <Box component="footer"
             sx={{
                 whiteSpace: 'nowrap',
                 backgroundColor: theme => theme.palette.background.paper,
                 p: 2,
             }}
        >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ maxWidth: { xs: '100%', sm: '50%', md: '25%' } }}>
                    <Typography variant="subtitle1" color="text.primary">
                        О КОМПАНИИ
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'normal' }}>
                        Наша компания специализируется на производстве и продаже качественной продукции для вашего удобства.
                    </Typography>
                </Box>
                <Box sx={{ maxWidth: { xs: '100%', sm: '50%', md: '25%' } }}>
                    <Typography variant="subtitle1" color="text.primary" gutterBottom>
                        COMPANY
                    </Typography>
                    <Link href="#" variant="body2" color="text.secondary" display="block">About Us</Link>
                    <Link href="#" variant="body2" color="text.secondary" display="block">Careers</Link>
                    <Link href="#" variant="body2" color="text.secondary" display="block">Privacy Policy</Link>
                    <Link href="#" variant="body2" color="text.secondary" display="block">Terms of Service</Link>
                </Box>
                <Box sx={{ maxWidth: { xs: '100%', sm: '50%', md: '25%' } }}>
                    <Typography variant="subtitle1" color="text.primary" gutterBottom>
                        PRODUCTS
                    </Typography>
                    <Link href="#" variant="body2" color="text.secondary" display="block">Product 1</Link>
                    <Link href="#" variant="body2" color="text.secondary" display="block">Product 2</Link>
                    <Link href="#" variant="body2" color="text.secondary" display="block">Product 3</Link>
                    <Link href="#" variant="body2" color="text.secondary" display="block">Product 4</Link>
                </Box>
                <Box sx={{ maxWidth: { xs: '100%', sm: '50%', md: '25%' } }}>
                    <Typography variant="subtitle1" color="text.primary" gutterBottom>
                        КОНТАКТЫ
                    </Typography>
                    <Box sx={{ color: 'text.secondary' }}>
                        <ListItem disablePadding>
                            <PhoneIcon fontSize="small" />
                            <Typography sx={{ pl: 1 }}> +38 (067) 971-4510 </Typography>
                        </ListItem>
                        <ListItem disablePadding>
                            <EmailIcon fontSize="small" />
                            <Typography sx={{ pl: 1 }}> info@example.com </Typography>
                        </ListItem>
                        <ListItem disablePadding>
                            <LocationOnIcon fontSize="small" />
                            <Typography sx={{ pl: 1 }}> г. Киев, пр-т. Правды, 123456 </Typography>
                        </ListItem>
                    </Box>
                </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    © {new Date().getFullYear()} introplast. Все права защищены.
                </Typography>
                <Box>
                    <IconButton aria-label="Telegram" component="a" href={socialMediaLinks.instagram}>
                        <TelegramIcon />
                    </IconButton>
                    <IconButton aria-label="Facebook" component="a" href={socialMediaLinks.facebook}>
                        <FacebookIcon />
                    </IconButton>
                    <IconButton aria-label="Instagram" component="a" href={socialMediaLinks.instagram}>
                        <InstagramIcon />
                    </IconButton>
                </Box>
                <Typography variant="caption" color="text.secondary">
                    Разработка сайта: <Link color="inherit" href="https://example.com" target="_blank" rel="noopener noreferrer">Дмитрий Тахтуев</Link>
                </Typography>
            </Box>
        </Box>
    );
}

export default Footer;
