import assert from 'node:assert/strict';
import {test} from 'node:test';

import {MARKER, OutputParser} from '../src/lib/py/session.js';

const collect = (chunks) => {
    const parser = new OutputParser();
    return chunks.flatMap(chunk => parser.push(chunk));
};

const joinText = events => events.filter(e => e.type === 'text').map(e => e.text).join('');

test('обычный текст и промпты без перевода строки выводятся сразу', () => {
    const events = collect(['Как тебя зовут? ']);
    assert.equal(joinText(events), 'Как тебя зовут? ');
});

test('команда рисования разбирается, даже если пришла кусками', () => {
    const line = `${MARKER}${JSON.stringify({k: 'circle', x: 1, y: 2, r: 3, color: 'red'})}\n`;
    const events = collect([line.slice(0, 1), line.slice(1, 10), line.slice(10)]);
    assert.deepEqual(events, [{type: 'gfx', command: {k: 'circle', x: 1, y: 2, r: 3, color: 'red'}}]);
});

test('текст до и после команды сохраняется, \\r\\n превращается в \\n', () => {
    const gfx = `${MARKER}${JSON.stringify({k: 'clear', color: 'white'})}\r\n`;
    const events = collect([`привет\r\n${gfx}пока\r\n`]);
    assert.equal(joinText(events), 'привет\nпока\n');
    assert.equal(events.filter(e => e.type === 'gfx').length, 1);
});

test('начало строки, похожее на префикс, но не являющееся им, не теряется', () => {
    const events = collect(['\u001e', 'x\n']);
    assert.equal(joinText(events), '\u001ex\n');
});

test('сломанная команда показывается как текст', () => {
    const events = collect([`${MARKER}{oops\n`]);
    assert.equal(joinText(events), `${MARKER}{oops\n`);
});
