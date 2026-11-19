
const resetPasswordForm = document.getElementById('reset-password-form')
const resetMessage = document.getElementById('reset-message')

const params = new URLSearchParams(window.location.search)
const token = params.get('token')

// Vérifier la présence et le format du jeton
if (!token || !/^[a-f0-9]{64}$/.test(token)) {
  resetMessage.textContent = 'Lien invalide ou incomplet.'
  resetPasswordForm.hidden = true
}

// Récupérer le jeton CSRF
async function obtenirJetonCsrf () {
  const response = await fetch('/api/csrf-token')

  if (!response.ok) {
    throw new Error('Impossible de récupérer le jeton CSRF.')
  }

  const data = await response.json()
  return data.csrfToken
}

// Afficher ou masquer les mots de passe
document.querySelectorAll('.toggle-password').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target)

    input.type = input.type === 'password' ? 'text' : 'password'
    button.textContent = input.type === 'password' ? 'Afficher' : 'Masquer'
  })
})

// Envoyer le nouveau mot de passe
resetPasswordForm.addEventListener('submit', async event => {
  event.preventDefault()

  const newPassword = document.getElementById('new-password').value
  const confirmPassword = document.getElementById('confirm-password').value

  if (newPassword.length < 8 || newPassword.length > 72) {
    resetMessage.textContent =
      'Le mot de passe doit contenir entre 8 et 72 caractères.'
    return
  }

  if (newPassword !== confirmPassword) {
    resetMessage.textContent =
      'Les deux mots de passe ne correspondent pas.'
    return
  }

  try {
    const csrfToken = await obtenirJetonCsrf()

    const response = await fetch(
      `/api/auth/reset-password/${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ newPassword })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      resetMessage.textContent =
        data.message || 'Erreur lors de la réinitialisation.'
      return
    }

    resetMessage.textContent = data.message
    resetPasswordForm.reset()
    resetPasswordForm.hidden = true
  } catch (error) {
    resetMessage.textContent = 'Erreur de connexion au serveur.'
  }
})
