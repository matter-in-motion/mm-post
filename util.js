'use strict';
module.exports = {
  toCamelCase: str => str
    .replace(/[-_](\w)/g, (matches, letter) => letter.toUpperCase()),

  getMethods: (obj, rx) => {
    const m = new Set();

    do {
      Object.getOwnPropertyNames(obj).forEach(method => {
        const match = method.match(rx);
        if (match) {
          m.add(match[1] || method);
        }
      });
    } while (obj = Object.getPrototypeOf(obj));
    return m;
  }
};
