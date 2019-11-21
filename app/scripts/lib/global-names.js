
/**
 * The names of all intrinsic JavaScript objects
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
 */

module.exports = [

  /* Fundamental objects */
  // 'Object',
  // 'Function',
  'Boolean',
  // 'Symbol', // does not work
  // 'Error',
  // 'AggregateError', // does not exist
  'EvalError',
  // 'InternalError', // does not exist
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  // 'TypeError',
  'URIError',

  /* Numbers and dates */
  'Number',
  'BigInt',
  'Math',
  'Date',

  /* Text processing */
  'String',
  'RegExp',

  /* Indexed collections */
  'Array',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',

  /* Keyed collections */
  // 'Map', // does not work
  // 'Set', // does not work
  'WeakMap',
  'WeakSet',

  /* Structured data */
  // 'ArrayBuffer', // does not work
  // 'SharedArrayBuffer', // does not work
  'Atomics',
  // 'DataView', // does not work
  'JSON',

  /* Control abstraction objects */
  'Promise',
  'Generator',
  'GeneratorFunction', // Babel's regeneratorRuntime modifies
  'AsyncFunction',

  /* Reflection */
  'Reflect',
  'Proxy'
]
