import { Fields } from '../../forms/recruitment-forms.js'
import { ForumError, createQueryRunner } from './errors.js'

// Section du forum et préfixe des fiches de recrutement
export const RECRUITMENT_NODE_ID = 35
export const RECRUITMENT_PREFIX_ID = 15

const answerToSQLBool = (answer) => toSQLBool(String(answer ?? '').toLowerCase() === 'o')
const toSQLBool = (condition) => (condition ? 1 : 0)
const SQLBoolToAnswer = (bool) => (bool === 1 ? 'Oui' : 'Non')

const FORUM_INFO_QUERY = `SELECT u.user_id, u.username, p.dob_day, p.dob_month, p.dob_year
	FROM xf_user as u
	INNER JOIN xf_user_profile as p
	ON u.user_id = p.user_id
	WHERE discord_id = ?`

const FORUM_ID_QUERY = `SELECT user_id
	FROM xf_user
	WHERE discord_id = ?`

export const buildMessage = (
	{
		discord_username,
		platform_username,
		birthdate,
		can_be_present,
		can_pay,
		how_know_us,
		comment,
		platform,
		first_name,
		pseudo,
		commando_name,
		game_style,
		skills_dev,
		skills_design,
		skills_video,
	},
	{ game, date }
) =>
	`[HEADING=2][u]QUESTIONNAIRE POUR ${game.toUpperCase()}[/u][/HEADING]

    [b]Prénom[/b] : ${first_name}
    [b]Date d'anniversaire[/b] : ${birthdate}
    [b]Date de votre arrivée dans le CK[/b] : ${date.toLocaleDateString('fr')}
    [b]Plateforme principale[/b] : ${platform}
    [b]Votre pseudo de jeu avant de rejoindre le Commando Kieffer[/b] : ${pseudo}
    [b]Votre nouveau pseudo choisi dans la liste du Commando Kieffer[/b] : ${commando_name}
    [b]Style de jeu, armes favorites[/b] : ${game_style}

    [u][b]Différentes compétences[/b][/u]
    [b]Programmation[/b] : ${SQLBoolToAnswer(skills_dev)}
    [b]Design[/b] : ${SQLBoolToAnswer(skills_design)}
    [b]Montage vidéo[/b] : ${SQLBoolToAnswer(skills_video)}

    [u][b]Identifiants[/b][/u]
    [b]Discord[/b] : ${discord_username}
    [b]Plateforme principale[/b] : ${platform_username}

    [b]Pouvez vous être présent le vendredi soir de 20h45 à 23h ?[/b] : ${SQLBoolToAnswer(can_be_present)}
    [b]Pouvez vous payer la cotisation annuelle de 10€ ?[/b] : ${SQLBoolToAnswer(can_pay)}
    [b]Comment avez vous connu le Commando Kieffer ?[/b] : ${how_know_us}
    [b]Avez vous un commentaire à formuler ?[/b] : ${comment}
`

