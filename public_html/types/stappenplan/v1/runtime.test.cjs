const test = require('node:test');
const assert = require('node:assert/strict');
const { tokens, emphasisRanges } = require('./code.js');
const { connect } = require('./sync.js');

function network() {
  const peers = new Set();
  const queue = [];
  let sent = 0;
  class Channel {
    constructor(name) { this.name = name; peers.add(this); }
    postMessage(data) {
      sent++;
      for (const peer of peers) {
        if (peer !== this && peer.name === this.name) queue.push(() => peer.onmessage?.({ data: structuredClone(data) }));
      }
    }
    close() { peers.delete(this); }
  }
  return { Channel, peers, get sent() { return sent; }, flush() {
    let limit = 100;
    while (queue.length) {
      assert.ok(limit-- > 0, 'geen eindeloze terugkoppeling');
      queue.shift()();
    }
  } };
}

test('JavaScript-kleuren behouden broncode, inspringing, exponenten en HTML letterlijk', () => {
  const source = 'const tekst = "<script>**</script>";\n// uitleg\nlet getal = 2 ** 3;\nif (true) console.log(`waarde ${getal}`);';
  const result = tokens(source, 'javascript');
  assert.equal(result.map(t => t.text).join(''), source);
  for (const type of ['keyword', 'comment', 'string', 'number', 'literal']) assert.ok(result.some(t => t.type === type));
  assert.deepEqual(tokens(source, 'js'), result);
  assert.deepEqual(tokens(source, 'python'), [{ text: source, type: '' }]);
});

test('nadruk markeert alle voorkomens en voegt overlappende fragmenten samen', () => {
  assert.deepEqual(emphasisRanges('voorraad = voorraad + 1', ['voorraad']), [[0, 8], [11, 19]]);
  assert.deepEqual(emphasisRanges('abcdef', ['abc', 'cde', 'bc']), [[0, 5]]);
  assert.deepEqual(emphasisRanges('aaaa', ['aa']), [[0, 4]]);
  assert.deepEqual(emphasisRanges('a\nb', ['a\nb', 'ontbreekt']), [[0, 3]]);
});

test('gekoppelde instanties volgen in beide richtingen zonder terugkoppellus', () => {
  const net = network();
  const a = [], b = [];
  const left = connect(net.Channel, 'les-1', 3, i => a.push(i), assert.fail);
  const right = connect(net.Channel, 'les-1', 3, i => b.push(i), assert.fail);
  net.flush();
  left.publish(1); net.flush();
  assert.deepEqual(b, [1]);
  right.publish(2); net.flush();
  assert.deepEqual(a, [2]);
  const sent = net.sent;
  right.publish(2); right.publish(-1); right.publish(3); net.flush();
  assert.equal(net.sent, sent);
  left.close(); right.close();
  assert.equal(net.peers.size, 0);
});

test('latere instantie neemt de huidige stap over; andere groepen blijven los', () => {
  const net = network(), received = [], unrelated = [];
  const left = connect(net.Channel, 'les-1', 3, () => {}, assert.fail);
  left.publish(2);
  connect(net.Channel, 'les-2', 3, i => unrelated.push(i), assert.fail);
  connect(net.Channel, 'les-1', 3, i => received.push(i), assert.fail);
  net.flush();
  assert.deepEqual(received, [2]);
  assert.deepEqual(unrelated, []);
});

test('verschillende aantallen stappen geven een melding en veranderen de stap niet', () => {
  const net = network(); let mismatch = 0;
  const left = connect(net.Channel, 'les', 3, assert.fail, () => mismatch++);
  connect(net.Channel, 'les', 2, assert.fail, () => mismatch++);
  net.flush(); left.publish(2); net.flush();
  assert.ok(mismatch > 0);
});

test('gelijktijdige navigatie convergeert en oude of ongeldige berichten worden genegeerd', () => {
  const net = network(); let a = 1, b = 2;
  const left = connect(net.Channel, 'les', 3, i => { a = i; }, assert.fail);
  const right = connect(net.Channel, 'les', 3, i => { b = i; }, assert.fail);
  net.flush();
  left.publish(a); right.publish(b); net.flush();
  assert.equal(a, b);
  const current = a;
  for (const peer of net.peers) {
    for (const data of [null, {type: 'state', count: 3, index: 0, revision: {sequence: 0, source: ''}},
      {type: 'state', count: 3, index: 99, revision: {sequence: 99, source: 'x'}},
      {type: 'state', count: 3, index: 0, revision: {sequence: '99', source: 'x'}}]) {
      peer.onmessage({ data });
    }
  }
  assert.equal(a, current); assert.equal(b, current);
});
