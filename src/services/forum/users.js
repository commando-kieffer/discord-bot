import { XenforoApiError } from '../../clients/xenforo.js'
import { ForumError, createQueryRunner } from './errors.js'

export function createUsersRepository({ db, xenforo, logger }) {
	const run = createQueryRunner(db, logger)

	// Comptes forum liés à un compte Discord (normalement un seul). discord_id n'existe pas dans l'API
	// de XenForo : la recherche se fait en base.
	const findLinkedAccounts = (discordId) =>
		run('SELECT user_id, username FROM xf_user WHERE discord_id = ? LIMIT 2', [discordId], {
			onConnectionError: 'Erreur de connexion à la base de données. CODE U14',
			onError: 'Une erreur est survenue. CODE U29',
			context: { discordId },
		})

	// Compte forum lié à un compte Discord, ou null
	const findLinkedAccount = async (discordId) => (await findLinkedAccounts(discordId))[0] ?? null

	// Pseudo, groupe principal et groupes secondaires : modifiés via l'API du forum pour que XenForo
	// recalcule lui-même les permissions (une mise à jour directe de xf_user ne le fait pas)
	const setRoles = async (discordId, nom, main, secondary) => {
		const accounts = await findLinkedAccounts(discordId)

		if (accounts.length === 0) {
			throw new ForumError("Aucun compte forum n'est lié à ce compte Discord. CODE U32")
		}
		if (accounts.length > 1) {
			logger.error('Plusieurs comptes forum liés au même compte Discord', { discordId })
			throw new ForumError('Plusieurs comptes forum sont liés à ce compte Discord. CODE U35')
		}

		const forumUserId = accounts[0].user_id

		try {
			await xenforo.updateUser(forumUserId, {
				username: nom,
				user_group_id: main,
				secondary_group_ids: secondary.filter(Boolean),
			})
		} catch (err) {
			logger.error('Mise à jour du compte forum impossible', { discordId, forumUserId, error: err })
			const reasons = err instanceof XenforoApiError ? err.forumMessages : []
			throw new ForumError(
				`La mise à jour du compte forum a échoué${reasons.length ? ` (${reasons.join(' ')})` : ''}. CODE U41`,
				{ cause: err }
			)
		}

		logger.info('Compte forum mis à jour', { discordId, forumUserId, username: nom, userGroupId: main })

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

	return { last, info, setRoles, getUsername, findLinkedAccount }
}
