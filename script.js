
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");

form.addEventListener("submit", function (event) {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = text;

    const doneButton = document.createElement("button");
    doneButton.textContent = "Terminer";
    doneButton.addEventListener("click", function () {
        item.classList.toggle("done");
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Supprimer";
    deleteButton.addEventListener("click", function () {
        item.remove();
    });

    item.append(label, doneButton, deleteButton);
    list.appendChild(item);

    input.value = "";
    input.focus();
});
