
function calculerJoursRestants(dueDate, dateReference = new Date()) {
  const dateLimite = new Date(`${dueDate}T00:00:00`);
  const reference = new Date(dateReference);

  reference.setHours(0, 0, 0, 0);

  if (Number.isNaN(dateLimite.getTime())) {
    return null;
  }

  dateLimite.setHours(0, 0, 0, 0);

  return Math.round(
    (dateLimite - reference) / (1000 * 60 * 60 * 24)
  );
}

function obtenirRappels(taches, dateReference = new Date()) {
  return taches
    .filter((tache) => tache.dueDate && !tache.done)
    .map((tache) => ({
      ...tache,
      joursRestants: calculerJoursRestants(
        tache.dueDate,
        dateReference
      )
    }))
    .filter(
      (tache) =>
        tache.joursRestants !== null &&
        tache.joursRestants <= 3
    );
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculerJoursRestants,
    obtenirRappels
  };
}
