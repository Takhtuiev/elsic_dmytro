import React from "react";
import { Button, ButtonGroup, Tooltip } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

/**
 * Компонент рендерит группу кнопок действий, доступных в зависимости от ролей пользователя.
 *
 * @param {Object[]} masActions - Массив объектов-действий.
 * @param {"horizontal"|"vertical"} orientation - Ориентация кнопок (по умолчанию — горизонтальная).
 */
function ActionGroupButton({ masActions, orientation = "horizontal" }) {
    const dispatch = useDispatch();

    // Получаем данные пользователя из Redux
    const jwtUserDetails = useSelector(state => state.jwtUser.userDetails);

    // Оставляем только действия, которые разрешены пользователю по ролям
    const availableActions = masActions.filter(action =>
        jwtUserDetails?.roles?.includes(action.role)
    );

    // Обработчик клика по кнопке действия
    const handleActionClick = (obj) => (event) => {

    };

    // Если нет доступных действий — не рендерим ничего
    if (availableActions.length === 0) {
        return null;
    }

    return (
        <ButtonGroup
            size="small"
            variant="outlined"
            aria-label="action button group"
            orientation={orientation}
            sx={{ margin: "3px 0" }}
        >
            {availableActions.map((obj, index) => (
                <Tooltip
                    key={index}
                    title={obj.title}
                    placement={orientation === "vertical" ? "right" : "bottom"}
                >
                    <Button onClick={handleActionClick(obj)}>
                        {obj.content}
                    </Button>
                </Tooltip>
            ))}
        </ButtonGroup>
    );
}

export default ActionGroupButton;
