
export const ID_EL_START = 'my-element-'

export const UPLOAD_IMAGE = {maxWidth: 1920, maxHeight: 1080}
export const WATERMARK = 'shandruk.com.ua';
export const FONT_WATERMARK = 'Roboto';

export const DRINKS_COLUMNS = {
    id: {text: 'ID', pattern: /^[1-9]\d*$/},
    category: {text: 'Категорія', pattern: /^\d{0,10}$/},
    name: {text: 'Назва', pattern: /^.{0,50}$/},
    description: {text: 'Опис', pattern: /^.{0,1000}$/},
    specifications: {text: 'Специфікація', pattern: /^.{0,100}$/},
    productType: {text: 'Тип', pattern: /^\d{0,10}$/},
    brand: {text: 'Виробник', pattern: /^\d{0,10}$/},
    country: {text: 'Країна виробництва', pattern: /^\d{0,10}$/},
    rating: {text: 'Рейтинг', pattern: /^(?:[0-5](?:\.\d{1})?)?$/},
    alcohol: {text: 'Вміст алкоголю', pattern: /^(\d{0,5})(\.(\d{1,2})?)?$/},
    expirationDays: {text: 'Термін придатності', pattern: /^.{0,12}$/},
    dateAdded: {text: 'Дата додавання до бази', pattern: /^\d{0,10}$/},
    packagingType: {text: 'Тара', pattern: /^\d{0,10}$/},
    volume: {text: 'Об\'єм', pattern: /^.{0,8}$/},
    price: {text: 'Ціна', pattern: /^(\d{0,10})(\.(\d{1,2})?)?$/},
    stockQuantity: {text: 'Кількість', pattern: /^\d{0,10}$/},
    promotionsAndDiscounts: {text: 'Акції', pattern: /^.{0,100}$/},
};

export const USER_COLUMNS = {
    di: {text: 'ID', pattern: /^[1-9]\d*$/},
    username: {text: 'Name', pattern: /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\-_.@\d]{0,50}$/},
    password: {text: 'Password', pattern: /^.{0,128}$/},
    email: {text: 'Email', pattern: /^.{0,128}$/},
    phone: {text: 'Phone', pattern: /^.{0,20}$/},
    authorities: {text: 'Authorities', pattern: 'array'},
    enabled: {text: 'Enable', pattern: /^.{0,20}$/}
};

export const TOP_MENU = [
    {name:'Variants', href:'/drinks/pagevar'},
    {name:'Drinks', href:'/drinks/page'},
    {name:'UserList', href:'/admin/userlist'},
    {name:'TestErrorPath', href:'/TestErrorPath'},
];



