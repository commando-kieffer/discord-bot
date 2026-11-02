import { buildCadetForm, buildEnrolForm } from '../forms/rank-form.js'
import {
	GRADE,
	NICK_MAX_LENGTH,
	buildNick,
	findRankDefaults,
	getBordeeAlias,
	getInitialRoles,
	getRecruitRoles,
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

	// Nom affiché dans le titre du formulaire, pour vérifier qu'on a cliqué sur la bonne personne
	const displayName = (member) => member?.nick || member?.user?.global_name || member?.user?.username

	const openForm = (requesterId, userId, member, build, verb) => {
		if (isProtected(userId)) {
			return { status: 200, message: `**Action prohibée** : <@${requesterId}> a tenté ${verb} <@${userId}>` }
		}
		return { form: build(userId, { displayName: displayName(member), ...findRankDefaults(member, roles) }) }
	}

	// `member` vient des données de l'interaction (rôles et pseudo du membre ciblé) : pas d'appel à Discord
	const openEnrolForm = (requesterId, userId, member) =>
		openForm(requesterId, userId, member, buildEnrolForm, "d'enrôler")

	const openCadetForm = (requesterId, userId, member) =>
		openForm(requesterId, userId, member, buildCadetForm, 'de recruter')

	// Enrôler : la recrue a les rôles Discord d'un cadet (avec le grade de recrue), mais pas encore de compte forum
	const enrolRecruit = async (requesterId, [commando, nom, troop, bordee]) => {
		if (isProtected(commando)) {
			return {
				status: 200,
				message: `**Action prohibée** : <@${requesterId}> a tenté d'enrôler <@${commando}>`,
			}
		}

		nom = String(nom ?? '').trim()
		const invalid = checkRankInput(nom, troop, bordee, GRADE.RECRUE)
		if (invalid) return { status: 200, message: invalid }

		const nick = buildNick(GRADE.RECRUE, nom, troop)

		try {
			await discord.updateMember(commando, { nick, roles: getRecruitRoles(troop, bordee, roles) })
		} catch (err) {
			logger.error('Recrue non enrôlée', { requesterId, commando, error: err })
			return { status: 200, message: `Le pseudo et les rôles de <@${commando}> n'ont pas pu être modifiés sur Discord.` }
		}

		logger.info('Recrue enrôlée', { requesterId, commando, nick, troop, bordee })

		return { status: 200, message: `La recrue <@${commando}> est assignée à la ${troop}-${bordee}` }
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

		// Un cadet a un compte forum : sans lien, on s'arrête avant de toucher à quoi que ce soit
		let pseudoReq
		try {
			if (!(await forum.users.findLinkedAccount(commando))) {
				return {
					status: 200,
					message: `<@${commando}> n'est pas lié au forum. Passez d'abord par « Lier au forum ».`,
				}
			}
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

	return {
		openEnrolForm,
		openCadetForm,
		enrolRecruit,
		assignInitialRoles,
		recruitmentForm1,
		recruitmentForm2,
		recruitmentForm3,
	}
}
