const authSection = document.getElementById('auth-section')
const taskApp = document.getElementById('task-app')

// Gestion du jeton CSRF
let csrfToken = null

async function obtenirJetonCsrf () {
  try {
    const response = await fetch('/api/csrf-token')

    if (!response.ok) {
      throw new Error('Impossible de récupérer le jeton CSRF.')
    }

    const data = await response.json()
    csrfToken = data.csrfToken

    return csrfToken
  } catch (error) {
    console.error(error)
    throw error
  }
}

// Rendre la fonction accessible aux autres scripts
window.obtenirJetonCsrf = obtenirJetonCsrf

const loginForm = document.getElementById('login-form')
const registerForm = document.getElementById('register-form')
const loginSection = document.getElementById('login-section')
const registerSection = document.getElementById('register-section')

const showRegisterButton = document.getElementById('show-register-button')
const showLoginButton = document.getElementById('show-login-button')

const forgotPasswordSection = document.getElementById('forgot-password-section')
const forgotPasswordForm = document.getElementById('forgot-password-form')
const forgotPasswordEmail = document.getElementById('forgot-password-email')
const forgotPasswordMessage = document.getElementById('forgot-password-message')

const showForgotPasswordButton = document.getElementById(
  'show-forgot-password-button'
)
const backToLoginButton = document.getElementById('back-to-login-button')

// Afficher le formulaire de mot de passe oublié
showForgotPasswordButton.addEventListener('click', () => {
  loginSection.hidden = true
  registerSection.hidden = true
  forgotPasswordSection.hidden = false

  forgotPasswordEmail.value = document.getElementById('login-email').value

  forgotPasswordMessage.textContent = ''
})

// Revenir à la connexion
backToLoginButton.addEventListener('click', () => {
  forgotPasswordSection.hidden = true
  loginSection.hidden = false
  forgotPasswordMessage.textContent = ''
})

// Envoyer la demande de réinitialisation
forgotPasswordForm.addEventListener('submit', async event => {
  event.preventDefault()

  const email = forgotPasswordEmail.value.trim()

  try {
    const token = await obtenirJetonCsrf()

    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      body: JSON.stringify({ email })
    })

    const data = await response.json()

    if (!response.ok) {
      forgotPasswordMessage.textContent =
        data.message || 'Erreur lors de la demande.'
      return
    }

    forgotPasswordMessage.textContent = data.message
    forgotPasswordForm.reset()
  } catch (error) {
    forgotPasswordMessage.textContent = 'Erreur de connexion au serveur.'
  }
})

// Passer du formulaire de connexion à l'inscription
showRegisterButton.addEventListener('click', () => {
  loginSection.hidden = true
  registerSection.hidden = false
  afficherMessage('')
})

// Revenir au formulaire de connexion
showLoginButton.addEventListener('click', () => {
  registerSection.hidden = true
  loginSection.hidden = false
  afficherMessage('')
})

const authMessage = document.getElementById('auth-message')
const currentUser = document.getElementById('current-user')
const logoutButton = document.getElementById('logout-button')

// Afficher les messages
function afficherMessage (message) {
  authMessage.textContent = message
}

// Vérifier la session utilisateur
async function verifierSession () {
  try {
    const response = await fetch('/api/auth/me')

    if (!response.ok) {
      authSection.hidden = false
      taskApp.hidden = true
      loginSection.hidden = false
      registerSection.hidden = true
      return
    }
    const data = await response.json()

    currentUser.textContent = data.user.name
    authSection.hidden = true
    taskApp.hidden = false

    await chargerTaches()
  } catch (error) {
    afficherMessage('Impossible de contacter le serveur.')
  }
}

// Connexion
loginForm.addEventListener('submit', async event => {
  event.preventDefault()

  const email = document.getElementById('login-email').value
  const password = document.getElementById('login-password').value

  try {
    const token = await obtenirJetonCsrf()

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (!response.ok) {
      afficherMessage(data.message || 'Erreur de connexion.')
      return
    }

    loginForm.reset()
    afficherMessage('')
    await verifierSession()
  } catch (error) {
    afficherMessage('Erreur de connexion au serveur.')
  }
})

