import React, {useRef, useState} from "react";
import { Collapse, Typography, useTheme } from "@mui/material";
import { Box } from "@mui/system";

const ExpandableText = ({ text, lines = 2 }) => {
    const [expanded, setExpanded] = useState(false);
    const [countLine, setCountLine] = useState(lines);
    const theme = useTheme();
    const HEIGHT = `calc(${theme.typography.body2.lineHeight} * ${lines}em)`;

    const textRef = useRef(null);

    const isExpanded = countLine === null;

    // Определение стилей в зависимости от состояния
    const collapseStyles = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: isExpanded ? 100 : "auto",
        minHeight: HEIGHT,
        overflow: 'hidden',
        backgroundColor: isExpanded ? theme.palette.background.paper : "transparent",
        borderRadius: '4px',
        border: `1px solid`,
        borderColor: isExpanded ? theme.palette.text.primary  : 'transparent',
        //boxShadow: isExpanded ? theme.shadows[5] : "none",
        color: isExpanded ? theme.palette.text.primary : theme.palette.text.secondary,
        "&:hover": {
            color: theme.palette.text.primary,
            //boxShadow: theme.shadows[5],
            borderColor: theme.palette.text.primary,
        },
    };

    // Обработчик клика для раскрытия/сворачивания текста
    const handleClick = (e) => {
        e.stopPropagation();
        const el = textRef.current;
        if ( !expanded && el && el.scrollHeight <= el.clientHeight ) {
            return; // не раскрывать, если текст полностью помещается
        }
        setExpanded((prev) => !prev);
    };

    return (
        <Box
            onClick={handleClick}
            sx={{
                position: 'relative',
                width: '100%',
                cursor: 'pointer',
            }}
        >

            <Box minHeight={HEIGHT}>
            </Box>
            {/* Выпадающий текст */}
            <Collapse
                in={expanded}
                onEnter={() => setCountLine(null)}
                onExited={() => setCountLine(lines)}
                onMouseLeave={() => setExpanded(false)}
                timeout={{ enter: 400, exit: 200 }}
                orientation="vertical"
                collapsedSize={HEIGHT}
               // unmountOnExit
                sx={collapseStyles}
            >
                <Typography
                    ref={textRef} //  прикрепляем ref
                    variant="body2"
                    sx={{
                        px: 1,
                        py: 0.5,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        WebkitLineClamp: isExpanded ? 'none' : countLine,
                    }}
                >
                    {text}
                </Typography>
            </Collapse>
        </Box>
    );
};

export default ExpandableText;
