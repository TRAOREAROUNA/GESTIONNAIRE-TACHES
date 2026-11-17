const Database = require('better-sqlite3')
const path = require('path')

// Création ou ouverture de la base de données
const dbPath = process.env.DB_PATH || path.join(__dirname, 'gestionnaire.db')

const db = new Database(dbPath)

// Activation des clés étrangères
db.pragma('foreign_keys = ON')

// Création de la table des utilisateurs
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Création de la table des tâches
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    due_date TEXT,
    priority TEXT DEFAULT 'moyenne',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)
// Création de la table des jetons de réinitialisation
db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

// Index pour accélérer la recherche des jetons
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id)
`)

console.log('Base de données initialisée avec succès.')

module.exports = db
