
const calendarMonth = document.getElementById("calendar-month");
const calendarGrid = document.getElementById("calendar-grid");

const currentDate = new Date();

let displayedMonth = currentDate.getMonth();
let displayedYear = currentDate.getFullYear();

function displayCalendarMonth() {
    const date = new Date(displayedYear, displayedMonth, 1);

    calendarMonth.textContent = date.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric"
    });
}

function displayCalendar() {
    displayCalendarMonth();

    calendarGrid.innerHTML = "";

    const daysOfWeek = [
        "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"
    ];

    daysOfWeek.forEach(day => {
        const dayHeader = document.createElement("div");
        dayHeader.className = "calendar-day-header";
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });

    const firstDay = new Date(displayedYear, displayedMonth, 1);
    const numberOfDays = new Date(
        displayedYear,
        displayedMonth + 1,
        0
    ).getDate();

    // JavaScript commence la semaine le dimanche.
    // On convertit pour commencer le calendrier le lundi.
    const startingDay = (firstDay.getDay() + 6) % 7;

    // Cases vides avant le premier jour du mois.
    for (let i = 0; i < startingDay; i++) {
        const emptyDay = document.createElement("div");
        emptyDay.className = "calendar-day empty";
        calendarGrid.appendChild(emptyDay);
    }

    // Affichage des jours du mois.
 
    // Affichage des jours du mois.
    for (let day = 1; day <= numberOfDays; day++) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day";

const today = new Date();

if (
    day === today.getDate() &&
    displayedMonth === today.getMonth() &&
    displayedYear === today.getFullYear()
) {
    dayCell.classList.add("today");
}


        const dayNumber = document.createElement("div");
        dayNumber.className = "calendar-day-number";
        dayNumber.textContent = day;

        dayCell.appendChild(dayNumber);

        const dateString =
            displayedYear + "-" +
            String(displayedMonth + 1).padStart(2, "0") + "-" +
            String(day).padStart(2, "0");

        const dayTasks = tasks.filter(function (task) {
            return task.dueDate === dateString;
        });

        dayTasks.forEach(function (task) {
            const taskElement = document.createElement("div");
            taskElement.className = "calendar-task";
            taskElement.textContent = task.text;

            if (task.done) {
                taskElement.classList.add("done");
            }

            taskElement.title =
                task.text + " — Priorité : " +
                (task.priority || "moyenne");

            dayCell.appendChild(taskElement);
        });

        calendarGrid.appendChild(dayCell);
    }

}

displayCalendar();

const previousMonthButton = document.getElementById("calendar-previous");
const nextMonthButton = document.getElementById("calendar-next");

previousMonthButton.addEventListener("click", function () {
    displayedMonth--;

    if (displayedMonth < 0) {
        displayedMonth = 11;
        displayedYear--;
    }

    displayCalendar();
});

nextMonthButton.addEventListener("click", function () {
    displayedMonth++;

    if (displayedMonth > 11) {
        displayedMonth = 0;
        displayedYear++;
    }

    displayCalendar();
});

