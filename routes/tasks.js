
const express = require('express')
const db = require('../database/db')
const verifierAuthentification = require('../middleware/auth')

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(verifierAuthentification)

// Récupérer les tâches de l'utilisateur connecté
router.get('/', (req, res) => {
  const tasks = db.prepare(`
    SELECT
      id,
      text,
      done,
      due_date AS dueDate,
      priority
    FROM tasks
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(req.session.userId)

  res.json(tasks.map(task => ({
    ...task,
    done: Boolean(task.done)
  })))
})

// Ajouter une tâche
router.post('/', (req, res) => {
  const { text, dueDate, priority } = req.body

  if (!text || !text.trim()) {
    return res.status(400).json({
      message: 'Le texte de la tâche est obligatoire.'
    })
  }

  const result = db.prepare(`
    INSERT INTO tasks (user_id, text, due_date, priority)
    VALUES (?, ?, ?, ?)
  `).run(
    req.session.userId,
    text.trim(),
    dueDate || null,
    priority || 'moyenne'
  )

  res.status(201).json({
    id: result.lastInsertRowid,
    text: text.trim(),
    done: false,
    dueDate: dueDate || null,
    priority: priority || 'moyenne'
  })
})

// Modifier une tâche
router.put('/:id', (req, res) => {
  const { text, done, dueDate, priority } = req.body

  const result = db.prepare(`
    UPDATE tasks
    SET text = ?, done = ?, due_date = ?, priority = ?
    WHERE id = ? AND user_id = ?
  `).run(
    text,
    done ? 1 : 0,
    dueDate || null,
    priority || 'moyenne',
    req.params.id,
    req.session.userId
  )

  if (result.changes === 0) {
    return res.status(404).json({
      message: 'Tâche introuvable.'
    })
  }

  res.json({
    message: 'Tâche modifiée avec succès.'
  })
})

// Supprimer une tâche
router.delete('/:id', (req, res) => {
  const result = db.prepare(`
    DELETE FROM tasks
    WHERE id = ? AND user_id = ?
  `).run(
    req.params.id,
    req.session.userId
  )

  if (result.changes === 0) {
    return res.status(404).json({
      message: 'Tâche introuvable.'
    })
  }

  res.json({
    message: 'Tâche supprimée avec succès.'
  })
})

module.exports = router
