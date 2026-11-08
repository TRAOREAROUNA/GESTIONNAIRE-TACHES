process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'secret-de-test-integration'

const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const Database = require('better-sqlite3')
const creerApp = require('../app')
const bcrypt = require('bcrypt')

test('Un utilisateur non connecté ne peut pas accéder aux tâches', async () => {
  // Créer une base de données temporaire en mémoire
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  // Créer les tables nécessaires au fonctionnement de l'application
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      priority TEXT DEFAULT 'moyenne',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  const app = creerApp(db)

  try {
    // Simuler une requête sans connexion
    const response = await request(app).get('/api/tasks')

    // Vérifier que l'accès est refusé
    assert.equal(response.status, 401)

    assert.equal(
      response.body.message,
      'Vous devez être connecté pour accéder à cette ressource.'
    )
  } finally {
    db.close()
  }
})
test('Un utilisateur peut créer un compte et ouvrir une session', async () => {
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      priority TEXT DEFAULT 'moyenne',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  const app = creerApp(db)
  const agent = request.agent(app)

  try {
    // Récupérer le jeton CSRF
    const csrfResponse = await agent.get('/api/csrf-token')

    assert.equal(csrfResponse.status, 200)

    const csrfToken = csrfResponse.body.csrfToken

    // Envoyer la demande d'inscription
    const registerResponse = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({
        name: 'Utilisateur Test',
        email: 'test@example.com',
        password: 'MotDePasse123'
      })

    assert.equal(registerResponse.status, 201)
    assert.equal(registerResponse.body.message, 'Compte créé avec succès.')
    assert.equal(registerResponse.body.user.email, 'test@example.com')

    // Vérifier que le mot de passe est bien chiffré
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get('test@example.com')

    assert.ok(user)
    assert.notEqual(user.password_hash, 'MotDePasse123')

    // Vérifier que la session est active
    const meResponse = await agent.get('/api/auth/me')

    assert.equal(meResponse.status, 200)
    assert.equal(meResponse.body.user.email, 'test@example.com')
  } finally {
    db.close()
  }
})
test('Un utilisateur peut se connecter avec ses identifiants', async () => {
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      priority TEXT DEFAULT 'moyenne',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  // Créer un utilisateur avec un mot de passe haché
  const passwordHash = await bcrypt.hash('MotDePasse123', 12)

  db.prepare(
    `
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
  `
  ).run('Utilisateur Test', 'test@example.com', passwordHash)

  const app = creerApp(db)
  const agent = request.agent(app)

  try {
    // Récupérer le jeton CSRF
    const csrfResponse = await agent.get('/api/csrf-token')
    assert.equal(csrfResponse.status, 200)

    const csrfToken = csrfResponse.body.csrfToken

    // Tester une connexion avec les bons identifiants
    const loginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'test@example.com',
        password: 'MotDePasse123'
      })

    assert.equal(loginResponse.status, 200)
    assert.equal(loginResponse.body.message, 'Connexion réussie.')
    // Vérifier les paramètres de sécurité du cookie de session
    const cookies = loginResponse.headers['set-cookie']
    assert.ok(cookies, 'Le serveur doit envoyer un cookie de session')

    const sessionCookie = cookies.find(cookie =>
      cookie.startsWith('connect.sid=')
    )

    assert.ok(sessionCookie, 'Le cookie de session doit être présent')
    assert.match(sessionCookie, /HttpOnly/i)
    assert.match(sessionCookie, /SameSite=Lax/i)
    assert.match(sessionCookie, /Expires=/i)
    const expiresMatch = sessionCookie.match(/Expires=([^;]+)/i)

    assert.ok(expiresMatch, 'La date d’expiration doit être présente')

    const expiresAt = new Date(expiresMatch[1]).getTime()
    const remainingTime = expiresAt - Date.now()

    assert.ok(
      remainingTime > 0 && remainingTime <= 2 * 60 * 60 * 1000,
      'Le cookie doit expirer dans un délai maximal de deux heures'
    )

    // Vérifier que la session est active
    const meResponse = await agent.get('/api/auth/me')

    assert.equal(meResponse.status, 200)
    assert.equal(meResponse.body.user.email, 'test@example.com')

    // Récupérer un nouveau jeton CSRF après la connexion
    const newCsrfResponse = await agent.get('/api/csrf-token')

    assert.equal(newCsrfResponse.status, 200)

    const newCsrfToken = newCsrfResponse.body.csrfToken

    // Tester un mauvais mot de passe
    const badLoginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', newCsrfToken)
      .send({
        email: 'test@example.com',
        password: 'MauvaisMotDePasse'
      })

    assert.equal(badLoginResponse.status, 401)
    assert.equal(
      badLoginResponse.body.message,
      'E-mail ou mot de passe incorrect.'
    )

    assert.equal(badLoginResponse.status, 401)
    assert.equal(
      badLoginResponse.body.message,
      'E-mail ou mot de passe incorrect.'
    )
  } finally {
    db.close()
  }
})
test('Un utilisateur peut se déconnecter et perdre sa session', async () => {
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      priority TEXT DEFAULT 'moyenne',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  const passwordHash = await bcrypt.hash('MotDePasse123', 12)

  db.prepare(
    `
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
  `
  ).run('Utilisateur Test', 'test@example.com', passwordHash)

  const app = creerApp(db)
  const agent = request.agent(app)

  try {
    // Récupérer le jeton CSRF
    const csrfResponse = await agent.get('/api/csrf-token')
    const csrfToken = csrfResponse.body.csrfToken

    // Se connecter
    const loginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'test@example.com',
        password: 'MotDePasse123'
      })

    assert.equal(loginResponse.status, 200)

    // Récupérer un nouveau jeton CSRF après la connexion
    const newCsrfResponse = await agent.get('/api/csrf-token')
    const newCsrfToken = newCsrfResponse.body.csrfToken

    // Se déconnecter
    const logoutResponse = await agent
      .post('/api/auth/logout')
      .set('x-csrf-token', newCsrfToken)

    assert.equal(logoutResponse.status, 200)
    assert.equal(logoutResponse.body.message, 'Déconnexion réussie.')

    // Vérifier que la session est détruite
    const meResponse = await agent.get('/api/auth/me')

    assert.equal(meResponse.status, 401)
    assert.equal(meResponse.body.message, 'Aucun utilisateur connecté.')
  } finally {
    db.close()
  }
})

