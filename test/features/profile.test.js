import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createProfileFeature, pointsRemark, presenceRate } from '../../src/features/profile.js'
import { ForumError, GENERIC_ERROR_MESSAGE } from '../../src/services/forum/errors.js'
import { createFakeForum, createTestLogger, ids } from '../support/fakes.js'

const content = {
	links: {
		zeusProfile: 'https://zeus.commandokieffer.com/profil/{userId}',
		pointsRanking: 'https://zeus.commandokieffer.com/classements?ranking=points',
	},
}

const NOW = new Date('2026-11-03T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

const setup = (users) => {
	const forum = createFakeForum({ users })
	const logger = createTestLogger()
	return { forum, logger, profile: createProfileFeature({ forum, content, logger, now: () => NOW }) }
}

describe('profil', () => {
	const data = {
		user_id: 33,
		medals_count: 12,
		panel_pts: 480,
		panel_prs: 30,
		panel_abs: 10,
		register_date: NOW.getTime() - 400 * DAY,
	}

	it('résume le profil du membre', async () => {
		const { profile, forum } = setup({ info: async () => data })
		const { status, message } = await profile.getProfile(ids.requester)

		assert.equal(status, 200)
		assert.deepEqual(forum.users.info.mock.calls[0].arguments, [ids.requester])
		assert.ok(message.includes(`<@${ids.requester}>, voici le résumé de votre profil :`))
		assert.ok(message.includes('Votre profil Zeus : https://zeus.commandokieffer.com/profil/33.'))
		assert.ok(message.includes('**12 médailles**. Pour voir lesquelles, rendez-vous sur votre profil Zeus.\n'))
		assert.ok(
			message.includes(
				"**480 points**. Vous avez dépassé la moyenne ! Pour voir le classement, c'est ici : https://zeus.commandokieffer.com/classements?ranking=points"
			)
		)
		assert.doesNotMatch(message, /forum\.commandokieffer\.com|commandokieffer\.com\/decorations/)
		assert.ok(message.includes('présent à **30 missions** du vendredi et en avez manqué **10**, ce qui fait un taux de présence de **75.0%**'))
		assert.ok(message.includes('**400 jours** que vous êtes dans le commando Kieffer, soit depuis environ 1 an.'))
	})

	it('logue les données du profil en debug uniquement', async () => {
		const { profile, logger } = setup({ info: async () => data })
		await profile.getProfile(ids.requester)
		assert.deepEqual(
			logger.entries.map((entry) => entry.level),
			['debug']
		)
	})

	it('prévient si le compte Discord n\'est pas lié', async () => {
		const { profile } = setup({ info: async () => null })
		assert.deepEqual(await profile.getProfile(ids.requester), {
			status: 200,
			message: "Votre compte Discord n'est lié à aucun compte Forum.",
		})
	})

	it('affiche le message d\'erreur du forum, ou un message générique', async () => {
		const known = setup({
			info: async () => {
				throw new ForumError('Une erreur est survenue. CODE U103')
			},
		})
		assert.equal((await known.profile.getProfile(ids.requester)).message, 'Une erreur est survenue. CODE U103')

		const unknown = setup({
			info: async () => {
				throw new TypeError('x is undefined')
			},
		})
		assert.equal((await unknown.profile.getProfile(ids.requester)).message, GENERIC_ERROR_MESSAGE)
	})
})

describe('pseudo en jeu', () => {
	it('donne le pseudo de la fiche de recrutement', async () => {
		const { profile, forum } = setup({ getUsername: async () => ({ platform_username: 'Mozi#1234' }) })
		assert.deepEqual(await profile.getUsername(ids.requester, ids.target), {
			status: 200,
			message: `Selon mes informations, le pseudo en jeu de <@${ids.target}> est \n> **Mozi#1234**`,
		})
		assert.deepEqual(forum.users.getUsername.mock.calls[0].arguments, [ids.target])
	})

	it('explique pourquoi le pseudo est introuvable', async () => {
		const { profile } = setup({ getUsername: async () => null })
		const { message } = await profile.getUsername(ids.requester, ids.target)
		assert.match(message, /^Impossible de retrouver le pseudo de <@100000000000000002>/)
	})

	it('affiche l\'erreur du forum', async () => {
		const { profile } = setup({
			getUsername: async () => {
				throw new ForumError('Erreur de connexion à la base de données. CODE U130')
			},
		})
		assert.equal((await profile.getUsername('1', ids.target)).message, 'Erreur de connexion à la base de données. CODE U130')
	})
})

describe('remarques sur les points', () => {
	it('change selon le nombre de points', () => {
		assert.equal(pointsRemark(0), 'Bienvenue dans le CK !')
		assert.equal(pointsRemark(109), 'Bienvenue dans le CK !')
		assert.equal(pointsRemark(110), 'Vous êtes encore tout nouveau on dirait...')
		assert.equal(pointsRemark(220), 'Vous commencez à vous faire la main.')
		assert.equal(pointsRemark(300), "Qu'est ce que ça pousse vite !")
		assert.equal(pointsRemark(400), 'Ça commence à en faire !')
		assert.equal(pointsRemark(455), 'Vous avez dépassé la moyenne !')
		assert.equal(pointsRemark(550), 'Un vrai commando, on vous la fait plus.')
		assert.equal(pointsRemark(700), "On est presque à la médaille d'argent, encore un effort !")
		assert.equal(pointsRemark(900), 'Ça fait un moment que vous les accumulez.')
		assert.equal(pointsRemark(1200), "On arrive à la médaille d'or, on s'accroche !")
		assert.equal(pointsRemark(1500), 'Un vrai meuble du CK, ça fait un moment que vous êtes dans le coin.')
		assert.equal(pointsRemark(2000), 'Ça fait un sacré nombre de points !')
		assert.equal(pointsRemark(5000), 'Est-ce-que vous comptez encore..?')
		assert.equal(pointsRemark(12345), '12345 points... vraiment ? Ça me laisse bouche bée.')
	})
})

describe('taux de présence', () => {
	it('se calcule sur les missions du vendredi', () => {
		assert.equal(presenceRate(0, 0), '0.0')
		assert.equal(presenceRate(0, 5), '0.0')
		assert.equal(presenceRate(1, 2), '33.3')
		assert.equal(presenceRate(4, 0), '100.0')
	})
})
