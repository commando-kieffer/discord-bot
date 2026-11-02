import { ForumError, createQueryRunner } from './errors.js'

export function createUsersRepository({ db, logger }) {
	const run = createQueryRunner(db, logger)

	const setRoles = async (discordId, nom, main, secondary) => {
		const result = await run(
			`UPDATE xf_user
			SET
				username = ?,
				user_group_id = ?,
				secondary_group_ids = ?
			WHERE
				discord_id = ?`,
			[nom, main, secondary.filter(Boolean).join(','), discordId],
			{
				onConnectionError: 'Erreur de connexion à la base de données. CODE U14',
				onError: 'Une erreur est survenue. CODE U29',
				context: { discordId },
			}
		)

		if (!result || result.affectedRows === 0) {
			throw new ForumError("Aucun compte forum n'est lié à ce compte Discord. CODE U32")
		}

		return 'Les permissions de base ont été correctement attribuées.'
	}

	const last = async () => {
		const result = await run('SELECT user_id, username FROM xf_user ORDER BY user_id DESC LIMIT 5', [], {
			onConnectionError: 'Erreur de connexion à la base de données. CODE U52',
			onError: 'Une erreur est survenue. CODE U60',
		})

		if (!result[0]) throw new ForumError('Une erreur est survenue. CODE U60')

		return result
	}

	const info = async (discordId) => {
		const result = await run(
			`SELECT
				user_id,
				discord_id,
				username,
				panel_pts,
				panel_prs,
				panel_abs,
				register_date * 1000 as register_date,
				COUNT(id_medal) as medals_count
			FROM xf_user
			LEFT JOIN medal_attribut
			ON id_user = user_id
			WHERE discord_id = ?
			GROUP BY user_id`,
			[discordId],
			{
				onConnectionError: 'Erreur de connexion à la base de données. CODE U83',
				onError: 'Une erreur est survenue. CODE U103',
				context: { discordId },
			}
		)

		return result[0] ?? null
	}

	const getUsername = async (discordId) => {
		const result = await run(
			`SELECT i.platform_username FROM infos_recrutement AS i
			INNER JOIN xf_user as u
			ON u.user_id = i.user_id
			WHERE u.discord_id = ?
			ORDER BY i.id DESC
			LIMIT 1`,
			[discordId],
			{
				onConnectionError: 'Erreur de connexion à la base de données. CODE U130',
				onError: 'Une erreur est survenue. CODE U150',
				context: { discordId },
			}
		)

		return result[0] ?? null
	}

	return { last, info, setRoles, getUsername }
}
