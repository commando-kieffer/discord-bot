import { ForumError, createQueryRunner } from './errors.js'

// discord_id est une colonne ajoutée à la main dans xf_user : l'API de XenForo ne la connaît pas,
// on passe donc par la base pour la lire et l'écrire.
export function createLinkRepository({ db, logger }) {
	const run = createQueryRunner(db, logger)

	const queryOptions = (code, context) => ({
		onConnectionError: 'Connexion à la base de données impossible. CODE L15',
		onError: `Une erreur est survenue. CODE ${code}`,
		context,
	})

	// Renvoie true si le lien vient d'être créé, false s'il existait déjà
	const link = async (discordId, forumId) => {
		const context = { discordId, forumId }

		const accounts = await run(
			'SELECT user_id, discord_id FROM xf_user WHERE user_id = ? OR discord_id = ?',
			[forumId, discordId],
			queryOptions('L24', context)
		)

		const target = accounts.find((account) => Number(account.user_id) === Number(forumId))
		if (!target) {
			throw new ForumError(`Aucun compte forum ne porte l'ID ${forumId}. CODE L29`)
		}

		if (target.discord_id === discordId) return false

		if (target.discord_id) {
			logger.warn('Compte forum déjà lié à un autre compte Discord', { ...context, linkedTo: target.discord_id })
			throw new ForumError(`Le compte forum ${forumId} est déjà lié à un autre compte Discord. CODE L31`)
		}

		const other = accounts.find((account) => account.discord_id === discordId)
		if (other) {
			throw new ForumError(`Ce compte Discord est déjà lié au compte forum ${other.user_id}. CODE L33`)
		}

		const result = await run(
			'UPDATE xf_user SET discord_id = ? WHERE user_id = ? AND discord_id IS NULL',
			[discordId, forumId],
			queryOptions('L24', context)
		)

		if (result.changedRows === 0) {
			throw new ForumError('Une erreur est survenue. CODE L29')
		}

		return true
	}

	return { link }
}
