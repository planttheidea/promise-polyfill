const { defineProperty } = Object;

const globalRegistry = [];
const symbolMap = {};

const getRegistryName = (key) => `[[${key}]]`;

const DESCRIPTION = getRegistryName('Description');
const KEY = getRegistryName('key');
const SYMBOL_DATA = getRegistryName('SymbolData');
const SYMBOL = getRegistryName('symbol');

const isSameValue = (a, b) => {
  const type = typeof a;

  if (type !== typeof b) {
    return false;
  }

  if (type === 'undefined') {
    return true;
  }

  if (type === 'number') {
    return (a !== a && b !== b) || (a === 0 && b === 0) || a === b;
  }

  return a === b;
};

const setFrozen = (object, property, value) =>
  defineProperty(object, property, {
    configurable: false,
    enumerable: false,
    value,
    writable: false,
  });

const setNonEnumerable = (object, property, value) =>
  defineProperty(object, property, {
    configurable: true,
    enumerable: false,
    value,
    writable: true,
  });

const typeOf = (object) => {
  const type = typeof object;

  return object && type === 'object' && object instanceof _Symbol
    ? 'symbol'
    : type;
};

const unique = (bits) =>
  new Array(bits + 1)
    .join('x')
    .replace(/x/g, () => (Math.random() < 0.5 ? '\u200C' : '\u200D'));

class Symbol {
  constructor(description) {
    const desc =
      typeof description === 'undefined' ? undefined : String(description);

    setFrozen(this, SYMBOL_DATA, unique(128));
    setFrozen(this, DESCRIPTION, desc);
    setFrozen(this, 'constructor', _Symbol);

    symbolMap[this.toString()] = this;

    return this;
  }

  toJSON() {
    return;
  }

  toString() {
    return `Symbol(${this[DESCRIPTION] || ''}${this[SYMBOL_DATA]})`;
  }
}

function _Symbol(description) {
  if (this && this instanceof _Symbol) {
    throw TypeError('Symbol cannot be a constructor');
  }

  return new Symbol(description);
}

setNonEnumerable(_Symbol, 'hasInstance', _Symbol('Symbol.hasInstance'));
setNonEnumerable(
  _Symbol,
  'isConcatSpreadable',
  _Symbol('Symbol.isConcatSpreadable'),
);
setNonEnumerable(_Symbol, 'iterator', _Symbol('Symbol.iterator'));
setNonEnumerable(_Symbol, 'length', 0);
setNonEnumerable(_Symbol, 'match', _Symbol('Symbol.match'));
setNonEnumerable(_Symbol, 'replace', _Symbol('Symbol.replace'));
setNonEnumerable(_Symbol, 'search', _Symbol('Symbol.search'));
setNonEnumerable(_Symbol, 'species', _Symbol('Symbol.species'));
setNonEnumerable(_Symbol, 'split', _Symbol('Symbol.split'));
setNonEnumerable(_Symbol, 'toPrimitive', _Symbol('Symbol.toPrimitive'));
setNonEnumerable(_Symbol, 'toStringTag', _Symbol('Symbol.toStringTag'));
setNonEnumerable(_Symbol, 'unscopables', _Symbol('Symbol.unscopables'));

setNonEnumerable(_Symbol, 'for', function (key) {
  const string = String(key);
  const registryName = getRegistryName(key);

  for (let index = 0, entry; index < globalRegistry.length; index++) {
    entry = globalRegistry[index];

    if (isSameValue(entry[registryName], string)) {
      return entry[SYMBOL];
    }
  }

  const symbol = _Symbol(key);

  globalRegistry.push({
    [KEY]: key,
    [registryName]: string,
    [SYMBOL]: symbol,
  });

  return symbol;
});

setNonEnumerable(_Symbol, 'keyFor', function (sym) {
  if (!(sym instanceof Symbol)) {
    throw new TypeError('Symbol.keyFor accepts symbol arguments.');
  }

  for (let index = 0, entry; index < globalRegistry.length; index++) {
    entry = globalRegistry[index];

    if (isSameValue(entry[SYMBOL], sym)) {
      return entry[KEY];
    }
  }
});

setNonEnumerable(_Symbol.prototype, 'valueOf', function () {
  if (typeOf(this) === 'symbol') {
    return this;
  }

  if (typeOf(this) !== 'object' || SYMBOL_DATA in this) {
    throw TypeError();
  }

  return this[SYMBOL_DATA];
});

const { getOwnPropertyNames: _getOwnPropertyNames, keys: _keys } = Object;

export function getOwnPropertyNames(object) {
  return _getOwnPropertyNames(object).filter((property) => !symbolMap[property]);
}

export function getOwnPropertySymbols(object) {
  return _getOwnPropertyNames(object).reduce((symbols, property) => {
    if (symbolMap[property]) {
      symbols.push(symbolMap[property]);
    }

    return symbols;
  },                                         []);
}

export function keys(object) {
  return _keys(object).filter((key) => !symbolMap[key]);
}

export default _Symbol;