test('Une requête sans jeton CSRF est rejetée', async () => {
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      priority TEXT DEFAULT 'moyenne',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  const app = creerApp(db)
  const agent = request.agent(app)

  try {
    // Initialiser la session CSRF
    const csrfResponse = await agent.get('/api/csrf-token')

    assert.equal(csrfResponse.status, 200)

    // Envoyer une requête sans transmettre le jeton
    const response = await agent.post('/api/auth/register').send({
      name: 'Utilisateur Test',
      email: 'csrf@example.com',
      password: 'MotDePasse123'
    })

    assert.equal(response.status, 403)
    assert.equal(response.body.message, 'Jeton CSRF invalide ou manquant.')
  } finally {
    db.close()
  }
})
test('Une requête avec un jeton CSRF invalide est rejetée', async () => {
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      priority TEXT DEFAULT 'moyenne',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  const app = creerApp(db)
  const agent = request.agent(app)

  try {
    // Initialiser la session CSRF
    const csrfResponse = await agent.get('/api/csrf-token')

    assert.equal(csrfResponse.status, 200)

    // Envoyer un jeton volontairement incorrect
    const response = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', 'jeton-invalide')
      .send({
        name: 'Utilisateur Test',
        email: 'csrf-invalide@example.com',
        password: 'MotDePasse123'
      })

    assert.equal(response.status, 403)
    assert.equal(response.body.message, 'Jeton CSRF invalide ou manquant.')
  } finally {
    db.close()
  }
})
