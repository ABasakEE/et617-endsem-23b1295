import assert from 'node:assert/strict';
import { TAGS, PACKAGE, PREREQ } from '../src/bank.js';

const words = (s) => s.trim().split(/\s+/).length;
assert.deepEqual(Object.keys(TAGS).sort(), ['M1a', 'M1b', 'M2a', 'M2b', 'M3a', 'M3b']);
for (const [k, t] of Object.entries(TAGS)) {
  assert.equal(t.law, Number(k[1]), k);
  for (const f of ['label', 'wrong', 'right']) assert.ok(t[f], `${k}.${f}`);
}

const ids = new Set();
const checkTags = (arr, where) => arr.forEach((t) => assert.ok(TAGS[t], `${where}: unknown tag ${t}`));
const rubricOk = (r, where) => {
  assert.ok(r.keyPoints.length >= 2 && r.keyPoints.length <= 3, where + ' keyPoints');
  assert.ok(r.keywords.length > 0, where + ' keywords');
  checkTags(Object.keys(r.cues), where);
  for (const [t, kws] of Object.entries(r.cues)) {
    assert.ok(kws.length > 0, where);
    kws.forEach((w) => assert.equal(w, w.toLowerCase(), `${where} cue ${t} not lowercase`));
  }
  r.keywords.forEach((w) => assert.equal(w, w.toLowerCase(), where + ' keyword case'));
};

assert.deepEqual(Object.keys(PACKAGE), ['1', '2', '3']);
for (const law of [1, 2, 3]) {
  const items = PACKAGE[law];
  assert.equal(items.length, 5, `law ${law} count`);
  assert.equal(items.filter((i) => i.kind === 'standard').length, 3);
  assert.equal(items.filter((i) => i.kind === 'tricky').length, 2);
  assert.deepEqual(items.filter((i) => i.kind === 'standard').map((i) => i.format).sort(), ['choice', 'explain', 'numeric']);
  const tricky = items.filter((i) => i.kind === 'tricky');
  tricky.forEach((i) => assert.equal(i.format, 'choice+reason'));
  assert.deepEqual(tricky.map((i) => i.tags[0]).sort(), [`M${law}a`, `M${law}b`]);

  for (const it of items) {
    const w = it.id;
    assert.ok(!ids.has(w), 'dup id ' + w); ids.add(w);
    assert.equal(it.law, law);
    assert.ok(words(it.prompt) <= 45, `${w} prompt ${words(it.prompt)} words`);
    assert.ok(Array.isArray(it.tags)); checkTags(it.tags, w);
    assert.equal(it.hints.length, 2, w + ' hints');
    it.hints.forEach((h) => assert.ok(h && h.length > 0));
    assert.ok(!/obviously|simply/i.test(JSON.stringify(it)), w + ' banned word');
    if (it.format === 'numeric') {
      assert.ok(Number.isFinite(it.answer), w + ' answer');
      assert.ok(Number.isFinite(it.tolerance) && it.tolerance >= 0);
      assert.ok(typeof it.unit === 'string' && it.unit);
    } else if (it.format === 'explain') {
      rubricOk(it.rubric, w);
    } else if (it.format === 'choice' || it.format === 'choice+reason') {
      assert.equal(it.options.length, 4);
      assert.deepEqual(it.options.map((o) => o.id), ['a', 'b', 'c', 'd']);
      assert.equal(it.options.filter((o) => o.id === it.answer).length, 1, w + ' answer id');
      for (const o of it.options) {
        assert.ok(o.text); assert.ok('tag' in o);
        if (o.tag !== null) { assert.ok(TAGS[o.tag], w + ' option tag'); assert.notEqual(o.id, it.answer); }
      }
      if (it.format === 'choice+reason') {
        assert.ok(it.reasonPrompt); rubricOk(it.rubric, w);
        assert.ok(it.options.some((o) => o.tag === it.tags[0]), w + ' has option for its tag');
      }
    } else assert.fail(w + ' bad format ' + it.format);
  }
}

assert.equal(PREREQ.length, 4);
for (const p of PREREQ) {
  assert.ok(p.id && p.title && p.text);
  assert.ok(words(p.text) <= 80, `${p.id} ${words(p.text)} words`);
  assert.ok(p.tags.length > 0); checkTags(p.tags, p.id);
}
console.log('bank OK:', ids.size, 'items');
