const express = require('express')
const bcrypt = require('bcrypt')
const rateLimit = require('express-rate-limit')
function creerRoutesAuth (db) {
  const router = express.Router()
  // Toutes tes routes existantes restent ici :
  // Inscription
  // Connexion
  // Vérification de l'utilisateur
  // Déconnexion

  // Limiter les tentatives de connexion
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // 5 tentatives maximum
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
    }
  })

  // Inscription d'un utilisateur
  router.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body

      if (
        typeof name !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !name.trim() ||
        !email.trim() ||
        !password
      ) {
        return res.status(400).json({
          message: 'Tous les champs sont obligatoires.'
        })
      }

      if (name.trim().length > 100) {
        return res.status(400).json({
          message: 'Le nom ne doit pas dépasser 100 caractères.'
        })
      }

      const emailNormalise = email.trim().toLowerCase()

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalise)) {
        return res.status(400).json({
          message: 'Adresse e-mail invalide.'
        })
      }

      if (password.length < 8 || password.length > 72) {
        return res.status(400).json({
          message: 'Le mot de passe doit contenir entre 8 et 72 caractères.'
        })
      }

      const existingUser = db
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(email.trim().toLowerCase())

      if (existingUser) {
        return res.status(409).json({
          message: 'Cette adresse e-mail est déjà utilisée.'
        })
      }

      const passwordHash = await bcrypt.hash(password, 12)

      const result = db
        .prepare(
          `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `
        )
        .run(name.trim(), emailNormalise, passwordHash)

      req.session.regenerate(error => {
        if (error) {
          return res.status(500).json({
            message: 'Erreur lors de la création de la session.'
          })
        }

        req.session.userId = result.lastInsertRowid

        req.session.save(saveError => {
          if (saveError) {
            return res.status(500).json({
              message: 'Erreur lors de la sauvegarde de la session.'
            })
          }
          res.status(201).json({
            message: 'Compte créé avec succès.',
            user: {
              id: result.lastInsertRowid,
              name: name.trim(),
              email: emailNormalise
            }
          })
        })
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({
        message: 'Erreur lors de la création du compte.'
      })
    }
  })

  // Connexion d'un utilisateur
  router.post('/login', loginLimiter, async (req, res) => {
    try {
      const { email, password } = req.body

      if (
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !email.trim() ||
        !password ||
        password.length > 72
      ) {
        return res.status(400).json({
          message: 'E-mail et mot de passe obligatoires ou invalides.'
        })
      }
      const emailNormalise = email.trim().toLowerCase()
      const user = db
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(emailNormalise)

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({
          message: 'E-mail ou mot de passe incorrect.'
        })
      }

      req.session.regenerate(error => {
        if (error) {
          return res.status(500).json({
            message: 'Erreur lors de la création de la session.'
          })
        }

        req.session.userId = user.id

        req.session.save(saveError => {
          if (saveError) {
            return res.status(500).json({
              message: 'Erreur lors de la sauvegarde de la session.'
            })
          }

          res.json({
            message: 'Connexion réussie.',
            user: {
              id: user.id,
              name: user.name,
              email: user.email
            }
          })
        })
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({
        message: 'Erreur lors de la connexion.'
      })
    }
  })

  // Vérifier l'utilisateur actuellement connecté
  router.get('/me', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({
        message: 'Aucun utilisateur connecté.'
      })
    }

    const user = db
      .prepare(
        `
    SELECT id, name, email
    FROM users
    WHERE id = ?
  `
      )
      .get(req.session.userId)

    if (!user) {
      return res.status(401).json({
        message: 'Utilisateur introuvable.'
      })
    }

    res.json({ user })
  })

  // Modifier le profil de l'utilisateur connecté
  router.put('/profile', (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: 'Vous devez être connecté pour modifier votre profil.'
        })
      }

      const { name, email } = req.body

      if (
        typeof name !== 'string' ||
        typeof email !== 'string' ||
        !name.trim() ||
        !email.trim()
      ) {
        return res.status(400).json({
          message: 'Le nom et l’adresse e-mail sont obligatoires.'
        })
      }

      const nomNormalise = name.trim()
      const emailNormalise = email.trim().toLowerCase()

      if (nomNormalise.length > 100) {
        return res.status(400).json({
          message: 'Le nom ne doit pas dépasser 100 caractères.'
        })
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalise)) {
        return res.status(400).json({
          message: 'Adresse e-mail invalide.'
        })
      }

      const existingUser = db
        .prepare(
          `
      SELECT id FROM users
      WHERE email = ? AND id != ?
    `
        )
        .get(emailNormalise, req.session.userId)

      if (existingUser) {
        return res.status(409).json({
          message: 'Cette adresse e-mail est déjà utilisée.'
        })
      }

      db.prepare(
        `
      UPDATE users
      SET name = ?, email = ?
      WHERE id = ?
    `
      ).run(nomNormalise, emailNormalise, req.session.userId)

      res.json({
        message: 'Profil mis à jour avec succès.',
        user: {
          id: req.session.userId,
          name: nomNormalise,
          email: emailNormalise
        }
      })
    } catch (error) {
      console.error(error)

      res.status(500).json({
        message: 'Erreur lors de la modification du profil.'
      })
    }
  })

  // Modifier le mot de passe de l'utilisateur connecté
  router.put('/password', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: 'Vous devez être connecté pour modifier votre mot de passe.'
        })
      }

      const { currentPassword, newPassword } = req.body

      if (
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string' ||
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          message: 'Tous les champs sont obligatoires.'
        })
      }

      if (newPassword.length < 8 || newPassword.length > 72) {
        return res.status(400).json({
          message:
            'Le nouveau mot de passe doit contenir entre 8 et 72 caractères.'
        })
      }

      const user = db
        .prepare(
          `
        SELECT password_hash
        FROM users
        WHERE id = ?
      `
        )
        .get(req.session.userId)

      if (!user) {
        return res.status(404).json({
          message: 'Utilisateur introuvable.'
        })
      }

      const passwordCorrect = await bcrypt.compare(
        currentPassword,
        user.password_hash
      )

      if (!passwordCorrect) {
        return res.status(401).json({
          message: 'Le mot de passe actuel est incorrect.'
        })
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 12)

      db.prepare(
        `
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
      `
      ).run(newPasswordHash, req.session.userId)

      res.json({
        message: 'Mot de passe modifié avec succès.'
      })
    } catch (error) {
      console.error(error)

      res.status(500).json({
        message: 'Erreur lors de la modification du mot de passe.'
      })
    }
  })

  // Déconnexion
  router.post('/logout', (req, res) => {
    req.session.destroy(error => {
      if (error) {
        return res.status(500).json({
          message: 'Erreur lors de la déconnexion.'
        })
      }

      res.clearCookie('connect.sid')

      res.json({
        message: 'Déconnexion réussie.'
      })
    })
  })

  return router
}

module.exports = creerRoutesAuth
