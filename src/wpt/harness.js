// Copyright (c) 2017-2022 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
// Copyright © web-platform-tests contributors. BSD license

import {
  strictEqual,
  notStrictEqual,
  deepStrictEqual,
  throws,
  ok,
} from 'node:assert';

globalThis.fetch = async (url) => {
  const { default: data } = await import(url);
  return {
    async json() {
      return data;
    },
  };
};

globalThis.GLOBAL = { isWindow: () => false };

globalThis.done = () => undefined;

globalThis.subsetTestByKey = (_key, testType, testCallback, testMessage) => {
  // This function is designed to allow selecting only certain tests when
  // running in a browser, by changing the query string. We'll always run
  // all the tests.

  return testType(testCallback, testMessage);
};

globalThis.promise_test = (callback, message) => {
  if (!shouldRunTest(message)) {
    return;
  }

  try {
    globalThis.promises.push(callback());
  } catch (err) {
    globalThis.errors.push(new AggregateError([err], message));
  }
};

globalThis.assert_equals = (a, b, message) => {
  strictEqual(a, b, message);
};

globalThis.assert_not_equals = (a, b, message) => {
  notStrictEqual(a, b, message);
};

globalThis.assert_true = (val, message) => {
  strictEqual(val, true, message);
};

globalThis.assert_false = (val, message) => {
  strictEqual(val, false, message);
};

globalThis.assert_array_equals = (a, b, message) => {
  deepStrictEqual(a, b, message);
};

globalThis.assert_object_equals = (a, b, message) => {
  deepStrictEqual(a, b, message);
};

globalThis.assert_implements = (a, message) => {
  ok(a, message);
};

globalThis.assert_throws_js = (type, fn, message) => {
  throws(fn, type, message);
};

globalThis.assert_throws_exactly = (expected, fn, message) => {
  try {
    fn();
  } catch (actual) {
    deepStrictEqual(actual, expected, message);
  }
};

globalThis.assert_throws_dom = (name, fn, message) => {
  throws(
    fn,
    (err) => {
      ok(err instanceof DOMException, message);
      deepStrictEqual(err.name, name, message);
      return true;
    },
    message
  );
};

globalThis.test = (callback, message) => {
  if (!shouldRunTest(message)) {
    return;
  }

  try {
    callback();
  } catch (err) {
    globalThis.errors.push(new AggregateError([err], message));
  }
};

globalThis.errors = [];

function shouldRunTest(message) {
  if ((globalThis.testOptions.skippedTests ?? []).includes(message)) {
    console.warn('skipped', message);
    return false;
  }

  if (globalThis.testOptions.verbose) {
    console.log('run', message);
  }

  return true;
}

function prepare(options) {
  globalThis.errors = [];
  globalThis.promises = [];
  globalThis.testOptions = options;
}

function sanitizeMessage(message) {
  // Test logs will be exported to XML, so we must escape any characters that
  // are forbidden in an XML CDATA section, namely "[...] the surrogate blocks,
  // FFFE, and FFFF".
  // See https://www.w3.org/TR/REC-xml/#NT-Char
  return message.replace(
    /[\u{D800}-\u{DFFF}\u{FFFE}\u{FFFF}]/gu,
    (char) => '\\u' + char.charCodeAt().toString(16).padStart(4, '0')
  );
}

async function validate(options) {
  await Promise.all(globalThis.promises);

  const expectedFailures = options.expectedFailures ?? [];
  let failed = false;

  for (const err of globalThis.errors) {
    const sanitizedError = new AggregateError(
      err.errors,
      sanitizeMessage(err.message)
    );
    if (expectedFailures.includes(err.message)) {
      console.warn('Expected failure: ', sanitizedError);
    } else {
      console.error(sanitizedError);
      failed = true;
    }
  }

  if (failed) {
    throw new Error('Test failed');
  }
}

export function run(file, options = {}) {
  return {
    async test() {
      prepare(options);
      await import(file);
      await validate(options);
    },
  };
}
