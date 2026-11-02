import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DiscordApiError } from '../../src/clients/discord.js'
import { createRecruitmentFeature } from '../../src/features/recruitment.js'
import { ForumError } from '../../src/services/forum/errors.js'
import { callsOf, createFakeDiscord, createFakeForum, createTestLogger, ids, testConfig } from '../support/fakes.js'

const config = testConfig()

const setup = ({ discord = {}, users = {}, recruitment = {} } = {}) => {
	const fakeDiscord = createFakeDiscord(discord)
	const forum = createFakeForum({ users, recruitment })
	const logger = createTestLogger()
	const feature = createRecruitmentFeature({ discord: fakeDiscord, forum, config, logger })
	return { discord: fakeDiscord, forum, logger, feature }
}

const fail = (error) => async () => {
	throw error
}

describe('recrutement (passage cadet)', () => {
	it('renomme, donne les rôles, souhaite la bienvenue et met à jour le forum', async () => {
		const { discord, forum, feature } = setup()

		const result = await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b2'])

		assert.deepEqual(result, { status: 200, message: `Le commando <@${ids.target}> est assigné à la t1-b2` })
		assert.deepEqual(callsOf(discord.updateMember), [
			[
				ids.target,
				{
					nick: 'Cadet.Kieffer-1Fsl',
					roles: [ids.roles.cadet, ids.roles.membreEquipage, ids.roles.t1, ids.roles.t1b2],
				},
			],
		])
		assert.deepEqual(callsOf(discord.sendMessage), [
			[
				ids.homeChannel,
				{
					content: `<@${ids.target}>\n\nNous souhaitons la bienvenue au cadet **Kieffer** qui rejoint la bordée 2 de la <@&${ids.roles.t1}>.\n\nSelon sa fiche de recrutement, son pseudo en jeu est : "**Pseudo#1234**".`,
					allowed_mentions: { users: [ids.target], roles: [ids.roles.t1] },
				},
			],
		])
		assert.deepEqual(callsOf(forum.users.setRoles), [[ids.target, 'Kieffer', '5', ['30', '42', '38', '53']]])
	})

	it('n\'autorise aucune mention de rôle pour T2 et T3', async () => {
		const { discord, feature } = setup()
		await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't2', 'b1'])
		assert.deepEqual(callsOf(discord.sendMessage)[0][1].allowed_mentions, { users: [ids.target], roles: [] })
		assert.equal(callsOf(discord.updateMember)[0][1].nick, 'Cadet.Kieffer-2Fsl')
	})

	it('nettoie les espaces autour du nom', async () => {
		const { discord, feature } = setup()
		await feature.assignInitialRoles(ids.requester, [ids.target, '  Kieffer ', 't8', 'b1'])
		assert.equal(callsOf(discord.updateMember)[0][1].nick, 'Cadet.Kieffer-8Fsl')
	})

	it('refuse pour un membre protégé', async () => {
		const { discord, feature } = setup()
		assert.equal(
			(await feature.assignInitialRoles(ids.requester, [ids.protected, 'Kieffer', 't1', 'b1'])).message,
			`**Action prohibée** : <@${ids.requester}> a tenté de recruter <@${ids.protected}>`
		)
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('refuse un nom, une troop ou une bordée invalides', async () => {
		const { discord, feature } = setup()
		assert.match((await feature.assignInitialRoles(ids.requester, [ids.target, '@everyone', 't1', 'b1'])).message, /pas un nom de commando valide/)
		assert.equal((await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't7', 'b1'])).message, 'Troop ou bordée inconnue.')
		assert.equal((await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b3'])).message, 'Troop ou bordée inconnue.')
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('accepte le pseudo le plus long possible (32 caractères)', async () => {
		const { discord, feature } = setup()
		await feature.assignInitialRoles(ids.requester, [ids.target, 'Abcdefghijklmnopqrst', 't9', 'b1'])
		assert.equal(callsOf(discord.updateMember)[0][1].nick.length, 32)
	})

	it('s\'arrête avec un message court si le membre n\'est pas lié au forum', async () => {
		const { discord, forum, feature } = setup({ users: { findLinkedAccount: async () => null } })
		const { message } = await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b1'])
		assert.equal(message, `<@${ids.target}> n'est pas lié au forum. Passez d'abord par « Lier au forum ».`)
		assert.deepEqual(callsOf(forum.users.findLinkedAccount), [[ids.target]])
		assert.equal(forum.users.getUsername.mock.callCount(), 0)
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('s\'arrête si le lien ne peut pas être vérifié', async () => {
		const { discord, feature } = setup({ users: { findLinkedAccount: fail(new ForumError('Erreur de connexion à la base de données. CODE U14')) } })
		const { message } = await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b1'])
		assert.equal(message, 'Erreur de connexion à la base de données. CODE U14')
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('s\'arrête si la fiche de recrutement est introuvable', async () => {
		const { discord, feature } = setup({ users: { getUsername: async () => null } })
		const { message } = await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b1'])
		assert.match(message, /Impossible de trouver la fiche de recrutement/)
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('s\'arrête si le forum est injoignable', async () => {
		const { feature } = setup({ users: { getUsername: fail(new ForumError('Erreur de connexion à la base de données. CODE U130')) } })
		const { message } = await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b1'])
		assert.equal(message, 'Erreur de connexion à la base de données. CODE U130')
	})

	it('s\'arrête si Discord refuse le changement de rôles', async () => {
		const error = new DiscordApiError({ method: 'PATCH', endpoint: 'x', status: 403 })
		const { discord, forum, feature, logger } = setup({ discord: { updateMember: fail(error) } })
		const { message } = await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b1'])
		assert.match(message, /n'ont pas pu être modifiés sur Discord/)
		assert.equal(discord.sendMessage.mock.callCount(), 0)
		assert.equal(forum.users.setRoles.mock.callCount(), 0)
		assert.equal(logger.entries[0].context.error, error)
	})

	it('signale un message de bienvenue ou une mise à jour du forum en échec', async () => {
		const { feature } = setup({
			discord: { sendMessage: fail(new DiscordApiError({ method: 'POST', endpoint: 'x', status: 403 })) },
			users: { setRoles: fail(new ForumError("Aucun compte forum n'est lié à ce compte Discord. CODE U32")) },
		})
		const { message } = await feature.assignInitialRoles(ids.requester, [ids.target, 'Kieffer', 't1', 'b1'])
		assert.equal(
			message,
			[
				`Le commando <@${ids.target}> est assigné à la t1-b1`,
				"Le message de bienvenue n'a pas pu être envoyé.",
				"Le forum n'a pas été mis à jour : Aucun compte forum n'est lié à ce compte Discord. CODE U32",
			].join('\n')
		)
	})
})

describe('enrôler une recrue', () => {
	it('renomme et donne les rôles Discord de recrue, sans toucher au forum', async () => {
		const { discord, forum, feature, logger } = setup()

		assert.deepEqual(await feature.enrolRecruit(ids.requester, [ids.target, 'Kieffer', 't9', 'b1']), {
			status: 200,
			message: `La recrue <@${ids.target}> est assignée à la t9-b1`,
		})
		assert.deepEqual(callsOf(discord.updateMember), [
			[
				ids.target,
				{
					nick: 'Recrue.Kieffer-KGFsl',
					roles: [ids.roles.recrue, ids.roles.membreEquipage, ids.roles.t9, ids.roles.t9b1],
				},
			],
		])
		assert.equal(discord.sendMessage.mock.callCount(), 0)
		for (const fn of Object.values(forum.users)) assert.equal(fn.mock.callCount(), 0)
		assert.equal(logger.entries[0].message, 'Recrue enrôlée')
	})

	it('refuse pour un membre protégé', async () => {
		const { discord, feature } = setup()
		assert.equal(
			(await feature.enrolRecruit(ids.requester, [ids.protected, 'Kieffer', 't1', 'b1'])).message,
			`**Action prohibée** : <@${ids.requester}> a tenté d'enrôler <@${ids.protected}>`
		)
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('refuse un nom invalide, une troop ou une bordée manquante', async () => {
		const { discord, feature } = setup()
		assert.match((await feature.enrolRecruit(ids.requester, [ids.target, 'K', 't1', 'b1'])).message, /pas un nom de commando valide/)
		assert.equal((await feature.enrolRecruit(ids.requester, [ids.target, 'Kieffer', undefined, 'b1'])).message, 'Troop ou bordée inconnue.')
		assert.equal((await feature.enrolRecruit(ids.requester, [ids.target, 'Kieffer', 't1', undefined])).message, 'Troop ou bordée inconnue.')
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('refuse un pseudo de recrue trop long pour Discord', async () => {
		const { discord, feature } = setup()
		const { message } = await feature.enrolRecruit(ids.requester, [ids.target, 'Abcdefghijklmnopqrst', 't9', 'b1'])
		assert.equal(message, 'Le pseudo « Recrue.Abcdefghijklmnopqrst-KGFsl » dépasse les 32 caractères autorisés par Discord.')
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('prévient si Discord refuse', async () => {
		const { feature, logger } = setup({ discord: { updateMember: fail(new DiscordApiError({ method: 'PATCH', endpoint: 'x', status: 403 })) } })
		assert.match((await feature.enrolRecruit(ids.requester, [ids.target, 'Kieffer', 't1', 'b1'])).message, /n'ont pas pu être modifiés sur Discord/)
		assert.equal(logger.entries[0].level, 'error')
	})
})

describe('ouverture des formulaires Enrôler et Recrutement', () => {
	const member = {
		nick: 'Recrue.Kieffer-8Fsl',
		roles: [ids.roles.recrue, ids.roles.t8, ids.roles.t8b2],
		user: { username: 'mozi', global_name: 'Mozi' },
	}

	it('pré-remplit le formulaire de recrutement avec les infos de la recrue', () => {
		const { feature } = setup()
		const { form } = feature.openCadetForm(ids.requester, ids.target, member)
		assert.equal(form.custom_id, `cadet-form-${ids.target}`)
		assert.equal(form.title, 'Recrutement de Recrue.Kieffer-8Fsl')
		assert.equal(form.components[0].component.value, 'Kieffer')
		assert.equal(form.components[1].component.options.find((option) => option.default).value, 't8')
		assert.equal(form.components[2].component.options.find((option) => option.default).value, 'b2')
	})

	it('ouvre le formulaire Enrôler avec le nom d\'affichage du membre', () => {
		const { feature } = setup()
		const { form } = feature.openEnrolForm(ids.requester, ids.target, { roles: [], user: { username: 'mozi', global_name: 'Mozi' } })
		assert.equal(form.custom_id, `enrol-form-${ids.target}`)
		assert.equal(form.title, 'Enrôler Mozi')
		assert.equal(form.components[0].component.value, undefined)

		assert.equal(feature.openEnrolForm(ids.requester, ids.target, { user: { username: 'mozi' } }).form.title, 'Enrôler mozi')
		assert.equal(feature.openEnrolForm(ids.requester, ids.target, undefined).form.title, 'Enrôler')
	})

	it('refuse d\'ouvrir le formulaire pour un membre protégé', () => {
		const { feature } = setup()
		assert.deepEqual(feature.openEnrolForm(ids.requester, ids.protected, member), {
			status: 200,
			message: `**Action prohibée** : <@${ids.requester}> a tenté d'enrôler <@${ids.protected}>`,
		})
		assert.match(feature.openCadetForm(ids.requester, ids.protected, member).message, /a tenté de recruter/)
	})
})

describe('questionnaires', () => {
	it('transmettent les réponses au forum et renvoient sa réponse', async () => {
		const { forum, feature } = setup()
		const data = { commando_name: 'Kieffer' }
		assert.deepEqual(await feature.recruitmentForm1(ids.requester, data), {
			status: 200,
			message: `<@${ids.requester}>, formulaire 1/3 complété.`,
		})
		assert.deepEqual(callsOf(forum.recruitment.part1), [[ids.requester, data]])
		assert.equal((await feature.recruitmentForm2(ids.requester, {})).message, `<@${ids.requester}>, formulaire 2/3 complété.`)
		assert.equal((await feature.recruitmentForm3(ids.requester, {})).message, `<@${ids.requester}>, formulaire 3/3 complété.`)
	})

	it('affichent l\'erreur du forum', async () => {
		const { feature } = setup({
			recruitment: {
				part2: fail(new ForumError("L'opération ne peut pas être complétée. Le formulaire a certainement déjà été rempli. CODE R126")),
				part3: fail(new Error('inattendu')),
			},
		})
		assert.match((await feature.recruitmentForm2(ids.requester, {})).message, /CODE R126$/)
		assert.match((await feature.recruitmentForm3(ids.requester, {})).message, /^Une erreur est survenue/)
	})
})
