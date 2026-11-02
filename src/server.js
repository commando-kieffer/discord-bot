import { fileURLToPath } from 'node:url'
import express from 'express'
import { keepRawBody, verifyDiscordRequest } from './security/signature.js'

// Chemin absolu : le dossier est trouvé même si le bot n'est pas lancé depuis la racine du projet
export const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url))

export function createServer({ publicKey, handleInteraction, logger, verify, publicDir = PUBLIC_DIR }) {
	const app = express()
	app.disable('x-powered-by')

	app.use(express.json({ limit: '100kb', verify: keepRawBody }))

	app.get('/redirect', async function (req, res) {
		logger.info('GET /redirect', { query: Object.keys(req.query) })
		res.status(200).send({})
	})

	app.use('/public', express.static(publicDir))

	/**
	 * Interactions endpoint URL where Discord will send HTTP requests
	 */
	app.post('/interactions', verifyDiscordRequest(publicKey, { verify, logger }), async function (req, res) {
		try {
			const { status, body } = await handleInteraction(req.body)
			res.status(status).send(body)
		} catch (err) {
			logger.error('Interaction non traitée', { error: err })
			res.status(500).send({ error: 'internal error' })
		}
	})

	// JSON invalide ou trop gros : on répond proprement au lieu de laisser Express renvoyer sa page d'erreur
	app.use((err, req, res, next) => {
		if (res.headersSent) return next(err)
		const status = err.status ?? err.statusCode ?? 500
		if (status >= 500) logger.error('Erreur serveur', { path: req.path, error: err })
		else logger.warn('Requête invalide', { path: req.path, status, reason: err.type ?? err.message })
		res.status(status).send({ error: status >= 500 ? 'internal error' : 'bad request' })
	})

	return app
}
