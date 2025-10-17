import { subDays, isBefore, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale/index.js'

import {
	ASSIGN_INITIAL_ROLES_COMMAND,
	FIRE_COMMAND,
	HELP_COMMAND,
	INFOS_SPE_COMMAND,
	INFOS_SITES_COMMAND,
	LINK_COMMAND,
	LINK_MODAL_COMMAND,
	RECRUITMENT_FORM_1_COMMAND,
	RECRUITMENT_FORM_2_COMMAND,
	RECRUITMENT_FORM_3_COMMAND,
	TEST_COMMAND,
	INFOS_GENERALES_COMMAND,
	CIVILS_NON_VUS_COMMAND,
	TROOP,
	BORDEE,
	START_RECRUITMENT_COMMAND,
	PROFILE_COMMAND,
	GET_USERNAME_COMMAND,
  COIN_FLIP_COMMAND
} from './commands/index.js'
import { forumService } from './services/forum/index.js'
import { DiscordRequest } from './utils.js'

const token = process.env.CK_TOKEN

// ohliger, bolloré, vinat
const protectedIds = [
	'224193244555116545',
	'293826953088073728',
	'421998930947997706',
]

export const linkCommando = async (requesterId, [commando, idForum]) => {
	return forumService.link
		.link(commando, idForum)
		.then(() => {
			const message = `Le commando <@${commando}> est lié au compte forum avec id=${idForum}`
			return Promise.resolve({ status: 200, message })
		})
		.catch(() => {
			const message = `Le commando <@${commando}> n'a pas pu être lié au compte forum avec id=${idForum}`
			return Promise.resolve({ status: 200, message })
		})
}

const coin = [
  { name: 'PILE', picture: 'piece-ck-tail.jpeg' },
  { name: 'FACE', picture: 'piece-ck-head.jpeg' },
]

export const coinFlip = async () => {
  const bit = Math.floor(Math.random() * 2)

  const message = `# C'est tombé sur ${coin[bit].name} !`
  const picture = coin[bit].picture

  return Promise.resolve({ status: 200, message, picture })
}

const pointsRemark = (numberOfPoints) => {
	if (numberOfPoints < 110) {
		return 'Bienvenue dans le CK !'
	} else if (numberOfPoints < 220) {
		return 'Vous êtes encore tout nouveau on dirait...'
	} else if (numberOfPoints < 220) {
		return "C'est un bon début."
	} else if (numberOfPoints < 300) {
		return 'Vous commencez à vous faire la main.'
	} else if (numberOfPoints < 400) {
		return "Qu'est ce que ça pousse vite !"
	} else if (numberOfPoints < 455) {
		return 'Ça commence à en faire !'
	} else if (numberOfPoints < 550) {
		return 'Vous avez dépassé la moyenne !' // apparement moyenne de 450 points au 20.10.23 avec le nouveau système de points
	} else if (numberOfPoints < 700) {
		return 'Un vrai commando, on vous la fait plus.'
	} else if (numberOfPoints < 900) {
		return "On est presque à la médaille d'argent, encore un effort !"
	} else if (numberOfPoints < 1200) {
		return 'Ça fait un moment que vous les accumulez.'
	} else if (numberOfPoints < 1500) {
		return "On arrive à la médaille d'or, on s'accroche !"
	} else if (numberOfPoints < 2000) {
		return 'Un vrai meuble du CK, ça fait un moment que vous êtes dans le coin.'
	} else if (numberOfPoints < 5000) {
		return 'Ça fait un sacré nombre de points !'
	} else if (numberOfPoints < 10000) {
		return 'Est-ce-que vous comptez encore..?'
	} else {
		return numberOfPoints + ' points... vraiment ? Ça me laisse bouche bée.'
	}
}

export const getProfile = async (requesterId) => {
	return forumService.users
		.info(requesterId)
		.then((data) => {
			console.log(data)
			const message = !data
				? "Votre compte Discord n'est lié à aucun compte Forum."
				: `
<@${requesterId}>, voici le résumé de votre profil :

Votre profil forum : https://forum.commandokieffer.com/index.php?members/${data.user_id}.
Vous avez accumulé un total de **${data.medals_count} médailles**. Pour voir lesquelles, rendez-vous ici : https://commandokieffer.com/medal.php
Vous avez un total de **${data.panel_pts} points**. ${pointsRemark(data.panel_pts)} Pour voir le classement, c'est ici : https://commandokieffer.com/points.php
Vous avez été présent à **${data.panel_prs} missions** du vendredi et en avez manqué **${data.panel_abs}**, ce qui fait un taux de présence de **${(
						(data.panel_prs === 0
							? 0
							: data.panel_prs / (data.panel_prs + data.panel_abs)) * 100
				  ).toFixed(1)}%**.
Cela fait maintenant **${Math.floor((new Date() - data.register_date)/(1000*60*60*24))} jours** que vous êtes dans le commando Kieffer, soit depuis ${formatDistanceToNow(data.register_date, { locale: fr })}.
`
			return Promise.resolve({ status: 200, message })
		})
		.catch((msg) => {
			// const message = `Votre compte Discord n'est lié à aucun compte Forum.`
			return Promise.resolve({ status: 200, message: msg })
		})
}

export const getUsername = async (requesterId, userId) => {
	return forumService.users
		.getUsername(userId)
		.then((data) => {
			const message = !data
				? `Impossible de retrouver le pseudo de <@${userId}>. Soit le compte Discord n'est pas lié au Forum, soit l'utilisateur n'a pas fait son recrutement via Discord.`
				: `Selon mes informations, le pseudo en jeu de <@${userId}> est \n> **${data.platform_username}**`

			return Promise.resolve({ status: 200, message })
		})
		.catch((msg) => Promise.resolve({ status: 200, message: msg }))
}

export const sendComplaint = async (requesterId, message) => {
	const createDMChannelEndpoint = 'users/@me/channels'
	const createDMChannelReq = await DiscordRequest(createDMChannelEndpoint, {
		method: 'POST',
		body: { recipient_id: requesterId },
	})
	const channel = await createDMChannelReq.json()
	const endpointMessage = `channels/${channel.id}/messages`
	let content = ''

	return new Promise((resolve, reject) => {
		forumService.complaints
			.send(requesterId, message)
			.then(() => {
				content = `Votre plainte a bien été reçue.\n\n==== Votre message ====\n\n> ${message}`
			})
			.catch(() => {
				content = `Une erreur est survenue et votre plainte n'a pas pu être reçue. Veuillez réessayer plus tard et prévenir un membre de l'EM si le problème persiste.`
			})
			.finally(() => {
				DiscordRequest(endpointMessage, {
					method: 'POST',
					body: { content },
				}).finally(() => resolve({ status: 200, message: '' }))
			})
	})
}

export const startRecruitment = (requesterId, userId) => {
	const message = `Démarrage du recrutement de <@${userId}>`
	const endpoint = `guilds/${process.env.GUILD_ID}/members/${userId}`

	const roles = [process.env.RECRUITING_ROLE]
	const body = { roles }

	return new Promise(async (resolve, reject) => {
		try {
			const res = await DiscordRequest(endpoint, { method: 'PATCH', body })
			const data = await res.json()

			resolve({ status: 200, message })
		} catch (e) {
			resolve({ status: 500, message: e })
		}
	})
}

export const fireCommando = async (requesterId, commando) => {
	if (!commando || protectedIds.includes(commando)) {
		return Promise.resolve({
			status: 200,
			message: `**Action prohibée** : <@${requesterId}> a tenté de radier <@${commando}>`,
		})
	}
	const message = `Le commando <@${commando}> a été radié`
	// return Promise.resolve({status: 200, message})
	const endpoint = `guilds/${process.env.GUILD_ID}/members/${commando}`

	const res = await DiscordRequest(endpoint, { method: 'GET' })
	const user = await res.json()

	return new Promise(async (resolve, reject) => {
		try {
			// cancer à comprendre pour les non-initiés
			// c'est une regex qui sert à sortir le nom de commando du nom complet discord
			// exemple : Lv.Ohliger-1Cmd ==> Ohliger
			const name =
				/(?:[a-z0-9]*.)([a-z 'é-]*)(?:-)(?:[18]|(KG)|(QG))(?:[a-z]*)/i.exec(
					user.nick
				)[1]

			const nick = `Ex ${name} ${new Date(user.joined_at)
				.toLocaleDateString('fr')
				.replaceAll('/', ' ')}`

			const roles = [process.env.ANCIEN_COMMANDO_ROLE]
			const body = { nick, roles }

			const res = await DiscordRequest(endpoint, { method: 'PATCH', body })
			res.json().then(() => {
				forumService.users
					.setRoles(commando, nick, process.env.CIVIL_ROLE_FORUM, [])
					.then(() => {
						resolve({ status: 200, message })
					})
			})
		} catch (e) {
			resolve({ status: 500, message: e })
		}
	})
}

const getTroopDiscordRole = (troop) => {
	switch (troop) {
		case TROOP.T1:
			return process.env.T1_ROLE
		case TROOP.T8:
			return process.env.T8_ROLE
		case TROOP.T9:
			return process.env.T9_ROLE
		case TROOP.TQG:
			return process.env.TQG_ROLE
		case TROOP.T2:
			return 0
		case TROOP.T3:
			return 0
		default:
			return 0
	}
}

const getInitialRoles = (troop, bordee) => {
	const discordRoles = [
		process.env.CADET_ROLE,
		process.env.MEMBRE_EQUIPAGE_ROLE,
	]
	const forumRoles = [
		process.env.SPE_FSL_ROLE_FORUM,
		process.env.MEMBRE_EQUIPAGE_ROLE_FORUM,
	]

	switch (troop) {
		case TROOP.T1:
			discordRoles.push(process.env.T1_ROLE)
			forumRoles.push(process.env.T1_ROLE_FORUM)
			if (bordee === BORDEE.B1) {
				discordRoles.push(process.env.T1_B1_ROLE)
				forumRoles.push(process.env.B1_ROLE_FORUM)
			} else {
				discordRoles.push(process.env.T1_B2_ROLE)
				forumRoles.push(process.env.B2_ROLE_FORUM)
			}
			break
		case TROOP.T8:
			discordRoles.push(process.env.T8_ROLE)
			forumRoles.push(process.env.T8_ROLE_FORUM)
			if (bordee === BORDEE.B1) {
				discordRoles.push(process.env.T8_B1_ROLE)
				forumRoles.push(process.env.B1_ROLE_FORUM)
			} else {
				discordRoles.push(process.env.T8_B2_ROLE)
				forumRoles.push(process.env.B2_ROLE_FORUM)
			}
			break
		case TROOP.T9:
			discordRoles.push(process.env.T9_ROLE)
			forumRoles.push(process.env.T9_ROLE_FORUM)
			if (bordee === BORDEE.B1) {
				discordRoles.push(process.env.T9_B1_ROLE)
				forumRoles.push(process.env.B1_ROLE_FORUM)
			} else {
				discordRoles.push(process.env.T9_B2_ROLE)
				forumRoles.push(process.env.B2_ROLE_FORUM)
			}
			break
		case TROOP.TQG:
			discordRoles.push(process.env.TQG_ROLE)
			forumRoles.push(process.env.TQG_ROLE_FORUM)
			if (bordee === BORDEE.B1) {
				discordRoles.push(process.env.TQG_B1_ROLE)
				forumRoles.push(process.env.B1_ROLE_FORUM)
			} else {
				discordRoles.push(process.env.TQG_B2_ROLE)
				forumRoles.push(process.env.B2_ROLE_FORUM)
			}
			break
		case TROOP.T2:
			break
		case TROOP.T3:
			break
		default:
			return []
	}

	return [discordRoles, forumRoles]
}

const getTroopAlias = (troop) => {
	switch (troop) {
		case TROOP.T1:
			return '1'
		case TROOP.T8:
			return '8'
		case TROOP.T2:
			return '2'
		case TROOP.T3:
			return '3'
		case TROOP.T9:
			return 'KG'
		case TROOP.TQG:
			return 'QG'
		default:
			return null
	}
}

const getBordeeAlias = (bordee) => {
	switch (bordee) {
		case BORDEE.B1:
			return '1'
		case BORDEE.B2:
			return '2'
		default:
			return ''
	}
}

export const assignInitialRoles = (
	requesterId,
	[commando, nom, troop, bordee]
) => {
	if (!commando || protectedIds.includes(commando)) {
		return Promise.resolve({
			status: 200,
			message: `**Action prohibée** : <@${requesterId}> a tenté de recruter <@${commando}>`,
		})
	}

	const endpointRoles = `guilds/${process.env.GUILD_ID}/members/${commando}`
	const endpointMessage = `channels/${process.env.HOME_CHANNEL}/messages`

	const nick = `Cadet.${nom}-${getTroopAlias(troop)}Fsl`
	const [discordRoles, forumRoles] = getInitialRoles(troop, bordee)

	return new Promise(async (resolve, reject) => {
		try {
			const pseudoReq = await forumService.users.getUsername(commando)
			const pseudo = pseudoReq.platform_username
			const bodyRoles = { nick, roles: discordRoles }
			const bodyMessage = {
				content: `<@${commando}>\n\nNous souhaitons la bienvenue au cadet **${nom}** qui rejoint la bordée ${getBordeeAlias(
					bordee
				)} de la <@&${getTroopDiscordRole(
					troop
				)}>.\n\nSelon sa fiche de recrutement, son pseudo en jeu est : "**${pseudo}**".`,
			}

			const resRoles = DiscordRequest(endpointRoles, {
				method: 'PATCH',
				body: bodyRoles,
			})
			const resMessage = DiscordRequest(endpointMessage, {
				method: 'POST',
				body: bodyMessage,
			})

			Promise.all([resRoles, resMessage]).then(() => {
				forumService.users
					.setRoles(commando, nom, process.env.CADET_ROLE_FORUM, forumRoles)
					.then(() => {
						resolve({
							status: 200,
							message: `Le commando <@${commando}> est assigné à la ${troop}-${bordee}`,
						})
					})
			})
		} catch (e) {
			console.error(e)
			resolve({ status: 200, message: 'Une erreur est survenue' })
		}
	})
}

export const recruitmentForm1 = async (requesterId, data) => {
	return forumService.recruitment
		.part1(requesterId, data)
		.then((message) => Promise.resolve({ status: 200, message }))
		.catch((message) => Promise.resolve({ status: 200, message }))
}

export const recruitmentForm2 = async (requesterId, data) => {
	return forumService.recruitment
		.part2(requesterId, data)
		.then((message) => Promise.resolve({ status: 200, message }))
		.catch((message) => Promise.resolve({ status: 200, message }))
}

export const recruitmentForm3 = async (requesterId, data) => {
	return forumService.recruitment
		.part3(requesterId, data)
		.then((message) => Promise.resolve({ status: 200, message }))
		.catch((message) => Promise.resolve({ status: 200, message }))
}

export const help = () => {
	const message = `
**__Pour les nouvelles recrues__**
- \`/${RECRUITMENT_FORM_1_COMMAND.name}\` => ${RECRUITMENT_FORM_1_COMMAND.description}
- \`/${RECRUITMENT_FORM_2_COMMAND.name}\` => ${RECRUITMENT_FORM_2_COMMAND.description}
- \`/${RECRUITMENT_FORM_3_COMMAND.name}\` => ${RECRUITMENT_FORM_3_COMMAND.description}

**__Pour tout le monde__**
- \`/${HELP_COMMAND.name}\` => ${HELP_COMMAND.description}
- \`/${TEST_COMMAND.name}\` => ${TEST_COMMAND.description}
- \`/${COIN_FLIP_COMMAND.name}\` => ${COIN_FLIP_COMMAND.description}
- [Action] \`${GET_USERNAME_COMMAND.name}\` => Affiche le pseudo du membre sélectionné
- \`/${INFOS_GENERALES_COMMAND.name}\` => ${INFOS_GENERALES_COMMAND.description}
- \`/${INFOS_SITES_COMMAND.name}\` => ${INFOS_SITES_COMMAND.description}
- \`/${INFOS_SPE_COMMAND.name}\` => ${INFOS_SPE_COMMAND.description}
- \`/${PROFILE_COMMAND.name}\` => ${PROFILE_COMMAND.description}

**__Pour les QM, Instructeurs, Recruteurs__**
- \`/${CIVILS_NON_VUS_COMMAND.name}\` => ${CIVILS_NON_VUS_COMMAND.description}
- \`/${LINK_COMMAND.name}\` => ${LINK_COMMAND.description}
- \`/${ASSIGN_INITIAL_ROLES_COMMAND.name}\` => ${ASSIGN_INITIAL_ROLES_COMMAND.description}
- [Action] \`${LINK_MODAL_COMMAND.name}\` => ${LINK_COMMAND.description}
- [Action] \`${START_RECRUITMENT_COMMAND.name}\` => Démarre la phase de recrutement (donne les permissions pour remplir le formulaire de recrutement)

**__Pour l'État-Major__**
- [Action] \`${FIRE_COMMAND.name}\` => Radiation du membre séectionné
`

	return Promise.resolve({ status: 200, message })
}

export const displayGeneralInfos = () => {
	const message = `
    **__Information générales__**
    =)
    `

	return Promise.resolve({ status: 200, message })
}

export const displayWebsites = () => {
	const message = `
**__Les sites importants du CK__**

Le panel : https://zeus.commandokieffer.com/
La boutique officielle : https://boutique.commandokieffer.com/
L'accueil : https://commandokieffer.com/
Le Forum : https://forum.commandokieffer.com/
La caserne : https://commandokieffer.com/barracks.php
Les décorations : https://commandokieffer.com/medal.php
Les points : https://commandokieffer.com/points.php
Les métiers : https://commandokieffer.com/metiers.php
L'histoire : https://commandokieffer.com/history.php
La galerie : https://commandokieffer.com/galerie.php

**__Les ressources intéressantes__**
Spé arme BF6 : https://forum.commandokieffer.com/index.php?threads/bf6-sp%C3%A9cialit%C3%A9-arme.3644/
Explication des grades : https://forum.commandokieffer.com/index.php?threads/grades-du-commando-kieffer.18/
`

	return Promise.resolve({ status: 200, message })
}

export const displaySpe = () => {
	const message = `
# __La spé fusilier__ (_FSL_)

**Rôle :** Être **polyvalent**, apte à soutenir et renforcer toutes les escouades. Le Fusilier est la **spécialité de base** du groupe : il peut agir en **Soutien**, **Assaut léger** ou **renfort tactique**, selon les besoins de la mission. C’est le soldat fiable, présent sur tous les fronts.

**Tag :** Fsl

**Classe :** Soutien
**Restriction(s) de classe :**
- Gadget de classe
- Capacité active

**Spécialité(s) autorisée(s) :** Toutes.


**Arme principale :** Tous les **Fusil d’Assaut** et **Carabine** (hors M4A1, GRT-BC, M277 et M417 A2).
**Accessoire(s) restreint(s) :**
- Toutes les **optiques supérieures à x4** exclues.

**Arme secondaire :** Tous les **pistolets**.
**Accessoire(s) restreint(s) :**
- Toutes les **optiques supérieures à x1.75** exclues.

**Gadget 1 & 2 autorisé(s) :**
- GPDIS
- MP-APS
- Protection déployable

**Grenade(s) autorisée(s) :** Tout **hors** grenade incendiaire.

**Règles d’engagement :** Le Fusilier agit en **appui** : il avance avec l’équipe, renforce la ligne, et adapte son équipement selon les besoins. C’est le **soldat universel** de la bordée.

# __Les autres spé__
- BF6 : https://forum.commandokieffer.com/index.php?threads/bf6-sp%C3%A9cialit%C3%A9-arme.3644/
- CoD: UO & CoD II : https://forum.commandokieffer.com/index.php?threads/sp%C3%A9cialisation-armes-cod-uo-et-cod-ii.2252/
`
	return Promise.resolve({ status: 200, message })
}

const limit = (array, size) => {
	array.length = size
	return array
}

export const displayUnseenCivilians = async () => {
	let result = ''
	let counter = 25 // sinon le message devient trop gros et on ne peut pas écrire la réponse
	const endpoint = `guilds/${process.env.GUILD_ID}/members?limit=1000`

	return new Promise(async (resolve, reject) => {
		try {
			const res = await DiscordRequest(endpoint, { method: 'GET' })
			const civilians = await res.json()

			civilians.forEach((civilian) => {
				// mmmmh
				if (
					counter > 0 &&
					civilian.roles.includes(process.env.CIVIL_EN_ATTENTE_ROLE)
				) {
					const joinedAt = new Date(civilian.joined_at)
					if (isBefore(joinedAt, subDays(new Date(), 2))) {
						counter--
						result += `\n<@${
							civilian.user.id
						}> - a rejoint le Discord le **${joinedAt.toLocaleDateString(
							'fr'
						)}** à ${joinedAt.toLocaleTimeString('fr')}`
					}
				}
			})

			resolve({
				status: 200,
				message: result.length
					? `***Liste des civils non vus (limite : 25)***\n${result}`
					: 'Aucun civil en attente depuis plus de 2 jours.',
			})
		} catch (e) {
			resolve({ status: 200, message: e })
		}
	})
}
