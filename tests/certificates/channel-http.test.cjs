const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../../public_html/shared/certificate-channel.js'), 'utf8');

for (const secure of [false, true]) {
  const window = { addEventListener() {}, removeEventListener() {} };
  const context = { window, crypto: {
    getRandomValues: array => webcrypto.getRandomValues(array),
    ...(secure ? { randomUUID: () => 'native-uuid' } : {}),
  } };
  vm.runInNewContext(source, context);
  const first = window.LearningToolsCertificate.peer(() => {});
  const second = window.LearningToolsCertificate.peer(() => {});
  if (secure) assert.equal(first.id, 'native-uuid');
  else {
    assert.match(first.id, /^[a-f0-9]{32}$/);
    assert.notEqual(first.id, second.id);
  }
  first.close(); second.close();
}
console.log('PASS: certificate peers initialize with and without crypto.randomUUID');
