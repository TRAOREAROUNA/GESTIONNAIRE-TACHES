require('dotenv').config()

const express = require('express')
const path = require('path')
const session = require('express-session')
const { csrfSync } = require('csrf-sync')
const SqliteStore = require('better-sqlite3-session-store')(session)
class SqliteStoreAvecTimerNonBloquant extends SqliteStore {
  startInterval () {
    const interval = setInterval(
      this.clearExpiredSessions.bind(this),
      this.expired.intervalMs
    )

    interval.unref()
  }
}

const creerRoutesAuth = require('./routes/auth')
const creerRoutesTasks = require('./routes/tasks')

function creerApp (db) {
  const app = express()

  const { generateToken, csrfSynchronisedProtection } = csrfSync()

  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET est absent du fichier .env')
  }

  app.use(express.json())

  app.use(
    session({
      store: new SqliteStoreAvecTimerNonBloquant({
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

  app.use((req, res, next) => {
    const method = req.method.toUpperCase()

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next()
    }

    const origin = req.get('origin')
    const referer = req.get('referer')
    const source = origin || referer

    if (!source) {
      return next()
    }

    try {
      const sourceUrl = new URL(source)

      if (sourceUrl.host !== req.get('host')) {
        return res.status(403).json({
          message: 'Origine de la requête non autorisée.'
        })
      }
    } catch {
      return res.status(403).json({
        message: 'Origine de la requête invalide.'
      })
    }

    next()
  })

  app.get('/api/csrf-token', (req, res) => {
    res.json({
      csrfToken: generateToken(req)
    })
  })
  app.use(csrfSynchronisedProtection)

  app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        message: 'Jeton CSRF invalide ou manquant.'
      })
    }

    next(err)
  })

  app.use('/api/auth', creerRoutesAuth(db))
  app.use('/api/tasks', creerRoutesTasks(db))

  app.use(express.static(path.join(__dirname, 'public')))

  app.get('/api', (req, res) => {
    res.json({
      message: 'Bienvenue sur le serveur du gestionnaire de tâches !',
      status: 'OK'
    })
  })

  return app
}

module.exports = creerApp
