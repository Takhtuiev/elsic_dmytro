import { Button, ButtonGroup } from "@mui/material";
import React from "react";
import Tooltip from "@mui/material/Tooltip";
import { useJwtUserDetails } from "../../Providers/JwtProvider";

function ActionGroupButton({ masActions, setAction, orientation }) {
    const { jwtUserDetails } = useJwtUserDetails(); // Получаем детали JWT-пользователя из контекста

    // Фильтруем доступные действия на основе ролей пользователя
    const availableActions = masActions.filter((action) => jwtUserDetails?.roles.includes(action.role));

    // Если ни одно действие не доступно, ничего не рендерим
    if (availableActions.length === 0) {
        return null;
    }

    return (
        <ButtonGroup
            size="small"
            variant="outlined"
            aria-label="small button group"
            orientation={orientation}
            sx={{ margin: "3px 0" }}
        >
            {availableActions.map(({ title, setNewAction, content }, index) => (
                <Tooltip
                    title={title}
                    key={index}
                    placement= {orientation === 'vertical' ? 'right' : 'bottom'}
                >
                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            setAction(setNewAction)
                        }}
                    >
                        {content}
                    </Button>
                </Tooltip>
            ))}
        </ButtonGroup>
    );
}

export default ActionGroupButton;
