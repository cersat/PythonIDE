/**
 * Единая таблица всех Python-блоков. Из неё строятся и сами блоки (blocks.js),
 * и тулбокс со списком всех блоков (toolbox.js). Генерация кода — в generator.js.
 */

// Аргументы блоков
const T = def => ({shadow: 'text', field: 'TEXT', def});
const N = def => ({shadow: 'math_number', field: 'NUM', def: String(def)});
const V = (name, shadow = null) => ({k: 'value', name, shadow});
const B = name => ({k: 'bool', name});
const F = (name, def) => ({k: 'field', name, def});
const D = (name, options, def = options[0][1]) => ({k: 'dropdown', name, options, def});
const S = (name = 'SUBSTACK') => ({k: 'stack', name});

const pairs = list => list.map(x => [x, x]);

export const CATEGORIES = [
    {id: 'basic', name: 'Вывод и ввод', color: 'looks', extension: 'colours_looks'},
    {id: 'vars', name: 'Переменные', color: 'data', extension: 'colours_data'},
    {id: 'control', name: 'Управление', color: 'control', extension: 'colours_control'},
    {id: 'ops', name: 'Операторы', color: 'operators', extension: 'colours_operators'},
    {id: 'lists', name: 'Списки и словари', color: 'data_lists', extension: 'colours_data_lists'},
    {id: 'funcs', name: 'Функции', color: 'more', extension: 'colours_more'},
    {id: 'misc', name: 'Модули и время', color: 'sensing', extension: 'colours_sensing'},
    {id: 'gfx', name: 'Графика', color: 'pen', extension: 'colours_pen'},
    {id: 'raw', name: 'Свой код', color: 'event', extension: 'colours_event'}
];

// shape: statement | end (нет блока ниже) | hat | reporter | boolean
// parts: строки сообщения; каждая со своим списком аргументов (как message0/args0 в Blockly)
const def = (type, cat, shape, ...parts) => ({
    type,
    cat,
    shape,
    parts: parts.map(([message, ...args]) => ({message, args}))
});

