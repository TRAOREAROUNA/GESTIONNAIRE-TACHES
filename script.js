
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const submitButton = form.querySelector('button[type="submit"]');
const dueDateInput = document.getElementById("task-due-date");
const priorityInput = document.getElementById("task-priority");
const list = document.getElementById("task-list");
const sortSelect = document.getElementById("task-sort");
const searchInput = document.getElementById("task-search-input");

let currentFilter = "all";
let editingTaskId = null;

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

function cancelEdit() {
    editingTaskId = null;
    form.reset();
    submitButton.textContent = "Ajouter";
    cancelButton.hidden = true;
}

const cancelButton = document.createElement("button");
cancelButton.type = "button";
cancelButton.textContent = "Annuler";
cancelButton.hidden = true;

submitButton.insertAdjacentElement("afterend", cancelButton);

cancelButton.addEventListener("click", function () {
    cancelEdit();
    input.focus();
});

function renderTasks() {
    list.innerHTML = "";

    const total = tasks.length;
    const terminees = tasks.filter(task => task.done).length;
    const restantes = total - terminees;

    document.getElementById("task-counter").textContent =
        "Total : " + total +
        " | Restantes : " + restantes +
        " | Terminées : " + terminees;

    const searchText = searchInput.value.trim().toLowerCase();

const filteredTasks = tasks.filter(function (task) {
    const matchesFilter =
        currentFilter === "active" ? !task.done :
        currentFilter === "completed" ? task.done :
        true;

    const matchesSearch = task.text
        .toLowerCase()
        .includes(searchText);

    return matchesFilter && matchesSearch;
});
    const sortedTasks = [...filteredTasks];

if (sortSelect.value === "priority") {
    const priorityOrder = {
        haute: 1,
        moyenne: 2,
        basse: 3
    };

    sortedTasks.sort(function (a, b) {
        return (priorityOrder[a.priority || "moyenne"] || 2) -
               (priorityOrder[b.priority || "moyenne"] || 2);
    });
}

    sortedTasks.forEach(function (task) {
        const item = document.createElement("li");

        const label = document.createElement("span");
        label.textContent = task.text;

const priorityLabel = document.createElement("small");
const priority = task.priority || "moyenne";

priorityLabel.textContent = "Priorité : " + priority.toUpperCase();
priorityLabel.classList.add("priority-" + priority);

        const dateLabel = document.createElement("small");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let status = "";

        if (task.done) {
            status = " — TERMINÉE";
        } else if (!task.dueDate) {
            status = " — SANS DATE LIMITE";
        } else {
            const dueDate = new Date(task.dueDate + "T00:00:00");

            if (dueDate < today) {
                status = " — EN RETARD";
            } else if (dueDate.getTime() === today.getTime()) {
                status = " — À FAIRE AUJOURD'HUI";
            } else {
                status = " — EN COURS";
            }
        }

        dateLabel.textContent =
            (task.dueDate ? "Date limite : " + task.dueDate : "") +
            status;

        if (task.done) {
            item.classList.add("done");
        }

        const doneButton = document.createElement("button");
        doneButton.type = "button";
        doneButton.textContent = task.done ? "Réactiver" : "Terminer";

        doneButton.addEventListener("click", function () {
            task.done = !task.done;
            saveTasks();
            renderTasks();
        });

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Modifier";

        editButton.addEventListener("click", function () {
            editingTaskId = task.id;
            input.value = task.text;
            dueDateInput.value = task.dueDate || "";
            priorityInput.value = task.priority || "moyenne";

            submitButton.textContent = "Enregistrer les modifications";
            cancelButton.hidden = false;
            input.focus();
        });
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Supprimer";

        
deleteButton.addEventListener("click", function () {
    const confirmation = confirm(
        'Voulez-vous vraiment supprimer la tâche "' + task.text + '" ?'
    );

    if (!confirmation) {
        return;
    }

    tasks = tasks.filter(function (t) {
        return t.id !== task.id;
    });

    if (editingTaskId === task.id) {
        cancelEdit();
    }

    saveTasks();
    renderTasks();
});


      item.append(
    label,
    priorityLabel,
    dateLabel,
    doneButton,
    editButton,
    deleteButton
);

        list.appendChild(item);
    });
}

form.addEventListener("submit", function (event) {
    event.preventDefault();

    const text = input.value.trim();

    if (!text) {
        input.focus();
        return;
    }

    if (editingTaskId !== null) {
        const task = tasks.find(function (t) {
            return t.id === editingTaskId;
        });

        if (task) {
            task.text = text;
            task.dueDate = dueDateInput.value;
            task.priority = priorityInput.value;
        }

        cancelEdit();
    } else {
       tasks.push({
    id: Date.now() + Math.random(),
    text: text,
    done: false,
    dueDate: dueDateInput.value,
    priority: priorityInput.value
});

        form.reset();
    }

    saveTasks();
    renderTasks();
    input.focus();
});

const filterButtons = document.querySelectorAll("#task-filters button");

filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        currentFilter = button.dataset.filter;
        renderTasks();
    });
});
sortSelect.addEventListener("change", function () {
    renderTasks();
});
searchInput.addEventListener("input", function () {
    renderTasks();
});
renderTasks();

const exportButton = document.getElementById("export-tasks");
const importFile = document.getElementById("import-file");

// EXPORTER LES TÂCHES
exportButton.addEventListener("click", function () {
    const data = JSON.stringify(tasks, null, 2);
    const file = new Blob([data], {
        type: "application/json"
    });

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = "mes-taches.json";
    link.click();

    URL.revokeObjectURL(url);
});

// IMPORTER LES TÂCHES
importFile.addEventListener("change", function () {
    const file = importFile.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
        try {
            const importedTasks = JSON.parse(event.target.result);

            if (
                !Array.isArray(importedTasks) ||
                !importedTasks.every(function (task) {
                    return (
                        task &&
                        typeof task.id === "number" &&
                        typeof task.text === "string" &&
                        typeof task.done === "boolean"
                    );
                })
            ) {
                alert("Le fichier ne contient pas une liste de tâches valide.");
                return;
            }

            const confirmImport = confirm(
                "L'importation remplacera toutes les tâches actuelles. Continuer ?"
            );

            if (!confirmImport) return;

            tasks = importedTasks;
            saveTasks();
            cancelEdit();
            renderTasks();

            alert("Importation réussie !");
        } catch (error) {
            alert("Impossible de lire ce fichier JSON.");
        } finally {
            importFile.value = "";
        }
    };

    reader.readAsText(file);
});

