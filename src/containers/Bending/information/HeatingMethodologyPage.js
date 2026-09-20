import React from "react";
import {
    Box,
    Container,
    Paper,
    Stack,
    Typography,
    Divider,
    List,
    ListItem,
    Chip,
    Grid
} from "@mui/material";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";


const bodySx = {
    color: "text.secondary",
    lineHeight: 1.75
};


function Formula({ children }: { children: string }) {
    return (
        <Paper
            variant="outlined"
            sx={{
                my: 2.5,
                px: { xs: 1, sm: 3 },
                py: { xs: 2, sm: 2.5 },
                overflowX: "auto",
                borderRadius: 2,
                bgcolor: "grey.50",
                borderColor: "grey.200",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
                "& .katex": {
                    fontSize: { xs: "1.05rem", sm: "1.25rem" }
                }
            }}
        >
            <BlockMath math={children} />
        </Paper>
    );
}


function FlowBox({ children }: { children: React.ReactNode }) {
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                textAlign: "center",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                bgcolor: "background.paper"
            }}
        >
            <Typography
                variant="body2"
                fontWeight={600}
            >
                {children}
            </Typography>
        </Paper>
    );
}


function StyledListItem({ children }: { children: React.ReactNode }) {
    return (
        <ListItem
            sx={{
                display: "list-item",
                py: 0.5,
                pl: 1
            }}
        >
            <Typography
                variant="body1"
                sx={bodySx}
            >
                {children}
            </Typography>
        </ListItem>
    );
}


