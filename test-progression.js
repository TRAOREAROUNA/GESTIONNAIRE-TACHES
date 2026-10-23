
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculerProgression } = require("./progression");

test("0 tâche : progression de 0 %", function () {
    assert.equal(calculerProgression(0, 0), 0);
});

test("4 tâches terminées sur 10 : progression de 40 %", function () {
    assert.equal(calculerProgression(10, 4), 40);
});

test("Toutes les tâches terminées : progression de 100 %", function () {
    assert.equal(calculerProgression(5, 5), 100);
});

test("3 tâches terminées sur 7 : progression de 43 %", function () {
    assert.equal(calculerProgression(7, 3), 43);
});

test("Aucune tâche terminée : progression de 0 %", function () {
    assert.equal(calculerProgression(5, 0), 0);
});

test("Refuse plus de tâches terminées que le total", function () {
    assert.throws(
        () => calculerProgression(10, 12),
        RangeError
    );
});

test("Refuse un nombre négatif de tâches terminées", function () {
    assert.throws(
        () => calculerProgression(5, -1),
        RangeError
    );
});
