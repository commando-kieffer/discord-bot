import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale/index.js'
import { fillTemplate } from '../content.js'
import { toUserMessage } from '../services/forum/errors.js'

const DAY = 1000 * 60 * 60 * 24

export const pointsRemark = (numberOfPoints) => {
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

export const presenceRate = (present, absent) => ((present === 0 ? 0 : present / (present + absent)) * 100).toFixed(1)

export function createProfileFeature({ forum, content, logger, now = () => new Date() }) {
	const getProfile = async (requesterId) => {
		let data
		try {
			data = await forum.users.info(requesterId)
		} catch (err) {
			// const message = `Votre compte Discord n'est lié à aucun compte Forum.`
			return { status: 200, message: toUserMessage(err) }
		}

		logger.debug('Profil demandé', { requesterId, data })

		if (!data) {
			return { status: 200, message: "Votre compte Discord n'est lié à aucun compte Forum." }
		}

		const today = now()
		const message = `
<@${requesterId}>, voici le résumé de votre profil :

Votre profil forum : ${fillTemplate(content.links.forumProfile, { userId: data.user_id })}.
Vous avez accumulé un total de **${data.medals_count} médailles**. Pour voir lesquelles, rendez-vous ici : ${content.links.medals}
Vous avez un total de **${data.panel_pts} points**. ${pointsRemark(data.panel_pts)} Pour voir le classement, c'est ici : ${content.links.pointsRanking}
Vous avez été présent à **${data.panel_prs} missions** du vendredi et en avez manqué **${data.panel_abs}**, ce qui fait un taux de présence de **${presenceRate(data.panel_prs, data.panel_abs)}%**.
Cela fait maintenant **${Math.floor((today - data.register_date) / DAY)} jours** que vous êtes dans le commando Kieffer, soit depuis ${formatDistance(data.register_date, today, { locale: fr })}.
`
		return { status: 200, message }
	}

	const getUsername = async (requesterId, userId) => {
		let data
		try {
			data = await forum.users.getUsername(userId)
		} catch (err) {
			return { status: 200, message: toUserMessage(err) }
		}

		const message = !data
			? `Impossible de retrouver le pseudo de <@${userId}>. Soit le compte Discord n'est pas lié au Forum, soit l'utilisateur n'a pas fait son recrutement via Discord.`
			: `Selon mes informations, le pseudo en jeu de <@${userId}> est \n> **${data.platform_username}**`

		return { status: 200, message }
	}

	return { getProfile, getUsername }
}
