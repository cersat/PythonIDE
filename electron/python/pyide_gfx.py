"""Графика для превью PythonIDE.

Команды рисования уходят в stdout строками с особым префиксом.
Превью в приложении ловит их и рисует на холсте, всё остальное — обычный терминал.
"""
import json
import sys
import time

_PREFIX = "\x1epyide-gfx:"


def _emit(kind, **params):
	params["k"] = kind
	sys.stdout.write(_PREFIX + json.dumps(params, ensure_ascii=False) + "\n")
	sys.stdout.flush()


def size(width, height):
	_emit("size", w=width, h=height)


def clear(color="white"):
	_emit("clear", color=str(color))


def circle(x, y, radius, color="black"):
	_emit("circle", x=x, y=y, r=radius, color=str(color))


def rect(x, y, width, height, color="black"):
	_emit("rect", x=x, y=y, w=width, h=height, color=str(color))


def line(x1, y1, x2, y2, color="black", width=1):
	_emit("line", x1=x1, y1=y1, x2=x2, y2=y2, color=str(color), width=width)


def text(value, x, y, color="black", size=16):
	_emit("text", text=str(value), x=x, y=y, color=str(color), size=size)


def wait(seconds=0.05):
	time.sleep(seconds)
