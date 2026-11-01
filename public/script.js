const form = document.getElementById('task-form')
const input = document.getElementById('task-input')
const submitButton = form.querySelector('button[type="submit"]')
const dueDateInput = document.getElementById('task-due-date')
const priorityInput = document.getElementById('task-priority')
const list = document.getElementById('task-list')
const sortSelect = document.getElementById('task-sort')
const searchInput = document.getElementById('task-search-input')

let currentFilter = 'all'
let editingTaskId = null

window.tasks = []
let tasks = window.tasks

function saveTasks () {
  window.tasks = tasks

  if (typeof displayCalendar === 'function') {
    displayCalendar()
  }

  if (typeof afficherRappels === 'function') {
    afficherRappels()
  }
}

function cancelEdit () {
  editingTaskId = null
  form.reset()
  submitButton.textContent = 'Ajouter'
  cancelButton.hidden = true
}

const cancelButton = document.createElement('button')
cancelButton.type = 'button'
cancelButton.textContent = 'Annuler'
cancelButton.hidden = true

submitButton.insertAdjacentElement('afterend', cancelButton)

cancelButton.addEventListener('click', function () {
  cancelEdit()
  input.focus()
})

function renderTasks () {
  list.innerHTML = ''

  const total = tasks.length
  const terminees = tasks.filter(task => task.done).length
  const restantes = total - terminees

  const dashboardTotal = document.getElementById('dashboard-total')
  const dashboardCompleted = document.getElementById('dashboard-completed')
  const dashboardRemaining = document.getElementById('dashboard-remaining')
  const dashboardOverdue = document.getElementById('dashboard-overdue')
  const dashboardProgress = document.getElementById('dashboard-progress')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueCount = tasks.filter(task => {
    if (task.done || !task.dueDate) {
      return false
    }

    const dueDate = new Date(task.dueDate + 'T00:00:00')
    return dueDate < today
  }).length

  const progress = calculerProgression(total, terminees)

  dashboardTotal.textContent = total
  dashboardCompleted.textContent = terminees
  dashboardRemaining.textContent = restantes
  dashboardOverdue.textContent = overdueCount
  dashboardProgress.textContent = progress + '%'

  document.getElementById('task-counter').textContent =
    'Total : ' +
    total +
    ' | Restantes : ' +
    restantes +
    ' | Terminées : ' +
    terminees

  const searchText = searchInput.value.trim().toLowerCase()

  const filteredTasks = tasks.filter(function (task) {
    let matchesFilter = true

    if (currentFilter === 'active') {
      matchesFilter = !task.done
    } else if (currentFilter === 'completed') {
      matchesFilter = task.done
    } else if (currentFilter === 'overdue') {
      if (task.done || !task.dueDate) {
        matchesFilter = false
      } else {
        const dueDate = new Date(task.dueDate + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        matchesFilter = dueDate < today
      }
    }

    const matchesSearch = task.text.toLowerCase().includes(searchText)

    return matchesFilter && matchesSearch
  })

  const sortedTasks = [...filteredTasks]

  if (sortSelect.value === 'priority') {
    const priorityOrder = {
      haute: 1,
      moyenne: 2,
      basse: 3
    }

    sortedTasks.sort(function (a, b) {
      return (
        (priorityOrder[a.priority || 'moyenne'] || 2) -
        (priorityOrder[b.priority || 'moyenne'] || 2)
      )
    })
  }

  if (sortSelect.value === 'due-date') {
    sortedTasks.sort(function (a, b) {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1

      return a.dueDate.localeCompare(b.dueDate)
    })
  }

  sortedTasks.forEach(function (task) {
    const item = document.createElement('li')

    const label = document.createElement('span')
    label.textContent = task.text

    const priorityLabel = document.createElement('small')
    const priority = task.priority || 'moyenne'

    priorityLabel.textContent = 'Priorité : ' + priority.toUpperCase()
    priorityLabel.classList.add('priority-' + priority)

    const dateLabel = document.createElement('small')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let status = ''

    if (task.done) {
      status = ' — TERMINÉE'
    } else if (!task.dueDate) {
      status = ' — SANS DATE LIMITE'
    } else {
      const dueDate = new Date(task.dueDate + 'T00:00:00')

      if (dueDate < today) {
        status = ' — EN RETARD'
      } else if (dueDate.getTime() === today.getTime()) {
        status = " — À FAIRE AUJOURD'HUI"
      } else {
        status = ' — EN COURS'
      }
    }

    dateLabel.textContent =
      (task.dueDate ? 'Date limite : ' + task.dueDate : '') + status

    if (task.done) {
      item.classList.add('done')
    }

    const doneButton = document.createElement('button')
    doneButton.type = 'button'
    doneButton.textContent = task.done ? 'Réactiver' : 'Terminer'

    doneButton.addEventListener('click', async function () {
      const nouveauStatut = !task.done

      try {
        const response = await fetch('/api/tasks/' + task.id, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: task.text,
            done: nouveauStatut,
            dueDate: task.dueDate,
            priority: task.priority
          })
        })

        const data = await response.json()

        if (!response.ok) {
          alert(data.message || 'Erreur lors de la mise à jour.')
          return
        }

        task.done = nouveauStatut
        saveTasks()
        renderTasks()
      } catch (error) {
        alert('Impossible de contacter le serveur.')
      }
    })

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.textContent = 'Modifier'

    editButton.addEventListener('click', function () {
      editingTaskId = task.id
      input.value = task.text
      dueDateInput.value = task.dueDate || ''
      priorityInput.value = task.priority || 'moyenne'

      submitButton.textContent = 'Enregistrer les modifications'
      cancelButton.hidden = false
      input.focus()
    })
    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.textContent = 'Supprimer'

    deleteButton.addEventListener('click', async function () {
      const confirmation = confirm(
        'Voulez-vous vraiment supprimer la tâche "' + task.text + '" ?'
      )

      if (!confirmation) {
        return
      }

      try {
        const response = await fetch('/api/tasks/' + task.id, {
          method: 'DELETE'
        })

        const data = await response.json()

        if (!response.ok) {
          alert(data.message || 'Erreur lors de la suppression.')
          return
        }

        tasks = tasks.filter(function (t) {
          return t.id !== task.id
        })

        if (editingTaskId === task.id) {
          cancelEdit()
        }

        saveTasks()
        renderTasks()
      } catch (error) {
        alert('Impossible de contacter le serveur.')
      }
    })
    item.append(
      label,
      priorityLabel,
      dateLabel,
      doneButton,
      editButton,
      deleteButton
    )

    list.appendChild(item)
  })
}