export const BLOCKS = [
    // --- Вывод и ввод ---
    def('py_print', 'basic', 'statement', ['вывести %1', V('VALUE', T('Привет, мир!'))]),
    def('py_input', 'basic', 'reporter', ['спросить %1', V('PROMPT', T('Как тебя зовут? '))]),
    def('py_comment', 'basic', 'statement', ['# %1', F('TEXT', 'комментарий')]),

    // --- Переменные ---
    def('py_set', 'vars', 'statement', ['задать %1 = %2', F('NAME', 'x'), V('VALUE', N(0))]),
    def('py_change', 'vars', 'statement', ['изменить %1 на %2', F('NAME', 'x'), V('VALUE', N(1))]),
    def('py_var', 'vars', 'reporter', ['%1', F('NAME', 'x')]),

    // --- Управление ---
    def('py_if', 'control', 'statement', ['если %1', B('COND')], ['%1', S()]),
    def('py_ifelse', 'control', 'statement',
        ['если %1', B('COND')], ['%1', S()], ['иначе'], ['%1', S('SUBSTACK2')]),
    def('py_while', 'control', 'statement', ['пока %1', B('COND')], ['%1', S()]),
    def('py_for_range', 'control', 'statement',
        ['для %1 от %2 до %3 (не включая)', F('VAR', 'i'), V('FROM', N(0)), V('TO', N(10))], ['%1', S()]),
    def('py_for_each', 'control', 'statement',
        ['для каждого %1 в %2', F('VAR', 'item'), V('ITER')], ['%1', S()]),
    def('py_try', 'control', 'statement',
        ['попробовать'], ['%1', S()], ['если ошибка'], ['%1', S('SUBSTACK2')]),
    def('py_break', 'control', 'end', ['прервать цикл']),
    def('py_continue', 'control', 'end', ['следующий круг цикла']),
    def('py_return', 'control', 'end', ['вернуть %1', V('VALUE', N(0))]),
    def('py_pass', 'control', 'statement', ['ничего не делать (pass)']),

    // --- Операторы ---
    def('py_math', 'ops', 'reporter', ['%1 %2 %3', V('A', N(0)),
        D('OP', [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['// целое', '//'], ['% остаток', '%'],
            ['** степень', '**']]), V('B', N(0))]),
    def('py_compare', 'ops', 'boolean', ['%1 %2 %3', V('A', N(0)),
        D('OP', pairs(['==', '!=', '<', '>', '<=', '>='])), V('B', N(0))]),
    def('py_and', 'ops', 'boolean', ['%1 и %2', B('A'), B('B')]),
    def('py_or', 'ops', 'boolean', ['%1 или %2', B('A'), B('B')]),
    def('py_not', 'ops', 'boolean', ['не %1', B('A')]),
    def('py_bool', 'ops', 'boolean', ['%1', D('VAL', [['True', 'True'], ['False', 'False']])]),
    def('py_none', 'ops', 'reporter', ['None']),
    def('py_in', 'ops', 'boolean', ['%1 в %2', V('A', T('а')), V('B', T('мама'))]),
    def('py_join', 'ops', 'reporter', ['склеить %1 и %2', V('A', T('привет ')), V('B', T('мир'))]),
    def('py_func1', 'ops', 'reporter', ['%1 ( %2 )', D('FUNC', pairs(['str', 'int', 'float', 'bool', 'len', 'abs',
        'round', 'sorted', 'sum', 'min', 'max', 'list'])), V('VALUE', N(0))]),
    def('py_mathfn', 'ops', 'reporter', ['math.%1 ( %2 )', D('FUNC', pairs(['sqrt', 'sin', 'cos', 'tan', 'floor',
        'ceil', 'log'])), V('VALUE', N(9))]),
    def('py_random', 'ops', 'reporter', ['случайное от %1 до %2', V('A', N(1)), V('B', N(10))]),
    def('py_range', 'ops', 'reporter', ['диапазон от %1 до %2', V('A', N(0)), V('B', N(10))]),
    def('py_strmethod', 'ops', 'reporter', ['%1 . %2 ()', V('OBJ', T('Текст')),
        D('METHOD', pairs(['upper', 'lower', 'strip', 'title', 'split', 'isdigit']))]),

    // --- Списки и словари ---
    def('py_list', 'lists', 'reporter', ['список [ %1 ]', F('ITEMS', '1, 2, 3')]),
    def('py_dict', 'lists', 'reporter', ['словарь { %1 }', F('ITEMS', '"a": 1, "b": 2')]),
    def('py_getitem', 'lists', 'reporter', ['элемент %1 [ %2 ]', V('OBJ'), V('KEY', N(0))]),
    def('py_setitem', 'lists', 'statement', ['в %1 [ %2 ] записать %3', V('OBJ'), V('KEY', N(0)), V('VALUE', N(0))]),
    def('py_append', 'lists', 'statement', ['добавить %1 в список %2', V('VALUE', N(0)), V('LIST')]),

    // --- Функции ---
    def('py_def', 'funcs', 'hat', ['функция %1 ( %2 )', F('NAME', 'моя_функция'), F('PARAMS', 'a, b')]),
    def('py_call', 'funcs', 'statement', ['вызвать %1 ( %2 )', F('NAME', 'моя_функция'), F('ARGS', '1, 2')]),
    def('py_callr', 'funcs', 'reporter', ['результат %1 ( %2 )', F('NAME', 'моя_функция'), F('ARGS', '1, 2')]),

    // --- Модули и время ---
    def('py_import', 'misc', 'statement', ['import %1', F('MODULE', 'random')]),
    def('py_sleep', 'misc', 'statement', ['ждать %1 сек', V('SECS', N(1))]),

    // --- Графика (модуль pyide_gfx, рисует в превью) ---
    def('gfx_size', 'gfx', 'statement', ['окно %1 × %2', V('W', N(400)), V('H', N(300))]),
    def('gfx_clear', 'gfx', 'statement', ['залить фон цветом %1', V('COLOR', T('white'))]),
    def('gfx_circle', 'gfx', 'statement', ['круг x %1 y %2 радиус %3 цвет %4',
        V('X', N(200)), V('Y', N(150)), V('R', N(50)), V('COLOR', T('red'))]),
    def('gfx_rect', 'gfx', 'statement', ['прямоугольник x %1 y %2 ширина %3 высота %4 цвет %5',
        V('X', N(20)), V('Y', N(20)), V('W', N(100)), V('H', N(60)), V('COLOR', T('blue'))]),
    def('gfx_line', 'gfx', 'statement', ['линия от x %1 y %2 до x %3 y %4 цвет %5 толщина %6',
        V('X1', N(0)), V('Y1', N(0)), V('X2', N(400)), V('Y2', N(300)), V('COLOR', T('black')), V('WIDTH', N(2))]),
    def('gfx_text', 'gfx', 'statement', ['текст %1 в x %2 y %3 цвет %4 размер %5',
        V('TEXT', T('Привет')), V('X', N(20)), V('Y', N(40)), V('COLOR', T('black')), V('SIZE', N(24))]),
    def('gfx_wait', 'gfx', 'statement', ['пауза кадра %1 сек', V('SECS', N(0.05))]),

    // --- Свой код ---
    def('py_exec', 'raw', 'statement', ['код: %1', F('CODE', 'print("hi")')]),
    def('py_expr', 'raw', 'reporter', ['выражение: %1', F('CODE', '1 + 1')])
];

export const BLOCKS_BY_TYPE = Object.fromEntries(BLOCKS.map(b => [b.type, b]));
