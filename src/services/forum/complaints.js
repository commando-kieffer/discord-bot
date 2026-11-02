import { ForumError, createQueryRunner } from './errors.js'

export function createComplaintsRepository({ db, logger }) {
	const run = createQueryRunner(db, logger)

	const send = async (discordId, message) => {
		const result = await run(
			'INSERT INTO complaint (signature, content) VALUES (TO_BASE64(?), ?)',
			[discordId, message],
			{
				onConnectionError: 'Connexion à la base de données impossible. CODE C15',
				onError: 'Une erreur est survenue. CODE C24',
				context: { discordId },
			}
		)

		if (result.affectedRows === 0) {
			logger.error('Plainte non enregistrée', { discordId })
			throw new ForumError('Une erreur est survenue. CODE C29')
		}
	}

	return { send }
}
