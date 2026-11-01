import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

import {generatePython, ident} from '../src/lib/py/generator.js';
import {BLOCKS} from '../src/lib/py/defs.js';
import makePyToolboxXML from '../src/lib/py/toolbox.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const gfxDir = path.join(here, '..', 'electron', 'python');

// Мини-реализация интерфейса блока Blockly
const block = (type, {fields = {}, inputs = {}, next = null} = {}) => ({
    type,
    getFieldValue: name => (name in fields ? fields[name] : null),
    getInputTargetBlock: name => inputs[name] || null,
    getNextBlock: () => next
});
const num = value => block('math_number', {fields: {NUM: String(value)}});
const str = value => block('text', {fields: {TEXT: value}});
const chain = (...blocks) => {
    for (let i = 0; i < blocks.length - 1; i++) {
        const original = blocks[i];
        const following = blocks[i + 1];
        blocks[i] = {...original, getNextBlock: () => following};
        blocks[i + 1] = following;
    }
    // пересобираем цепочку справа налево, чтобы ссылки были актуальны
    let tail = null;
    for (let i = blocks.length - 1; i >= 0; i--) {
        const current = blocks[i];
        const nextBlock = tail;
        tail = {...current, getNextBlock: () => nextBlock};
    }
    return tail;
};

const run = (code, files = {}) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pyide-test-'));
    writeFileSync(path.join(dir, 'main.py'), code);
    for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content);
    return spawnSync('python3', ['-u', 'main.py'], {
        cwd: dir,
        encoding: 'utf8',
        env: {...process.env, PYTHONPATH: gfxDir, PYTHONIOENCODING: 'utf-8'}
    });
};

test('ident делает допустимые имена Python', () => {
    assert.equal(ident('моя переменная'), 'моя_переменная');
    assert.equal(ident('1abc'), '_1abc');
    assert.equal(ident('class'), 'class_');
    assert.equal(ident(''), '_');
});

test('программа с циклом, функцией и условием запускается в настоящем Python', () => {
    const def = chain(
        block('py_def', {fields: {NAME: 'квадрат', PARAMS: 'n'}}),
        block('py_return', {inputs: {VALUE: block('py_math', {
            fields: {OP: '*'},
            inputs: {A: block('py_var', {fields: {NAME: 'n'}}), B: block('py_var', {fields: {NAME: 'n'}})}
        })}})
    );
    const main = chain(
        block('py_set', {fields: {NAME: 'сумма'}, inputs: {VALUE: num(0)}}),
        block('py_for_range', {
            fields: {VAR: 'i'},
            inputs: {
                FROM: num(1),
                TO: num(5),
                SUBSTACK: block('py_change', {
                    fields: {NAME: 'сумма'},
                    inputs: {VALUE: block('py_callr', {fields: {NAME: 'квадрат', ARGS: 'i'}})}
                })
            }
        }),
        block('py_ifelse', {
            inputs: {
                COND: block('py_compare', {
                    fields: {OP: '>'},
                    inputs: {A: block('py_var', {fields: {NAME: 'сумма'}}), B: num(20)}
                }),
                SUBSTACK: block('py_print', {inputs: {VALUE: str('много')}}),
                SUBSTACK2: block('py_print', {inputs: {VALUE: str('мало')}})
            }
        }),
        block('py_print', {inputs: {VALUE: block('py_var', {fields: {NAME: 'сумма'}})}})
    );
    const {code, usesGraphics} = generatePython([main, def]);
    assert.equal(usesGraphics, false);
    assert.match(code, /^def квадрат\(n\):\n\treturn \(n \* n\)/m);
    const result = run(code);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'много\n30\n');
});

test('пустые слоты не ломают синтаксис', () => {
    const {code} = generatePython([chain(
        block('py_if'),
        block('py_while'),
        block('py_for_each', {fields: {VAR: 'x'}}),
        block('py_print')
    )]);
    const result = run(code);
    assert.equal(result.status, 0, `${code}\n${result.stderr}`);
});

test('импорты поднимаются наверх, а блоки модулей дают рабочий код', () => {
    const {code} = generatePython([chain(
        block('py_import', {fields: {MODULE: 'string'}}),
        block('py_print', {inputs: {VALUE: block('py_mathfn', {fields: {FUNC: 'sqrt'}, inputs: {VALUE: num(16)}})}}),
        block('py_print', {inputs: {VALUE: block('py_random', {inputs: {A: num(3), B: num(3)}})}})
    )]);
    assert.match(code, /^import math\nimport random\nimport string\n/);
    const result = run(code);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '4.0\n3\n');
});

test('графика: код импортирует pyide_gfx и шлёт команды в stdout', () => {
    const {code, usesGraphics} = generatePython([chain(
        block('gfx_size', {inputs: {W: num(300), H: num(200)}}),
        block('gfx_circle', {inputs: {X: num(10), Y: num(20), R: num(5), COLOR: str('red')}}),
        block('py_print', {inputs: {VALUE: str('готово')}})
    )]);
    assert.equal(usesGraphics, true);
    assert.match(code, /^import pyide_gfx as gfx\n/);
    const result = run(code);
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines[2], 'готово');
    const circle = JSON.parse(lines[1].slice('\x1epyide-gfx:'.length));
    assert.deepEqual(circle, {k: 'circle', x: 10, y: 20, r: 5, color: 'red'});
});

test('в тулбоксе есть каждый блок из таблицы, включая общий список', () => {
    const colors = new Proxy({}, {get: () => ({primary: '#111111', tertiary: '#222222'})});
    const xml = makePyToolboxXML(colors);
    const allCategory = xml.slice(xml.indexOf('id="all"'));
    for (const {type} of BLOCKS) {
        assert.ok(allCategory.includes(`<block type="${type}">`), `нет блока ${type} в «Все блоки»`);
    }
});
