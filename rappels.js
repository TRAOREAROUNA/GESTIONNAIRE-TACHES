
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
                "🔴 En retard : " + tache.text;
            rappel.classList.add("reminder-overdue");
        } else if (tache.joursRestants === 0) {
            rappel.textContent =
                "🟠 Échéance aujourd'hui : " + tache.text;
            rappel.classList.add("reminder-today");
        } else {
            rappel.textContent =
                "🟢 Échéance dans " + tache.joursRestants +
                " jour(s) : " + tache.text;
            rappel.classList.add("reminder-soon");
        }

        remindersList.appendChild(rappel);
    });
}

afficherRappels();

const boutonNotifications = document.getElementById("enable-notifications");

if (boutonNotifications) {
    boutonNotifications.addEventListener("click", async function () {
        if (!("Notification" in window)) {
            alert("Ce navigateur ne prend pas en charge les notifications.");
            return;
        }

        const permission = await Notification.requestPermission();

        if (permission === "granted") {
            boutonNotifications.textContent = "Notifications activées";
            envoyerNotifications();
        } else {
            alert("Autorisation des notifications refusée.");
        }
    });
}

function envoyerNotifications() {
    if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
    ) {
        return;
    }

    const taches = window.tasks || [];
    const rappels = obtenirRappels(taches);

    rappels.forEach(function (tache) {
        if (tache.joursRestants > 0) {
            return;
        }

        const cle = "notification-" + tache.text + "-" + tache.dueDate;

        let dejaEnvoyee = false;

        try {
            dejaEnvoyee = sessionStorage.getItem(cle) === "envoyee";
        } catch (erreur) {
            // Le navigateur peut restreindre l'accès au stockage.
        }

        if (dejaEnvoyee) {
            return;
        }

        const titre = tache.joursRestants < 0
            ? "Tâche en retard"
            : "Échéance aujourd'hui";

        new Notification(titre, {
            body: tache.text,
            tag: cle
        });

        try {
            sessionStorage.setItem(cle, "envoyee");
        } catch (erreur) {
            // La notification reste possible sans stockage.
        }
    });
}

