
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const dueDateInput = document.getElementById("task-due-date");
const list = document.getElementById("task-list");

// Charger les tâches enregistrées dans le navigateur
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}


function renderTasks() {
    list.innerHTML = "";

    const total = tasks.length;

    const terminees = tasks.filter(function (task) {
        return task.done;
    }).length;

    const restantes = total - terminees;

    document.getElementById("task-counter").textContent =
        "Total : " + total +
        " | Restantes : " + restantes +
        " | Terminées : " + terminees;


    tasks.forEach(function (task) {
        const item = document.createElement("li");
        const label = document.createElement("span");
label.textContent = task.text;

const dateLabel = document.createElement("small");

if (task.dueDate) {
    dateLabel.textContent = " — Date limite : " + task.dueDate;
} else {
    dateLabel.textContent = " — Sans date limite";
}

        if (task.done) {
            item.classList.add("done");
        }

        const doneButton = document.createElement("button");
        doneButton.textContent = task.done ? "Réactiver" : "Terminer";

        doneButton.addEventListener("click", function () {
            task.done = !task.done;
            saveTasks();
            renderTasks();
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Supprimer";

        deleteButton.addEventListener("click", function () {
            tasks = tasks.filter(function (t) {
                return t.id !== task.id;
            });

            saveTasks();
            renderTasks();
        });

        item.append(label, dateLabel, doneButton, deleteButton);
list.appendChild(item);
    });
}

form.addEventListener("submit", function (event) {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) return;


tasks.push({
    id: Date.now() + Math.random(),
    text: text,
    done: false,
    dueDate: dueDateInput.value
});


    saveTasks();
    renderTasks();

    input.value = "";
    dueDateInput.value = "";
    input.focus();
});

// Afficher les tâches dès l'ouverture de la page
renderTasks();
