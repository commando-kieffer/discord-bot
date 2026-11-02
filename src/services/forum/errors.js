import { isConnectionError } from '../../clients/database.js'

// Erreur dont le message peut être montré tel quel sur Discord (il contient le code à donner à l'EM)
export class ForumError extends Error {
	constructor(message, options) {
		super(message, options)
		this.name = 'ForumError'
	}
}

export const GENERIC_ERROR_MESSAGE =
	'Une erreur est survenue. Réessayez plus tard et prévenez un membre de l\'EM si le problème persiste.'

export const toUserMessage = (err) => (err instanceof ForumError ? err.message : GENERIC_ERROR_MESSAGE)

// Exécute une requête et transforme une erreur SQL en ForumError, après l'avoir loguée avec son contexte
export const createQueryRunner = (db, logger) =>
	async function run(sql, params, { onConnectionError, onError, context = {} }) {
		try {
			return await db.query(sql, params)
		} catch (err) {
			const connection = isConnectionError(err)
			logger.error(connection ? 'Base de données injoignable' : 'Requête SQL en échec', { ...context, error: err })
			throw new ForumError(connection ? onConnectionError : onError, { cause: err })
		}
	}
