import { verifyKey } from 'discord-interactions'

// Garde le corps brut de la requête : la signature Discord porte sur les octets reçus, pas sur le JSON parsé
export const keepRawBody = (req, res, buf) => {
	req.rawBody = buf
}

export function verifyDiscordRequest(publicKey, { verify = verifyKey, logger } = {}) {
	return async function (req, res, next) {
		const signature = req.get('X-Signature-Ed25519')
		const timestamp = req.get('X-Signature-Timestamp')

		// Signature ed25519 en hexadécimal (64 octets) et horodatage en secondes
		const wellFormed = /^[0-9a-f]{128}$/i.test(signature ?? '') && /^\d{1,13}$/.test(timestamp ?? '')

		let isValidRequest = false
		if (wellFormed && req.rawBody?.length) {
			try {
				// `await` : verifyKey est synchrone en v3 de discord-interactions mais renvoie une promesse en v4
				isValidRequest = (await verify(req.rawBody, signature, timestamp, publicKey)) === true
			} catch (err) {
				logger?.warn('Vérification de signature impossible', { error: err })
			}
		}

		if (!isValidRequest) {
			logger?.warn('Requête refusée : signature Discord invalide', { ip: req.ip, path: req.path })
			return res.status(401).send('Bad request signature')
		}

		next()
	}
}
