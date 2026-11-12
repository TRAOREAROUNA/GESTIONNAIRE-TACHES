process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'secret-de-test-integration'

const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const Database = require('better-sqlite3')
const creerApp = require('../app')
const bcrypt = require('bcrypt')

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
test('Un utilisateur ne peut pas accéder aux tâches d’un autre utilisateur', async () => {
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

  try {
    const passwordHash = await bcrypt.hash('MotDePasse123', 12)

    const userA = db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run('Utilisateur A', 'a@example.com', passwordHash)

    db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run('Utilisateur B', 'b@example.com', passwordHash)

    const task = db.prepare(`
      INSERT INTO tasks (user_id, text)
      VALUES (?, ?)
    `).run(userA.lastInsertRowid, 'Tâche privée de A')

    const app = creerApp(db)
    const agentB = request.agent(app)

    const csrfResponse = await agentB.get('/api/csrf-token')
    const csrfToken = csrfResponse.body.csrfToken

    const loginResponse = await agentB
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'b@example.com',
        password: 'MotDePasse123'
      })

    assert.equal(loginResponse.status, 200)

    // B ne doit pas voir la tâche de A
    const tasksResponse = await agentB.get('/api/tasks')

    assert.equal(tasksResponse.status, 200)
    assert.equal(tasksResponse.body.length, 0)

    const newCsrfResponse = await agentB.get('/api/csrf-token')
    const newCsrfToken = newCsrfResponse.body.csrfToken

    // B ne doit pas modifier la tâche de A
    const updateResponse = await agentB
      .put(`/api/tasks/${task.lastInsertRowid}`)
      .set('x-csrf-token', newCsrfToken)
      .send({
        text: 'Tâche modifiée par B',
        done: true,
        dueDate: null,
        priority: 'haute'
      })

    assert.equal(updateResponse.status, 404)

    // B ne doit pas supprimer la tâche de A
    const deleteResponse = await agentB
      .delete(`/api/tasks/${task.lastInsertRowid}`)
      .set('x-csrf-token', newCsrfToken)

    assert.equal(deleteResponse.status, 404)

    // La tâche de A doit toujours exister
    const remainingTask = db.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `).get(task.lastInsertRowid)

    assert.ok(remainingTask)
    assert.equal(remainingTask.text, 'Tâche privée de A')
    assert.equal(remainingTask.user_id, userA.lastInsertRowid)
  } finally {
    db.close()
  }
})
