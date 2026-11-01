// Chargement des variables confidentielles
require('dotenv').config()

const express = require('express')
const path = require('path')
const session = require('express-session')
const SqliteStore = require('better-sqlite3-session-store')(session)
const db = require('./database/db')
const authRoutes = require('./routes/auth')
const taskRoutes = require('./routes/tasks')

const app = express()
const PORT = 3000

// Vérification du secret de session
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET est absent du fichier .env')
}

// Réception des données JSON
app.use(express.json())

// Configuration des sessions
app.use(
  session({
    store: new SqliteStore({
      client: db,
      expired: {
        clear: true,
        intervalMs: 900000
      }
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2 * 60 * 60 * 1000
    }
  })
)

// Routes d'authentification
app.use('/api/auth', authRoutes)

// Routes de gestion des tâches
app.use('/api/tasks', taskRoutes)

// Mise à disposition de l'interface web
app.use(express.static(path.join(__dirname, 'public')))

// Route de test
app.get('/api', function (req, res) {
  res.json({
    message: 'Bienvenue sur le serveur du gestionnaire de tâches !',
    status: 'OK'
  })
})

// Démarrage du serveur
app.listen(PORT, function () {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
