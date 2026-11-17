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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  try {
    const passwordHash = await bcrypt.hash('MotDePasse123', 12)

    const userA = db
      .prepare(
        `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `
      )
      .run('Utilisateur A', 'a@example.com', passwordHash)

    db.prepare(
      `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `
    ).run('Utilisateur B', 'b@example.com', passwordHash)

    const task = db
      .prepare(
        `
      INSERT INTO tasks (user_id, text)
      VALUES (?, ?)
    `
      )
      .run(userA.lastInsertRowid, 'Tâche privée de A')

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
    const remainingTask = db
      .prepare(
        `
      SELECT * FROM tasks WHERE id = ?
    `
      )
      .get(task.lastInsertRowid)

    assert.ok(remainingTask)
    assert.equal(remainingTask.text, 'Tâche privée de A')
    assert.equal(remainingTask.user_id, userA.lastInsertRowid)
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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

test('Un utilisateur connecté peut modifier son profil', async () => {
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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  const app = creerApp(db)
  const agent = request.agent(app)

  try {
    const passwordHash = await bcrypt.hash('MotDePasse123', 12)

    db.prepare(
      `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `
    ).run('Ancien Nom', 'ancien@example.com', passwordHash)

    // Initialiser la session CSRF
    const initialCsrfResponse = await agent.get('/api/csrf-token')
    const initialCsrfToken = initialCsrfResponse.body.csrfToken

    // Connecter l'utilisateur avec le jeton CSRF
    const loginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', initialCsrfToken)
      .send({
        email: 'ancien@example.com',
        password: 'MotDePasse123'
      })
    assert.equal(loginResponse.status, 200)

    // Récupérer un nouveau jeton CSRF après connexion
    const csrfResponse = await agent.get('/api/csrf-token')
    const csrfToken = csrfResponse.body.csrfToken

    // Modifier le profil
    const response = await agent
      .put('/api/auth/profile')
      .set('x-csrf-token', csrfToken)
      .send({
        name: 'Nouveau Nom',
        email: 'nouveau@example.com'
      })

    assert.equal(response.status, 200)
    assert.equal(response.body.user.name, 'Nouveau Nom')
    assert.equal(response.body.user.email, 'nouveau@example.com')

    // Vérifier les données directement dans SQLite
    const user = db
      .prepare(
        `
      SELECT name, email
      FROM users
      WHERE id = ?
    `
      )
      .get(loginResponse.body.user.id)

    assert.equal(user.name, 'Nouveau Nom')
    assert.equal(user.email, 'nouveau@example.com')
  } finally {
    db.close()
  }
})

test('Un utilisateur connecté peut modifier son mot de passe', async () => {
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
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  const app = creerApp(db)
  const agent = request.agent(app)

  try {
    const ancienMotDePasse = 'MotDePasse123'
    const nouveauMotDePasse = 'NouveauMotDePasse456'

    const passwordHash = await bcrypt.hash(ancienMotDePasse, 12)

    db.prepare(
      `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `
    ).run('Utilisateur Test', 'password@example.com', passwordHash)

    // Initialiser la session CSRF
    const initialCsrfResponse = await agent.get('/api/csrf-token')
    const initialCsrfToken = initialCsrfResponse.body.csrfToken

    // Connecter l'utilisateur
    const loginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', initialCsrfToken)
      .send({
        email: 'password@example.com',
        password: ancienMotDePasse
      })

    assert.equal(loginResponse.status, 200)

    // Récupérer un nouveau jeton CSRF après connexion
    const csrfResponse = await agent.get('/api/csrf-token')
    const csrfToken = csrfResponse.body.csrfToken

    // Vérifier le refus d'un ancien mot de passe incorrect
    const mauvaisMotDePasse = await agent
      .put('/api/auth/password')
      .set('x-csrf-token', csrfToken)
      .send({
        currentPassword: 'MauvaisMotDePasse',
        newPassword: nouveauMotDePasse
      })

    assert.equal(mauvaisMotDePasse.status, 401)

    // Modifier le mot de passe avec le bon ancien mot de passe
    const response = await agent
      .put('/api/auth/password')
      .set('x-csrf-token', csrfToken)
      .send({
        currentPassword: ancienMotDePasse,
        newPassword: nouveauMotDePasse
      })

    assert.equal(response.status, 200)

    // Vérifier le nouveau mot de passe dans SQLite
    const user = db
      .prepare(
        `
      SELECT password_hash
      FROM users
      WHERE email = ?
    `
      )
      .get('password@example.com')

    assert.equal(
      await bcrypt.compare(nouveauMotDePasse, user.password_hash),
      true
    )

    assert.equal(
      await bcrypt.compare(ancienMotDePasse, user.password_hash),
      false
    )
  } finally {
    db.close()
  }
})

function creerBaseTestReinitialisation () {
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

    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  return db
}

test('Une demande de réinitialisation pour un compte inconnu ne révèle pas son existence', async () => {
  const db = creerBaseTestReinitialisation()
  let nombreEmails = 0

  const fauxTransporter = {
    sendMail: async () => {
      nombreEmails++
    }
  }

  const app = creerApp(db, { transporter: fauxTransporter })
  const agent = request.agent(app)

  try {
    const csrfResponse = await agent.get('/api/csrf-token')

    const response = await agent
      .post('/api/auth/forgot-password')
      .set('x-csrf-token', csrfResponse.body.csrfToken)
      .send({ email: 'inconnu@example.com' })

    assert.equal(response.status, 200)
    assert.equal(nombreEmails, 0)
    assert.match(response.body.message, /Si cette adresse correspond/)
  } finally {
    db.close()
  }
})

test('Un utilisateur peut réinitialiser son mot de passe avec un jeton valide une seule fois', async () => {
  const db = creerBaseTestReinitialisation()
  let mailEnvoye = null

  const fauxTransporter = {
    sendMail: async options => {
      mailEnvoye = options
    }
  }

  try {
    const ancienMotDePasse = 'AncienMotDePasse123'
    const nouveauMotDePasse = 'NouveauMotDePasse456'

    const passwordHash = await bcrypt.hash(ancienMotDePasse, 12)

    db.prepare(
      `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `
    ).run('Utilisateur Test', 'test@example.com', passwordHash)

    const app = creerApp(db, { transporter: fauxTransporter })
    const agent = request.agent(app)

    const csrfResponse = await agent.get('/api/csrf-token')

    const demande = await agent
      .post('/api/auth/forgot-password')
      .set('x-csrf-token', csrfResponse.body.csrfToken)
      .send({ email: 'test@example.com' })

    assert.equal(demande.status, 200)
    assert.ok(mailEnvoye)

    const correspondance = mailEnvoye.text.match(/token=([a-f0-9]{64})/)

    assert.ok(correspondance, 'Le lien envoyé doit contenir un jeton valide')

    const token = correspondance[1]

    const nouveauCsrf = await agent.get('/api/csrf-token')

    const reinitialisation = await agent
      .post(`/api/auth/reset-password/${token}`)
      .set('x-csrf-token', nouveauCsrf.body.csrfToken)
      .send({ newPassword: nouveauMotDePasse })

    assert.equal(reinitialisation.status, 200)

    const user = db
      .prepare(
        `
      SELECT password_hash
      FROM users
      WHERE email = ?
    `
      )
      .get('test@example.com')

    assert.equal(
      await bcrypt.compare(nouveauMotDePasse, user.password_hash),
      true
    )

    assert.equal(
      await bcrypt.compare(ancienMotDePasse, user.password_hash),
      false
    )

    const reutilisation = await agent
      .post(`/api/auth/reset-password/${token}`)
      .set('x-csrf-token', nouveauCsrf.body.csrfToken)
      .send({ newPassword: 'AutreMotDePasse789' })

    assert.equal(reutilisation.status, 400)
  } finally {
    db.close()
  }
})
