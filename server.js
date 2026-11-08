require('dotenv').config()

const db = require('./database/db')
const creerApp = require('./app')

const PORT = process.env.PORT || 3000

const app = creerApp(db)

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})