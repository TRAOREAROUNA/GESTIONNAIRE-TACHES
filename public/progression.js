
function calculerProgression(total, terminees) {
    if (!Number.isInteger(total) || total < 0) {
        throw new RangeError("Le total doit être un entier positif ou nul.");
    }

    if (
        !Number.isInteger(terminees) ||
        terminees < 0 ||
        terminees > total
    ) {
        throw new RangeError(
            "Le nombre de tâches terminées doit être compris entre 0 et le total."
        );
    }

    if (total === 0) {
        return 0;
    }

    return Math.round((terminees / total) * 100);
}

// Permet l'utilisation dans Node.js pour les tests
if (typeof module !== "undefined" && module.exports) {
    module.exports = { calculerProgression };
}