export function createRecruitmentRepository({ db, xenforo, logger, game, now = () => new Date() }) {
	const run = createQueryRunner(db, logger)

	const part1 = async (requesterId, data) => {
		const context = { discordId: requesterId }
		const notLinked = "Une erreur est survenue. Peut-être que votre compte Discord n'est pas lié au forum. CODE R40"

		const result = await run(FORUM_INFO_QUERY, [requesterId], {
			onConnectionError: 'Erreur de connexion à la base de données. CODE R33',
			onError: notLinked,
			context,
		})
		const userInfo = result[0]
		if (!userInfo) throw new ForumError(notLinked)

		// Un deuxième envoi créerait une seconde fiche en cours, que les questionnaires suivants mettraient à jour en même temps.
		// Une fiche terminée (ancien membre qui revient) n'empêche pas d'en commencer une nouvelle.
		const existing = await run(
			'SELECT id FROM infos_recrutement WHERE user_id = ? AND form3_complete = 0 LIMIT 1',
			[userInfo.user_id],
			{
				onConnectionError: 'Erreur de connexion à la base de données. CODE R33',
				onError: 'Une erreur est survenue. CODE R74',
				context,
			}
		)
		if (existing.length) {
			throw new ForumError(`<@${requesterId}>, vous avez déjà rempli le formulaire 1/3. Passez au formulaire 2/3.`)
		}

		const inserted = await run(
			`INSERT INTO infos_recrutement
				(
					form1_complete,
					user_id,
					discord_username,
					pseudo,
					commando_name,
					birthdate,
					game_style,
					platform,
					platform_username,
					first_name
				)
			VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				userInfo.user_id,
				data[Fields.DISCORD_USERNAME],
				userInfo.username,
				data[Fields.COMMANDO_NAME],
				`${userInfo.dob_day}/${userInfo.dob_month}/${userInfo.dob_year}`,
				data[Fields.GAME_STYLE],
				data[Fields.MAIN_PLATFORM],
				data[Fields.PLATFORM_USERNAME],
				data[Fields.FIRSTNAME],
			],
			{
				onConnectionError: 'Erreur de connexion à la base de données. CODE R33',
				onError: 'Une erreur est survenue. CODE R74',
				context,
			}
		)

		if (!inserted || inserted.affectedRows === 0) {
			throw new ForumError('Une erreur est survenue. CODE R79')
		}

		return `<@${requesterId}>, formulaire 1/3 complété.`
	}

	const part2 = async (requesterId, data) => {
		const result = await run(
			`UPDATE infos_recrutement
			SET
				form2_complete = 1,
				can_be_present = ?,
				can_pay = ?,
				how_know_us = ?,
				comment = ?
			WHERE
				user_id = (${FORUM_ID_QUERY}) AND
				form1_complete = 1 AND
				form2_complete = 0 AND
				form3_complete = 0`,
			[
				answerToSQLBool(data[Fields.CAN_BE_PRESENT]),
				answerToSQLBool(data[Fields.CAN_PAY]),
				data[Fields.HOW_KNOW_US],
				data[Fields.COMMENT],
				requesterId,
			],
			{
				onConnectionError: 'Erreur de connexion à la base de données',
				onError: 'Une erreur est survenue. CODE R120',
				context: { discordId: requesterId },
			}
		)

		if (!result || result.affectedRows === 0 || result.changedRows === 0) {
			throw new ForumError(
				"L'opération ne peut pas être complétée. Le formulaire a certainement déjà été rempli. CODE R126"
			)
		}

		return `<@${requesterId}>, formulaire 2/3 complété.`
	}

	const part3 = async (requesterId, data) => {
		const context = { discordId: requesterId }

		const result = await run(
			`UPDATE infos_recrutement
			SET
				form3_complete = 1,
				skills_dev = ?,
				skills_design = ?,
				skills_video = ?
			WHERE
				user_id = (${FORUM_ID_QUERY}) AND
				form1_complete = 1 AND
				form2_complete = 1 AND
				form3_complete = 0`,
			[
				answerToSQLBool(data[Fields.SKILLS_DEV]),
				answerToSQLBool(data[Fields.SKILLS_DESIGN]),
				answerToSQLBool(data[Fields.SKILLS_VIDEO]),
				requesterId,
			],
			{
				onConnectionError: 'Erreur de connexion à la base de données',
				onError: 'Une erreur est survenue. CODE R170',
				context,
			}
		)

		if (!result || result.affectedRows === 0 || result.changedRows === 0) {
			throw new ForumError(
				"L'opération ne peut pas être complétée. Le formulaire a certainement déjà été rempli. CODE R176"
			)
		}

		let posted
		try {
			posted = await postRecruitmentForm(requesterId)
		} catch (err) {
			await reopenForm3(requesterId)
			throw err
		}

		const { recordId, thread } = posted
		const { thread_id, view_url } = thread
		const message = `<@${requesterId}>, formulaire 3/3 complété.\nVotre fiche a été postée.\nVous pouvez la consulter à cette adresse : ${view_url}`

		const saved = await run('UPDATE infos_recrutement SET post_id = ? WHERE id = ?', [thread_id, recordId], {
			onConnectionError: 'Erreur de connexion à la base de données',
			onError: 'Une erreur est survenue. CODE R195',
			context: { ...context, threadId: thread_id },
		})

		if (!saved || saved.affectedRows === 0 || saved.changedRows === 0) {
			logger.error('Fiche postée mais post_id non enregistré', { ...context, threadId: thread_id })
			throw new ForumError('Une erreur est survenue. CODE R204')
		}

		return message
	}

	// Si la fiche n'a pas pu être postée, la recrue doit pouvoir renvoyer le formulaire 3/3
	const reopenForm3 = async (requesterId) => {
		try {
			await db.query(
				`UPDATE infos_recrutement SET form3_complete = 0 WHERE user_id = (${FORUM_ID_QUERY}) AND post_id IS NULL`,
				[requesterId]
			)
		} catch (err) {
			logger.error('Impossible de rouvrir le formulaire 3/3', { discordId: requesterId, error: err })
		}
	}

	const postRecruitmentForm = async (discordId) => {
		const result = await run(
			`SELECT u.user_id as userId, r.*
			FROM xf_user AS u
			INNER JOIN infos_recrutement AS r ON u.user_id = r.user_id
			WHERE discord_id = ? AND r.form1_complete = 1 AND r.form2_complete = 1 AND r.form3_complete = 1
			ORDER BY r.id DESC
			LIMIT 1`,
			[discordId],
			{
				onConnectionError: 'Erreur de connexion à la base de données',
				onError: "La fiche n'a pas pu être postée. CODE R262",
				context: { discordId },
			}
		)

		const data = result[0]
		if (!data) throw new ForumError("La fiche n'a pas pu être postée. CODE R262")

		try {
			// Postée au nom de la recrue, pour qu'elle apparaisse comme l'auteur de sa fiche
			const thread = await xenforo.createThread({
				asUser: data.userId,
				node_id: RECRUITMENT_NODE_ID,
				prefix_id: RECRUITMENT_PREFIX_ID,
				discussion_type: 'discussion',
				sticky: false,
				discussion_open: true,
				title: `[${data.commando_name.toUpperCase()} - EN FORMATION]`,
				message: buildMessage(data, { game, date: now() }),
			})
			return { recordId: data.id, thread }
		} catch (err) {
			logger.error('Fiche de recrutement refusée par le forum', { discordId, forumUserId: data.userId, error: err })
			throw new ForumError("La fiche n'a pas pu être postée. CODE R307", { cause: err })
		}
	}

	return { part1, part2, part3 }
}
