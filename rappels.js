
function afficherRappels() {
    const remindersList = document.getElementById("reminders-list");

    if (!remindersList) {
        return;
    }

    remindersList.innerHTML = "";

    const taches = window.tasks || [];
    const rappels = obtenirRappels(taches);

    rappels.forEach((tache) => {
        const rappel = document.createElement("p");

        if (tache.joursRestants < 0) {
            rappel.textContent =
                "🔴 En retard : " + tache.title;
            rappel.classList.add("reminder-overdue");
        } else if (tache.joursRestants === 0) {
            rappel.textContent =
                "🟠 Échéance aujourd'hui : " + tache.title;
            rappel.classList.add("reminder-today");
        } else {
            rappel.textContent =
                "🟢 Échéance dans " + tache.joursRestants +
                " jour(s) : " + tache.title;
            rappel.classList.add("reminder-soon");
        }

        remindersList.appendChild(rappel);
    });
}

afficherRappels();