const sections = [
    {
        number: "1",
        title: "Научная и теоретическая основа",
        content: (
            <>
                <Typography sx={bodySx}>
                    Методика расчёта основана на сочетании экспериментального
                    и численного подходов к определению времени нагрева
                    листовых термопластов, описанных в работе Buffel,
                    Van Mieghem, Van Bael и Desplentere (2017)
                    «A Combined Experimental and Modelling Approach towards
                    an Optimized Heating Strategy in Thermoforming of
                    Thermoplastics Sheets».
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Подход адаптирован для ТЭНовой системы с закрытой
                    нагревательной зоной, сформированной конструкцией
                    нагревательного короба, и учитывает не только нагрев
                    заготовки, но и её охлаждение после извлечения
                    из нагревательной зоны.
                </Typography>
            </>
        )
    },
    {
        number: "2",
        title: "Постановка задачи",
        content: (
            <>
                <Typography sx={bodySx}>
                    Расчёт определяет температурное поле листовой заготовки
                    во времени при нагреве с двух сторон.
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        геометрию и тепловую эффективность нагревательной зоны;
                    </StyledListItem>

                    <StyledListItem>
                        температуру и характеристики нагревателей;
                    </StyledListItem>

                    <StyledListItem>
                        толщину и теплофизические свойства материала;
                    </StyledListItem>

                    <StyledListItem>
                        радиационный теплообмен между нагревателями,
                        поверхностями нагревательной зоны и заготовкой;
                    </StyledListItem>

                    <StyledListItem>
                        конвективный теплообмен;
                    </StyledListItem>

                    <StyledListItem>
                        изменение теплофизических свойств материала
                        с температурой;
                    </StyledListItem>

                    <StyledListItem>
                        охлаждение заготовки после извлечения
                        из нагревательной зоны;
                    </StyledListItem>

                    <StyledListItem>
                        время переноса заготовки к гибочному узлу;
                    </StyledListItem>

                    <StyledListItem>
                        диапазон температур формования и температуру
                        начала термического разложения материала.
                    </StyledListItem>
                </List>
            </>
        )
    },
    {
        number: "3",
        title: "Физическая модель PVC",
        content: (
            <>
                <Typography sx={bodySx}>
                    Для непрозрачных листовых термопластов, в частности PVC,
                    предполагается, что тепловое излучение поглощается
                    преимущественно в поверхностном слое материала.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    После передачи энергии поверхности тепло распространяется
                    вглубь листа преимущественно за счёт теплопроводности.
                    Поэтому основным объектом расчёта является распределение
                    температуры по толщине листа.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Модель рассматривает симметричный одномерный перенос
                    тепла через толщину, при этом воздействие нагрева
                    учитывается на обеих поверхностях.
                </Typography>
            </>
        )
    },
    {
        number: "4",
        title: "Математическая модель",
        content: (
            <>
                <Typography sx={bodySx}>
                    Нестационарное распределение температуры описывается
                    уравнением теплопроводности с теплофизическими
                    свойствами, зависящими от температуры:
                </Typography>

                <Formula>
                    {String.raw`
                        \rho(T)\,C_p(T)\,
                        \frac{\partial T}{\partial t}
                        =
                        \frac{\partial}{\partial x}
                        \left[
                            \lambda(T)\,
                            \frac{\partial T}{\partial x}
                        \right]
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    где:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        <b>ρ(T)</b> — плотность материала;
                    </StyledListItem>

                    <StyledListItem>
                        <b>Cₚ(T)</b> — удельная теплоёмкость;
                    </StyledListItem>

                    <StyledListItem>
                        <b>λ(T)</b> — коэффициент теплопроводности;
                    </StyledListItem>

                    <StyledListItem>
                        <b>T</b> — температура;
                    </StyledListItem>

                    <StyledListItem>
                        <b>x</b> — координата по толщине;
                    </StyledListItem>

                    <StyledListItem>
                        <b>t</b> — время.
                    </StyledListItem>
                </List>
            </>
        )
    },
    {
        number: "5",
        title: "Численный метод решения",
        content: (
            <>
                <Typography sx={bodySx}>
                    Для расчёта температурного поля используется неявная
                    конечно-разностная схема.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Толщина листа разбивается на пространственную сетку
                    примерно из 20–22 расчётных ячеек. Пространственный
                    шаг автоматически выбирается в зависимости от толщины
                    листа.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Шаг по времени составляет 0,2 секунды. Неявная схема
                    обеспечивает высокую численную устойчивость расчёта
                    при малом пространственном шаге.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Температурно-зависимые свойства материала учитываются
                    итерационно на каждом временном шаге. Полученная
                    трёхдиагональная система линейных уравнений решается
                    методом прогонки Томаса.
                </Typography>
            </>
        )
    },
    {
        number: "6",
        title: "Тепловой баланс поверхности",
        content: (
            <>
                <Typography sx={bodySx}>
                    Передача тепла к поверхности заготовки учитывается
                    через радиационный и конвективный теплообмен:
                </Typography>

                <Formula>
                    {String.raw`
                        q_{\mathrm{total}}
                        =
                        q_{\mathrm{rad}}
                        +
                        q_{\mathrm{conv}}
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    Радиационный поток определяется с учётом эффективной
                    излучательной способности системы и геометрического
                    фактора:
                </Typography>

                <Formula>
                    {String.raw`
                        q_{\mathrm{rad}}
                        =
                        \varepsilon_{\mathrm{eff}}\,
                        F\,
                        \sigma
                        \left(
                            T_h^4-T_s^4
                        \right)
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    где:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        <b>εeff</b> — эффективная излучательная способность;
                    </StyledListItem>

                    <StyledListItem>
                        <b>F</b> — геометрический фактор излучения;
                    </StyledListItem>

                    <StyledListItem>
                        <b>σ</b> — постоянная Стефана–Больцмана;
                    </StyledListItem>

                    <StyledListItem>
                        <b>Tₕ</b> — абсолютная температура нагревательной системы;
                    </StyledListItem>

                    <StyledListItem>
                        <b>Tₛ</b> — абсолютная температура поверхности листа.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    В радиационном обмене учитываются как непосредственное
                    излучение нагревателей, так и тепловое излучение
                    окружающих поверхностей нагревательной зоны.
                </Typography>
            </>
        )
    },
    {
        number: "7",
        title: "Температурно-зависимые свойства материала",
        content: (
            <>
                <Typography sx={bodySx}>
                    Теплофизические свойства PVC могут изменяться
                    с температурой. Поэтому в расчёте используются
                    функции свойств материала, а не только постоянные
                    значения.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Особое значение имеет изменение удельной теплоёмкости
                    в области стеклования. Это позволяет учитывать
                    изменение количества энергии, необходимой для
                    дальнейшего повышения температуры материала.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Температура стеклования используется как характеристика
                    перехода материала из жёсткого состояния к области
                    повышенной подвижности полимерных цепей.
                </Typography>
            </>
        )
    },
    {
        number: "8",
        title: "Нагрев, перенос и охлаждение",
        content: (
            <>
                <Typography sx={bodySx}>
                    Полный расчёт процесса разделён на последовательные
                    физические этапы:
                </Typography>

                <Grid
                    container
                    spacing={1.5}
                    sx={{ mt: 1 }}
                >
                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Нагревательная зона
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Извлечение заготовки
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Перенос и охлаждение
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Старт гибки
                        </FlowBox>
                    </Grid>
                </Grid>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    После достижения требуемого состояния нагрева заготовка
                    извлекается из нагревательной зоны. На этапе переноса
                    прекращается воздействие нагревателей и начинается
                    охлаждение поверхности и последующее выравнивание
                    температуры по толщине.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Поэтому фактическое время достижения требуемой температуры
                    для начала гибки определяется не только временем нахождения
                    заготовки в нагревательной зоне, но и временем переноса.
                </Typography>
            </>
        )
    },
    {
        number: "9",
        title: "Критерий окончания нагрева",
        content: (
            <>
                <Typography sx={bodySx}>
                    Нагревательная стадия считается завершённой, когда
                    минимальная температура по толщине заготовки достигает
                    заданной целевой температуры:
                </Typography>

                <Formula>
                    {String.raw`
                        \min_{x}
                        T(x,t_{\mathrm{heat}})
                        \ge
                        T_{\mathrm{target}}
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    Такой критерий обеспечивает необходимый прогрев
                    наиболее холодной области листа и предотвращает ситуацию,
                    когда поверхность уже достигла требуемой температуры,
                    а центральная часть ещё остаётся недостаточно прогретой.
                </Typography>
            </>
        )
    },
    {
        number: "10",
        title: "Результаты расчёта",
        content: (
            <>
                <Typography sx={bodySx}>
                    Результатом расчёта является временная история
                    температуры в различных точках по толщине листа.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Графики позволяют оценивать:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        температуру поверхности;
                    </StyledListItem>

                    <StyledListItem>
                        температуру центрального слоя;
                    </StyledListItem>

                    <StyledListItem>
                        распределение температуры по толщине;
                    </StyledListItem>

                    <StyledListItem>
                        время достижения целевой температуры;
                    </StyledListItem>

                    <StyledListItem>
                        равномерность прогрева заготовки;
                    </StyledListItem>

                    <StyledListItem>
                        изменение температуры во время переноса
                        к гибочному узлу.
                    </StyledListItem>
                </List>
            </>
        )
    },
    {
        number: "11",
        title: "Контроль температуры разложения",
        content: (
            <>
                <Typography sx={bodySx}>
                    Для предотвращения перегрева в расчёте контролируется
                    температура начала термического разложения материала.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Если температура любой расчётной точки достигает
                    заданной температуры разложения, расчёт нагрева
                    прекращается и возвращается соответствующий статус
                    о превышении допустимого температурного уровня.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Температура разложения является ограничением безопасности
                    и не используется как целевая температура формования.
                </Typography>
            </>
        )
    },
    {
        number: "12",
        title: "Экспериментальная проверка",
        content: (
            <>
                <Typography sx={bodySx}>
                    Численная модель может дополнительно проверяться
                    экспериментальными измерениями температуры поверхности
                    и/или температуры внутри листа.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Такая проверка позволяет оценить соответствие расчётной
                    модели реальной нагревательной системе и при необходимости
                    уточнить параметры теплообмена.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Экспериментальная калибровка рассматривается как отдельный
                    этап верификации модели и не является обязательной частью
                    базового расчёта.
                </Typography>
            </>
        )
    }
];


export default function HeatingMethodologyPage() {
    return (
        <Container
            maxWidth="lg"
            sx={{
                py: {
                    xs: 3,
                    md: 6
                }
            }}
        >
            <Stack spacing={4}>
                <Box>
                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                    >
                        <Chip
                            label="METHOD"
                            size="small"
                            color="primary"
                        />

                        <Typography
                            variant="overline"
                            color="text.secondary"
                        >
                            Thermal bending
                        </Typography>
                    </Stack>

                    <Typography
                        variant="h3"
                        component="h1"
                        sx={{
                            mt: 1.5,
                            fontWeight: 700,
                            fontSize: {
                                xs: "2rem",
                                md: "2.75rem"
                            }
                        }}
                    >
                        Методика расчёта нагрева
                    </Typography>

                    <Typography
                        variant="h6"
                        color="text.secondary"
                        sx={{
                            mt: 1.5,
                            maxWidth: 900,
                            lineHeight: 1.5,
                            fontWeight: 400
                        }}
                    >
                        Адаптация экспериментально-численного подхода
                        Buffel et al. (2017) к ТЭНовым системам закрытого
                        типа с учётом динамики охлаждения при переносе
                        заготовки из нагревательной зоны к гибочному узлу.
                    </Typography>
                </Box>

                <Divider />

                <Stack spacing={3}>
                    {sections.map((section) => (
                        <Paper
                            key={section.number}
                            variant="outlined"
                            sx={{
                                p: {
                                    xs: 2,
                                    sm: 3,
                                    md: 4
                                },
                                borderRadius: 3
                            }}
                        >
                            <Stack spacing={2}>
                                <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                >
                                    <Chip
                                        label={section.number}
                                        color="primary"
                                        size="small"
                                    />

                                    <Typography
                                        variant="h5"
                                        component="h2"
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: {
                                                xs: "1.25rem",
                                                sm: "1.5rem"
                                            }
                                        }}
                                    >
                                        {section.title}
                                    </Typography>
                                </Stack>

                                {section.content}
                            </Stack>
                        </Paper>
                    ))}
                </Stack>

                <Paper
                    sx={{
                        p: {
                            xs: 2.5,
                            sm: 4
                        },
                        borderRadius: 3,
                        bgcolor: "primary.main",
                        color: "primary.contrastText"
                    }}
                >
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 700,
                            mb: 1.5
                        }}
                    >
                        Итог
                    </Typography>

                    <Typography
                        sx={{
                            lineHeight: 1.75
                        }}
                    >
                        Методика позволяет рассчитывать время нагрева
                        термопластовой заготовки с учётом её толщины,
                        теплофизических свойств материала, параметров
                        нагревательной зоны, температурного режима,
                        радиационного и конвективного теплообмена,
                        а также последующего охлаждения во время переноса
                        к гибочному узлу.
                    </Typography>
                </Paper>
            </Stack>
        </Container>
    );
}