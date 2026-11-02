import {
	GRADE,
	NICK_MAX_LENGTH,
	buildNick,
	getBordeeAlias,
	getInitialRoles,
	getTroopDiscordRole,
	isBordee,
	isTroop,
	isValidCommandoName,
} from '../ranks.js'
import { isProtected } from '../security/protected-members.js'
import { toUserMessage } from '../services/forum/errors.js'

export function createRecruitmentFeature({ discord, forum, config, logger }) {
	const { roles, forumGroups } = config

	// Nom, troop et bordée saisis par un instructeur : renvoie un message d'erreur, ou null si tout est bon
	const checkRankInput = (nom, troop, bordee, grade) => {
		if (!isTroop(troop) || !isBordee(bordee)) return 'Troop ou bordée inconnue.'
		if (!isValidCommandoName(nom)) {
			return `« ${String(nom ?? '').slice(0, 32)} » n'est pas un nom de commando valide (lettres, espaces, apostrophes et tirets, 20 caractères au plus).`
		}
		if (buildNick(grade, nom, troop).length > NICK_MAX_LENGTH) {
			return `Le pseudo « ${buildNick(grade, nom, troop)} » dépasse les ${NICK_MAX_LENGTH} caractères autorisés par Discord.`
		}
		return null
	}

	const assignInitialRoles = async (requesterId, [commando, nom, troop, bordee]) => {
		if (isProtected(commando)) {
			return {
				status: 200,
				message: `**Action prohibée** : <@${requesterId}> a tenté de recruter <@${commando}>`,
			}
		}

		nom = String(nom ?? '').trim()
		const invalid = checkRankInput(nom, troop, bordee, GRADE.CADET)
		if (invalid) return { status: 200, message: invalid }

		const nick = buildNick(GRADE.CADET, nom, troop)
		const [discordRoles, forumRoles] = getInitialRoles(troop, bordee, { roles, forumGroups })

		let pseudoReq
		try {
			pseudoReq = await forum.users.getUsername(commando)
		} catch (err) {
			return { status: 200, message: toUserMessage(err) }
		}
		if (!pseudoReq) {
			return {
				status: 200,
				message: `Impossible de trouver la fiche de recrutement de <@${commando}>. Le questionnaire 1/3 a-t-il bien été rempli ?`,
			}
		}
		const pseudo = pseudoReq.platform_username

		try {
			await discord.updateMember(commando, { nick, roles: discordRoles })
		} catch (err) {
			logger.error('Rôles de cadet non attribués', { requesterId, commando, error: err })
			return { status: 200, message: `Le pseudo et les rôles de <@${commando}> n'ont pas pu être modifiés sur Discord.` }
		}

		logger.info('Cadet recruté', { requesterId, commando, nick, troop, bordee })

		const warnings = []
		const troopRole = getTroopDiscordRole(troop, roles)

		try {
			await discord.sendMessage(config.discord.homeChannel, {
				content: `<@${commando}>\n\nNous souhaitons la bienvenue au cadet **${nom}** qui rejoint la bordée ${getBordeeAlias(
					bordee
				)} de la <@&${troopRole}>.\n\nSelon sa fiche de recrutement, son pseudo en jeu est : "**${pseudo}**".`,
				// Le pseudo vient du questionnaire : seuls le cadet et sa troop peuvent être notifiés
				allowed_mentions: { users: [commando], roles: troopRole ? [troopRole] : [] },
			})
		} catch (err) {
			logger.error('Message de bienvenue non envoyé', { commando, error: err })
			warnings.push("Le message de bienvenue n'a pas pu être envoyé.")
		}

		try {
			await forum.users.setRoles(commando, nom, forumGroups.cadet, forumRoles)
		} catch (err) {
			warnings.push(`Le forum n'a pas été mis à jour : ${toUserMessage(err)}`)
		}

		return {
			status: 200,
			message: [`Le commando <@${commando}> est assigné à la ${troop}-${bordee}`, ...warnings].join('\n'),
		}
	}

	const fromForum = (promise) =>
		promise.then(
			(message) => ({ status: 200, message }),
			(err) => ({ status: 200, message: toUserMessage(err) })
		)

	const recruitmentForm1 = async (requesterId, data) => fromForum(forum.recruitment.part1(requesterId, data))
	const recruitmentForm2 = async (requesterId, data) => fromForum(forum.recruitment.part2(requesterId, data))
	const recruitmentForm3 = async (requesterId, data) => fromForum(forum.recruitment.part3(requesterId, data))

	return { assignInitialRoles, recruitmentForm1, recruitmentForm2, recruitmentForm3 }
}
