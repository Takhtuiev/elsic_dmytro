import {useJwtUserDetails} from "../../Providers/JwtProvider";

const WithRoleContent = ({ allowedRoles, children }) => {
    const { jwtUserDetails } = useJwtUserDetails(); // Получаем детали JWT-пользователя из контекста

    // Проверяем, есть ли у пользователя хотя бы одна из разрешенных ролей, и если есть, то выводим children
    if (jwtUserDetails?.roles.some(role => allowedRoles.includes(role))) {
        return children;
    } else {
        return null; // Если роль не совпадает, то ничего не возвращаем
    }
};

export default WithRoleContent;