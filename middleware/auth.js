
function verifierAuthentification(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      message: 'Vous devez être connecté pour accéder à cette ressource.'
    })
  }

  next()
}

module.exports = verifierAuthentification