async function chargerTaches () {
  try {
    const response = await fetch('/api/tasks')
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erreur de chargement.')
    }

    tasks = data
    window.tasks = tasks
    renderTasks()
    if (typeof afficherRappels === 'function') {
      afficherRappels()
    }
    if (typeof displayCalendar === 'function') {
      displayCalendar()
    }
  } catch (error) {
    alert('Impossible de charger les tâches depuis le serveur.')
  }
}

form.addEventListener('submit', async function (event) {
  event.preventDefault()

  const text = input.value.trim()

  if (!text) {
    input.focus()
    return
  }

  const taskData = {
    text: text,
    done: false,
    dueDate: dueDateInput.value,
    priority: priorityInput.value
  }

  try {
    let response

    if (editingTaskId !== null) {
      const task = tasks.find(t => t.id === editingTaskId)

      if (!task) {
        alert('Tâche introuvable.')
        return
      }

      taskData.done = task.done

      response = await fetch('/api/tasks/' + editingTaskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })
    } else {
      response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })
    }

    const data = await response.json()

    if (!response.ok) {
      alert(data.message || 'Une erreur est survenue.')
      return
    }

    if (editingTaskId !== null) {
      const task = tasks.find(t => t.id === editingTaskId)
      Object.assign(task, taskData)
      cancelEdit()
    } else {
      tasks.unshift(data)
      form.reset()
    }

    saveTasks()
    renderTasks()
    input.focus()
  } catch (error) {
    alert('Impossible de contacter le serveur.')
  }
})
const filterButtons = document.querySelectorAll('#task-filters button')

filterButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    currentFilter = button.dataset.filter
    renderTasks()
  })
})
sortSelect.addEventListener('change', function () {
  renderTasks()
})
searchInput.addEventListener('input', function () {
  renderTasks()
})
renderTasks()

const exportButton = document.getElementById('export-tasks')
const importFile = document.getElementById('import-file')

// EXPORTER LES TÂCHES
exportButton.addEventListener('click', function () {
  const data = JSON.stringify(tasks, null, 2)
  const file = new Blob([data], {
    type: 'application/json'
  })

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = url
  link.download = 'mes-taches.json'
  link.click()

  URL.revokeObjectURL(url)
})

const csvButton = document.getElementById('export-csv')

// EXPORTER LES TÂCHES EN CSV POUR EXCEL
csvButton.addEventListener('click', function () {
  const headers = ['ID', 'Tâche', 'Terminée', 'Date limite', 'Priorité']

  const rows = tasks.map(function (task) {
    return [
      task.id,
      task.text,
      task.done ? 'Oui' : 'Non',
      task.dueDate || '',
      task.priority || 'moyenne'
    ]
  })

  function escapeCSV (value) {
    return '"' + String(value ?? '').replace(/"/g, '""') + '"'
  }

  const csvContent = [headers, ...rows]
    .map(function (row) {
      return row.map(escapeCSV).join(';')
    })
    .join('\r\n')

  // BOM UTF-8 pour préserver les accents dans Excel
  const file = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  })

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = url
  link.download = 'mes-taches.csv'
  link.click()

  URL.revokeObjectURL(url)
})

// IMPORTER LES TÂCHES
importFile.addEventListener('change', function () {
  const file = importFile.files[0]

  if (!file) return

  const reader = new FileReader()

  reader.onload = function (event) {
    try {
      const importedTasks = JSON.parse(event.target.result)

      if (
        !Array.isArray(importedTasks) ||
        !importedTasks.every(function (task) {
          return (
            task &&
            typeof task.id === 'number' &&
            typeof task.text === 'string' &&
            typeof task.done === 'boolean'
          )
        })
      ) {
        alert('Le fichier ne contient pas une liste de tâches valide.')
        return
      }

      const confirmImport = confirm(
        "L'importation remplacera toutes les tâches actuelles. Continuer ?"
      )

      if (!confirmImport) return

      tasks = importedTasks
      saveTasks()
      cancelEdit()
      renderTasks()

      alert('Importation réussie !')
    } catch (error) {
      alert('Impossible de lire ce fichier JSON.')
    } finally {
      importFile.value = ''
    }
  }

  reader.readAsText(file)
})
