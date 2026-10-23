
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculerJoursRestants,
  obtenirRappels
} = require('./logique-rappels');

const reference = new Date('2026-10-23T12:00:00');

test('Une échéance aujourd’hui correspond à zéro jour', () => {
  assert.equal(
    calculerJoursRestants('2026-10-23', reference),
    0
  );
});

test('Une échéance passée est en retard', () => {
  assert.equal(
    calculerJoursRestants('2026-10-22', reference),
    -1
  );
});

test('Une échéance dans trois jours est incluse', () => {
  assert.equal(
    calculerJoursRestants('2026-10-26', reference),
    3
  );
});

test('Les tâches terminées sont exclues des rappels', () => {
  const taches = [
    {
      title: 'Tâche terminée',
      dueDate: '2026-10-23',
      done: true
    },
    {
      title: 'Tâche à faire',
      dueDate: '2026-10-23',
      done: false
    }
  ];

  const rappels = obtenirRappels(taches, reference);

  assert.equal(rappels.length, 1);
  assert.equal(rappels[0].title, 'Tâche à faire');
});

test('Les tâches sans date limite sont exclues', () => {
  const rappels = obtenirRappels(
    [{ title: 'Sans date', done: false }],
    reference
  );

  assert.equal(rappels.length, 0);
});