// Inscription
registerForm.addEventListener('submit', async event => {
  event.preventDefault()

  const name = document.getElementById('register-name').value
  const email = document.getElementById('register-email').value
  const password = document.getElementById('register-password').value
  const confirmPassword = document.getElementById(
    'register-password-confirm'
  ).value

  // Vérifier que les deux mots de passe sont identiques
  if (password !== confirmPassword) {
    afficherMessage('Les deux mots de passe ne correspondent pas.')
    return
  }

  try {
    const token = await obtenirJetonCsrf()

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      body: JSON.stringify({ name, email, password })
    })

    const data = await response.json()

    if (!response.ok) {
      afficherMessage(data.message || 'Erreur lors de la création du compte.')
      return
    }

    registerForm.reset()
    afficherMessage('')
    await verifierSession()
  } catch (error) {
    afficherMessage('Erreur de connexion au serveur.')
  }
})

// Déconnexion
logoutButton.addEventListener('click', async () => {
  try {
    const token = await obtenirJetonCsrf()

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'x-csrf-token': token
      }
    })

    if (response.ok) {
      taskApp.hidden = true
      authSection.hidden = false
      loginSection.hidden = false
      registerSection.hidden = true
      currentUser.textContent = ''
      afficherMessage('Vous êtes déconnecté.')
    }
  } catch (error) {
    afficherMessage('Erreur lors de la déconnexion.')
  }
})

// Vérifier la session au chargement
verifierSession()
// Afficher ou masquer les mots de passe
document.querySelectorAll('.toggle-password').forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.target
    const passwordInput = document.getElementById(targetId)

    if (passwordInput.type === 'password') {
      passwordInput.type = 'text'
      button.textContent = 'Masquer'
    } else {
      passwordInput.type = 'password'
      button.textContent = 'Afficher'
    }
  })
})

// =========================
// GESTION DU PROFIL UTILISATEUR
// =========================

const profileButton = document.getElementById('profile-button')
const profileSection = document.getElementById('profile-section')
const profileBackButton = document.getElementById('profile-back-button')

const profileForm = document.getElementById('profile-form')
const profileName = document.getElementById('profile-name')
const profileEmail = document.getElementById('profile-email')
const profileMessage = document.getElementById('profile-message')

const passwordForm = document.getElementById('password-form')
const currentPassword = document.getElementById('current-password')
const newPassword = document.getElementById('new-password')
const confirmNewPassword = document.getElementById('confirm-new-password')
const passwordMessage = document.getElementById('password-message')

// Ouvrir le profil
profileButton.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/me')
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Impossible de charger le profil.')
    }

    profileName.value = data.user.name
    profileEmail.value = data.user.email

    profileMessage.textContent = ''
    passwordMessage.textContent = ''

    profileSection.hidden = false
    profileSection.scrollIntoView({ behavior: 'smooth' })
  } catch (error) {
    afficherMessage(error.message)
  }
})

// Retour aux tâches
profileBackButton.addEventListener('click', () => {
  profileSection.hidden = true
})

// Modifier le nom et l'adresse e-mail
profileForm.addEventListener('submit', async event => {
  event.preventDefault()

  const name = profileName.value.trim()
  const email = profileEmail.value.trim()

  try {
    const token = await obtenirJetonCsrf()

    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      body: JSON.stringify({ name, email })
    })

    const data = await response.json()

    if (!response.ok) {
      profileMessage.textContent =
        data.message || 'Erreur lors de la modification du profil.'
      return
    }

    currentUser.textContent = data.user.name
    profileName.value = data.user.name
    profileEmail.value = data.user.email

    profileMessage.textContent = 'Votre profil a été mis à jour.'
  } catch (error) {
    profileMessage.textContent = 'Erreur de connexion au serveur.'
  }
})

// Modifier le mot de passe
passwordForm.addEventListener('submit', async event => {
  event.preventDefault()

  if (newPassword.value !== confirmNewPassword.value) {
    passwordMessage.textContent =
      'Les deux nouveaux mots de passe ne correspondent pas.'
    return
  }

  try {
    const token = await obtenirJetonCsrf()

    const response = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      passwordMessage.textContent =
        data.message || 'Erreur lors du changement de mot de passe.'
      return
    }

    passwordForm.reset()
    passwordMessage.textContent =
      'Votre mot de passe a été modifié avec succès.'
  } catch (error) {
    passwordMessage.textContent = 'Erreur de connexion au serveur.'
  }
})
