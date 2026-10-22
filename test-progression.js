
const test = require("node:test");
const assert = require("node:assert/strict");

function calculerProgression(total, terminees) {
    if (total === 0) {
        return 0;
    }

    return Math.round((terminees / total) * 100);
}

test("0 tâche : progression de 0 %", function () {
    assert.equal(calculerProgression(0, 0), 0);
});

test("4 tâches terminées sur 10 : progression de 40 %", function () {
    assert.equal(calculerProgression(10, 4), 40);
});

test("Toutes les tâches terminées : progression de 100 %", function () {
    assert.equal(calculerProgression(5, 5), 100);
});
