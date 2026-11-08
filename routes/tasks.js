const express = require('express')
const verifierAuthentification = require('../middleware/auth')

function creerRoutesTasks (db) {
  const router = express.Router()

  // Fonctions de validation des tâches

  function validerTexte (text) {
    return (
      typeof text === 'string' &&
      text.trim().length > 0 &&
      text.trim().length <= 200
    )
  }

  function validerPriorite (priority) {
    return ['basse', 'moyenne', 'haute'].includes(priority)
  }

  function validerDate (dueDate) {
    if (dueDate === null || dueDate === '') {
      return true
    }

    if (typeof dueDate !== 'string') {
      return false
    }

    return (
      /^\d{4}-\d{2}-\d{2}$/.test(dueDate) &&
      !isNaN(Date.parse(dueDate)) &&
      new Date(dueDate).toISOString().startsWith(dueDate)
    )
  }

  // Toutes les routes nécessitent une authentification
  router.use(verifierAuthentification)

  // Vérifier l'identifiant d'une tâche
  function validerIdTache (id) {
    return /^\d+$/.test(id) && Number(id) > 0
  }

  // Récupérer les tâches de l'utilisateur connecté
  router.get('/', (req, res) => {
    const tasks = db
      .prepare(
        `
    SELECT
      id,
      text,
      done,
      due_date AS dueDate,
      priority
    FROM tasks
    WHERE user_id = ?
    ORDER BY id DESC
  `
      )
      .all(req.session.userId)

    res.json(
      tasks.map(task => ({
        ...task,
        done: Boolean(task.done)
      }))
    )
  })

  // Ajouter une tâche
  router.post('/', (req, res) => {
    const { text, dueDate, priority } = req.body

    if (!validerTexte(text)) {
      return res.status(400).json({
        message:
          'Le texte est obligatoire et ne doit pas dépasser 200 caractères.'
      })
    }

    if (priority && !validerPriorite(priority)) {
      return res.status(400).json({
        message: 'La priorité doit être basse, moyenne ou haute.'
      })
    }

    if (!validerDate(dueDate)) {
      return res.status(400).json({
        message: 'La date limite est invalide.'
      })
    }

    const result = db
      .prepare(
        `
    INSERT INTO tasks (user_id, text, due_date, priority)
    VALUES (?, ?, ?, ?)
  `
      )
      .run(
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
    if (!validerIdTache(req.params.id)) {
      return res.status(400).json({
        message: 'Identifiant de tâche invalide.'
      })
    }
    const { text, done, dueDate, priority } = req.body

    if (!validerTexte(text)) {
      return res.status(400).json({
        message:
          'Le texte est obligatoire et ne doit pas dépasser 200 caractères.'
      })
    }

    if (typeof done !== 'boolean') {
      return res.status(400).json({
        message: 'Le statut de la tâche doit être un booléen.'
      })
    }

    if (!validerPriorite(priority)) {
      return res.status(400).json({
        message: 'La priorité doit être basse, moyenne ou haute.'
      })
    }

    if (!validerDate(dueDate)) {
      return res.status(400).json({
        message: 'La date limite est invalide.'
      })
    }

    const result = db
      .prepare(
        `
    UPDATE tasks
    SET text = ?, done = ?, due_date = ?, priority = ?
    WHERE id = ? AND user_id = ?
  `
      )
      .run(
        text.trim(),
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
    if (!validerIdTache(req.params.id)) {
      return res.status(400).json({
        message: 'Identifiant de tâche invalide.'
      })
    }
    const result = db
      .prepare(
        `
    DELETE FROM tasks
    WHERE id = ? AND user_id = ?
  `
      )
      .run(req.params.id, req.session.userId)

    if (result.changes === 0) {
      return res.status(404).json({
        message: 'Tâche introuvable.'
      })
    }

    res.json({
      message: 'Tâche supprimée avec succès.'
    })
  })

  return router
}

module.exports = creerRoutesTasks
