import { subDays, isBefore } from 'date-fns'
import { buildLinkForm } from '../forms/link-form.js'
import { buildFormerNick, extractCommandoName, getUnitRoles } from '../ranks.js'
import { isProtected } from '../security/protected-members.js'
import { isSnowflake, parseForumId } from '../security/validation.js'
import { toUserMessage } from '../services/forum/errors.js'

export function createMembersFeature({ discord, forum, config, logger, now = () => new Date() }) {
	const { roles, forumGroups } = config

	const linkCommando = async (requesterId, [commando, idForum]) => {
		const forumId = parseForumId(idForum)
		if (!isSnowflake(commando) || !forumId) {
			return { status: 200, message: `L'ID forum doit être un nombre (reçu : ${String(idForum ?? '').slice(0, 20)}).` }
		}

		try {
			await forum.link.link(commando, forumId)
			logger.info('Compte Discord lié au forum', { requesterId, commando, forumId })
			const message = `Le commando <@${commando}> est lié au compte forum avec id=${forumId}`
			return { status: 200, message }
		} catch (err) {
			const message = `Le commando <@${commando}> n'a pas pu être lié au compte forum avec id=${forumId}.\n${toUserMessage(err)}`
			return { status: 200, message }
		}
	}

	// Formulaire de « Lier au forum », avec les derniers inscrits du forum pour retrouver l'ID facilement
	const openLinkForm = async (userToLink) => {
		let lastUsers = []
		try {
			lastUsers = await forum.users.last()
		} catch {
			// L'erreur est déjà loguée : le formulaire s'ouvre quand même, sans la liste
		}
		return buildLinkForm(userToLink, lastUsers)
	}

	// « Lier au forum » : lie les comptes, puis donne le rôle de civil en recrutement (accès aux questionnaires)
	const linkAndStartRecruitment = async (requesterId, userId, idForum) => {
		if (isProtected(userId)) {
			return {
				status: 200,
				message: `**Action prohibée** : <@${requesterId}> a tenté de lancer le recrutement de <@${userId}>`,
			}
		}

		const forumId = parseForumId(idForum)
		if (!forumId) {
			return { status: 200, message: `L'ID forum doit être un nombre (reçu : ${String(idForum ?? '').slice(0, 20)}).` }
		}

		let created
		try {
			created = await forum.link.link(userId, forumId)
		} catch (err) {
			const message = `Le commando <@${userId}> n'a pas pu être lié au compte forum avec id=${forumId}.\n${toUserMessage(err)}`
			return { status: 200, message }
		}

		if (created) logger.info('Compte Discord lié au forum', { requesterId, userId, forumId })

		const lines = [
			created
				? `Le commando <@${userId}> est lié au compte forum avec id=${forumId}`
				: `Le commando <@${userId}> était déjà lié au compte forum avec id=${forumId}`,
		]
		const done = () => ({ status: 200, message: lines.join('\n') })

		let member
		try {
			member = await discord.getMember(userId)
		} catch (err) {
			logger.error('Membre introuvable pour le recrutement', { requesterId, userId, error: err })
			lines.push(`Impossible de vérifier ses rôles Discord : le recrutement n'a pas été lancé.`)
			return done()
		}

		// Les rôles sont remplacés : on ne le fait pas pour quelqu'un qui fait déjà partie du CK
		const unitRoles = getUnitRoles(roles)
		if ((member.roles ?? []).some((role) => unitRoles.includes(role))) {
			lines.push(`Ses rôles n'ont pas été changés : <@${userId}> fait déjà partie du CK.`)
			return done()
		}

		try {
			await discord.updateMember(userId, { roles: [roles.recruiting] })
			logger.info('Recrutement lancé', { requesterId, userId })
			lines.push(`Démarrage du recrutement de <@${userId}>`)
		} catch (err) {
			logger.error('Recrutement non lancé', { requesterId, userId, error: err })
			lines.push(`Le recrutement de <@${userId}> n'a pas pu être lancé.`)
		}

		return done()
	}

	const fireCommando = async (requesterId, commando) => {
		if (isProtected(commando)) {
			return {
				status: 200,
				message: `**Action prohibée** : <@${requesterId}> a tenté de radier <@${commando}>`,
			}
		}
		const message = `Le commando <@${commando}> a été radié`
		// return Promise.resolve({status: 200, message})

		let user
		try {
			user = await discord.getMember(commando)
		} catch (err) {
			logger.error('Membre introuvable pour la radiation', { requesterId, commando, error: err })
			return { status: 200, message: `Impossible de récupérer le profil Discord de <@${commando}>.` }
		}

		const name = extractCommandoName(user.nick)
		if (!name) {
			return {
				status: 200,
				message: `Impossible de retrouver le nom de commando dans le pseudo de <@${commando}> (${user.nick ?? 'aucun pseudo'}). Rien n'a été modifié.`,
			}
		}

		const nick = buildFormerNick(name, user.joined_at)

		try {
			await discord.updateMember(commando, { nick, roles: [roles.ancienCommando] })
		} catch (err) {
			logger.error('Radiation impossible sur Discord', { requesterId, commando, error: err })
			return { status: 200, message: `<@${commando}> n'a pas pu être radié sur Discord. Rien n'a été modifié.` }
		}

		logger.info('Commando radié', { requesterId, commando, nick })

		try {
			await forum.users.setRoles(commando, nick, forumGroups.civil, [])
		} catch (err) {
			return { status: 200, message: `${message} sur Discord, mais pas sur le forum.\n${toUserMessage(err)}` }
		}

		return { status: 200, message }
	}

	const displayUnseenCivilians = async () => {
		let result = ''
		let counter = 25 // sinon le message devient trop gros et on ne peut pas écrire la réponse

		let civilians
		try {
			civilians = await discord.listMembers(1000)
		} catch (err) {
			logger.error('Liste des membres indisponible', { error: err })
			return { status: 200, message: 'Impossible de récupérer la liste des membres du serveur.' }
		}

		const limitDate = subDays(now(), 2)

		civilians.forEach((civilian) => {
			// mmmmh
			if (counter > 0 && civilian.roles.includes(roles.civilEnAttente)) {
				const joinedAt = new Date(civilian.joined_at)
				if (isBefore(joinedAt, limitDate)) {
					counter--
					result += `\n<@${civilian.user.id}> - a rejoint le Discord le **${joinedAt.toLocaleDateString(
						'fr'
					)}** à ${joinedAt.toLocaleTimeString('fr')}`
				}
			}
		})

		return {
			status: 200,
			message: result.length
				? `***Liste des civils non vus (limite : 25)***\n${result}`
				: 'Aucun civil en attente depuis plus de 2 jours.',
		}
	}

	return { linkCommando, openLinkForm, linkAndStartRecruitment, fireCommando, displayUnseenCivilians }
}
