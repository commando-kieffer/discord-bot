import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { InteractionResponseFlags, InteractionResponseType, InteractionType } from 'discord-interactions'
import { COMMAND_NAMES } from '../../src/commands/definitions.js'
import { COMPLAINT_FORM, COMPLAINT_FORM_ID } from '../../src/forms/complaint-form.js'
import { LINK_FORM_PREFIX } from '../../src/forms/link-form.js'
import {
	RECRUITMENT_FORM_1,
	RECRUITMENT_FORM_1_ID,
	RECRUITMENT_FORM_2,
	RECRUITMENT_FORM_2_ID,
	RECRUITMENT_FORM_3,
	RECRUITMENT_FORM_3_ID,
} from '../../src/forms/recruitment-forms.js'
import { NOT_ON_SERVER_MESSAGE, UNKNOWN_MEMBER_MESSAGE, createInteractionHandler } from '../../src/interactions/handler.js'
import { ALLOWED_MENTIONS } from '../../src/interactions/responses.js'
import { GENERIC_ERROR_MESSAGE } from '../../src/services/forum/errors.js'
import { callsOf, createTestLogger, ids, testConfig } from '../support/fakes.js'

const config = testConfig()

const result = (message) => async () => ({ status: 200, message })

const createFakeFeatures = () => ({
	fun: {
		getRandomEmoji: mock.fn(() => '🤖'),
		coinFlip: mock.fn(async () => ({ status: 200, message: "# C'est tombé sur PILE !", picture: 'piece-ck-tail.jpeg' })),
	},
	info: {
		help: mock.fn(result('aide')),
		displayGeneralInfos: mock.fn(result('infos')),
		displayWebsites: mock.fn(result('sites')),
		displaySpe: mock.fn(result('spé')),
	},
	profile: {
		getProfile: mock.fn(result('profil')),
		getUsername: mock.fn(result('pseudo')),
	},
	complaints: { sendComplaint: mock.fn(result('plainte reçue')) },
	members: {
		linkCommando: mock.fn(result('lié')),
		openLinkForm: mock.fn(async (target) => ({ custom_id: LINK_FORM_PREFIX + target, title: 'Lien', components: [] })),
		linkAndStartRecruitment: mock.fn(result('lié, recrutement lancé')),
		fireCommando: mock.fn(result('radié')),
		displayUnseenCivilians: mock.fn(result('civils')),
	},
	recruitment: {
		openEnrolForm: mock.fn((requester, target) => ({ form: { custom_id: `enrol-form-${target}`, title: 'Enrôler', components: [] } })),
		openCadetForm: mock.fn((requester, target) => ({ form: { custom_id: `cadet-form-${target}`, title: 'Recrutement', components: [] } })),
		enrolRecruit: mock.fn(result('enrôlé')),
		assignInitialRoles: mock.fn(result('assigné')),
		recruitmentForm1: mock.fn(result('1/3')),
		recruitmentForm2: mock.fn(result('2/3')),
		recruitmentForm3: mock.fn(result('3/3')),
	},
})

const setup = () => {
	const features = createFakeFeatures()
	const logger = createTestLogger()
	return { features, logger, handle: createInteractionHandler({ config, features, logger }) }
}

const member = (roles = []) => ({ user: { id: ids.requester, username: 'mozi' }, roles })

const command = (name, { roles = [], ...data } = {}) => ({
	type: InteractionType.APPLICATION_COMMAND,
	guild_id: ids.guild,
	member: member(roles),
	data: { name, ...data },
})

const submit = (customId, components = [], roles = []) => ({
	type: InteractionType.MODAL_SUBMIT,
	guild_id: ids.guild,
	member: member(roles),
	data: { custom_id: customId, components },
})

const textRow = (customId, value) => ({ type: 1, components: [{ type: 4, custom_id: customId, value }] })

const replyOf = (response) => {
	assert.equal(response.status, 200)
	assert.equal(response.body.type, InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)
	return response.body.data
}

const INSTRUCTEUR = [ids.roles.instructeur]
const EM = [ids.roles.em]
const RECRUE_EN_COURS = [ids.roles.recruiting]

describe('interactions : généralités', () => {
	it('répond au ping de Discord', async () => {
		const { handle } = setup()
		assert.deepEqual(await handle({ type: InteractionType.PING }), {
			status: 200,
			body: { type: InteractionResponseType.PONG },
		})
	})

	it('refuse un type d\'interaction non géré', async () => {
		const { handle, logger } = setup()
		const response = await handle({ type: InteractionType.MESSAGE_COMPONENT, guild_id: ids.guild, member: member() })
		assert.equal(response.status, 400)
		assert.equal(logger.entries[0].level, 'warn')
		assert.equal((await handle(undefined)).status, 400)
	})

	it('ignore les commandes lancées en message privé ou depuis un autre serveur', async () => {
		const { handle, features, logger } = setup()
		const privateMessage = { type: InteractionType.APPLICATION_COMMAND, user: { id: ids.requester }, data: { name: COMMAND_NAMES.PROFILE } }
		const otherGuild = { ...command(COMMAND_NAMES.PROFILE), guild_id: '900000000000000001' }

		assert.equal(replyOf(await handle(privateMessage)).content, NOT_ON_SERVER_MESSAGE)
		assert.equal(replyOf(await handle(otherGuild)).content, NOT_ON_SERVER_MESSAGE)
		assert.equal(features.profile.getProfile.mock.callCount(), 0)
		assert.equal(logger.entries[1].context.guildId, '900000000000000001')
	})

	it('répond à une commande inconnue', async () => {
		const { handle, logger } = setup()
		assert.equal(replyOf(await handle(command('Lancer la fusée'))).content, "Cette commande n'existe plus.")
		assert.equal(logger.entries[0].context.name, 'Lancer la fusée')
	})

	it('répond à un formulaire inconnu', async () => {
		const { handle } = setup()
		assert.equal(replyOf(await handle(submit('formulaire-mystere'))).content, "Ce formulaire n'existe plus.")
	})

	it('répond un message d\'erreur et logue l\'erreur si une commande plante', async () => {
		const { handle, features, logger } = setup()
		const error = new Error('boom')
		features.profile.getProfile.mock.mockImplementation(async () => {
			throw error
		})

		assert.equal(replyOf(await handle(command(COMMAND_NAMES.PROFILE))).content, GENERIC_ERROR_MESSAGE)
		const logged = logger.entries.find((entry) => entry.level === 'error')
		assert.equal(logged.message, 'Commande "profil" en échec')
		assert.equal(logged.context.error, error)
		assert.equal(logged.context.userId, ids.requester)
	})

	it('répond un message d\'erreur si un formulaire plante', async () => {
		const { handle, features, logger } = setup()
		features.recruitment.recruitmentForm2.mock.mockImplementation(async () => {
			throw new Error('boom')
		})
		assert.equal(replyOf(await handle(submit(RECRUITMENT_FORM_2_ID, [], RECRUE_EN_COURS))).content, GENERIC_ERROR_MESSAGE)
		assert.match(logger.entries.at(-1).message, /recruitment-form-2/)
	})

	it('empêche toute réponse de notifier @everyone ou un rôle', async () => {
		const { handle } = setup()
		assert.deepEqual(replyOf(await handle(command(COMMAND_NAMES.HELP))).allowed_mentions, ALLOWED_MENTIONS)
		assert.deepEqual(ALLOWED_MENTIONS, { parse: ['users'] })
	})
})

describe('interactions : commandes pour tous', () => {
	it('/coucou', async () => {
		const { handle } = setup()
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.TEST))).content, '**Bonjour**,\nje suis le BOT du commando Kieffer 🤖')
	})

	it('/flip affiche la pièce', async () => {
		const { handle } = setup()
		const data = replyOf(await handle(command(COMMAND_NAMES.COIN_FLIP)))
		assert.equal(data.content, "# C'est tombé sur PILE !")
		assert.deepEqual(data.embeds, [{ image: { url: 'https://discord.commandokieffer.com/public/pictures/piece-ck-tail.jpeg' } }])
	})

	it('commandes d\'information', async () => {
		const { handle } = setup()
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.HELP))).content, 'aide')
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.INFOS_GENERALES))).content, 'infos')
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.INFOS_SITES))).content, 'sites')
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.INFOS_SPE))).content, 'spé')
	})

	it('/profil', async () => {
		const { handle, features } = setup()
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.PROFILE))).content, 'profil')
		assert.deepEqual(callsOf(features.profile.getProfile), [[ids.requester]])
	})

	it('Donne le pseudo', async () => {
		const { handle, features } = setup()
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.GET_USERNAME, { target_id: ids.target }))).content, 'pseudo')
		assert.deepEqual(callsOf(features.profile.getUsername), [[ids.requester, ids.target]])
	})

	it('refuse une action sur un membre dont l\'identifiant est invalide', async () => {
		const { handle, features } = setup()
		const response = await handle(command(COMMAND_NAMES.GET_USERNAME, { target_id: '../../roles' }))
		assert.equal(replyOf(response).content, UNKNOWN_MEMBER_MESSAGE)
		assert.equal(features.profile.getUsername.mock.callCount(), 0)
	})

	it('/plainte ouvre le formulaire, et l\'envoi répond uniquement à son auteur', async () => {
		const { handle, features } = setup()
		assert.deepEqual(await handle(command(COMMAND_NAMES.COMPLAINT)), {
			status: 200,
			body: { type: InteractionResponseType.MODAL, data: COMPLAINT_FORM },
		})

		const data = replyOf(await handle(submit(COMPLAINT_FORM_ID, [textRow('complaint_message', 'Le capitaine est méchant')])))
		assert.equal(data.content, 'plainte reçue')
		assert.equal(data.flags, InteractionResponseFlags.EPHEMERAL)
		assert.deepEqual(callsOf(features.complaints.sendComplaint), [[ids.requester, 'Le capitaine est méchant']])
	})
})

describe('interactions : questionnaires de recrutement', () => {
	it('ouvrent les formulaires pour les civils en recrutement', async () => {
		const { handle } = setup()
		for (const [name, form] of [
			[COMMAND_NAMES.RECRUITMENT_FORM_1, RECRUITMENT_FORM_1],
			[COMMAND_NAMES.RECRUITMENT_FORM_2, RECRUITMENT_FORM_2],
			[COMMAND_NAMES.RECRUITMENT_FORM_3, RECRUITMENT_FORM_3],
		]) {
			assert.deepEqual((await handle(command(name, { roles: RECRUE_EN_COURS }))).body, { type: InteractionResponseType.MODAL, data: form })
		}
	})

	it('sont refusés aux autres', async () => {
		const { handle } = setup()
		const data = replyOf(await handle(command(COMMAND_NAMES.RECRUITMENT_FORM_1, { roles: [ids.roles.em] })))
		assert.equal(data.content, "Vous n'avez pas la permission d'éxécuter cette commande.")
	})

	it('transmettent les réponses, avec l\'identité Discord de l\'auteur', async () => {
		const { handle, features } = setup()
		const components = [textRow('commando_name', 'Kieffer'), textRow('discord_id', '100000000000000666')]
		assert.equal(replyOf(await handle(submit(RECRUITMENT_FORM_1_ID, components, RECRUE_EN_COURS))).content, '1/3')
		assert.deepEqual(callsOf(features.recruitment.recruitmentForm1), [
			[ids.requester, { commando_name: 'Kieffer', discord_id: ids.requester, discord_username: 'mozi' }],
		])

		await handle(submit(RECRUITMENT_FORM_2_ID, [textRow('can_pay', 'O')], RECRUE_EN_COURS))
		assert.deepEqual(callsOf(features.recruitment.recruitmentForm2), [[ids.requester, { can_pay: 'O' }]])

		await handle(submit(RECRUITMENT_FORM_3_ID, [textRow('skills_dev', 'N')], RECRUE_EN_COURS))
		assert.deepEqual(callsOf(features.recruitment.recruitmentForm3), [[ids.requester, { skills_dev: 'N' }]])
	})

	it('vérifient à nouveau les droits à l\'envoi', async () => {
		const { handle, features } = setup()
		const data = replyOf(await handle(submit(RECRUITMENT_FORM_1_ID, [textRow('commando_name', 'x')])))
		assert.equal(data.content, "Vous n'avez pas la permission d'éxécuter cette commande.")
		assert.equal(features.recruitment.recruitmentForm1.mock.callCount(), 0)
	})
})

describe('interactions : instructeurs, QM et EM', () => {
	it('Lier au forum ouvre le formulaire, et son envoi lie les comptes et lance le recrutement', async () => {
		const { handle, features } = setup()
		const response = await handle(command(COMMAND_NAMES.LINK_MODAL, { target_id: ids.target, roles: INSTRUCTEUR }))
		assert.equal(response.body.type, InteractionResponseType.MODAL)
		assert.equal(response.body.data.custom_id, LINK_FORM_PREFIX + ids.target)

		const data = replyOf(await handle(submit(LINK_FORM_PREFIX + ids.target, [textRow('forum-id', '7526')], INSTRUCTEUR)))
		assert.equal(data.content, 'lié, recrutement lancé')
		assert.deepEqual(callsOf(features.members.linkAndStartRecruitment), [[ids.requester, ids.target, '7526']])
	})

	it('le formulaire de lien refuse un membre invalide ou un envoi non autorisé', async () => {
		const { handle, features } = setup()
		assert.equal(replyOf(await handle(submit(`${LINK_FORM_PREFIX}../x`, [], INSTRUCTEUR))).content, UNKNOWN_MEMBER_MESSAGE)
		assert.equal(
			replyOf(await handle(submit(LINK_FORM_PREFIX + ids.target, [textRow('forum-id', '1')], []))).content,
			"Vous n'avez pas les autorisations nécessaires"
		)
		assert.equal(features.members.linkAndStartRecruitment.mock.callCount(), 0)
	})

	it('/lien lie les comptes à partir des options', async () => {
		const { handle, features } = setup()
		const options = [
			{ name: 'id-forum', type: 4, value: 7526 },
			{ name: 'commando', type: 6, value: ids.target },
		]
		await handle(command(COMMAND_NAMES.LINK, { options, roles: INSTRUCTEUR }))
		assert.deepEqual(callsOf(features.members.linkCommando), [[ids.requester, [ids.target, 7526]]])
	})

	it('« Lancer le recrutement » et /recrutement n\'existent plus', async () => {
		const { handle } = setup()
		const old = command('Lancer le recrutement', { target_id: ids.target, roles: INSTRUCTEUR })
		assert.equal(replyOf(await handle(old)).content, "Cette commande n'existe plus.")
		assert.equal(replyOf(await handle(command('recrutement', { options: [], roles: INSTRUCTEUR }))).content, "Cette commande n'existe plus.")
	})

	it('/civils-non-vus', async () => {
		const { handle } = setup()
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.CIVILS_NON_VUS, { roles: [ids.roles.qm1] }))).content, 'civils')
	})

	const resolved = {
		users: { [ids.target]: { id: ids.target, username: 'mozi' } },
		members: { [ids.target]: { nick: 'Recrue.Kieffer-8Fsl', roles: [ids.roles.recrue] } },
	}

	const rankForm = (nom, troop, bordee) => [
		{ type: 18, component: { type: 4, custom_id: 'commando_name', value: nom } },
		{ type: 18, component: { type: 3, custom_id: 'troop', values: [troop] } },
		{ type: 18, component: { type: 3, custom_id: 'bordee', values: [bordee] } },
	]

	it('Enrôler ouvre le formulaire avec le membre ciblé, et son envoi enrôle la recrue', async () => {
		const { handle, features } = setup()
		const response = await handle(command(COMMAND_NAMES.ENROL, { target_id: ids.target, resolved, roles: [ids.roles.recruteur] }))
		assert.equal(response.body.type, InteractionResponseType.MODAL)
		assert.equal(response.body.data.custom_id, `enrol-form-${ids.target}`)
		assert.deepEqual(callsOf(features.recruitment.openEnrolForm), [
			[ids.requester, ids.target, { nick: 'Recrue.Kieffer-8Fsl', roles: [ids.roles.recrue], user: { id: ids.target, username: 'mozi' } }],
		])

		const data = replyOf(await handle(submit(`enrol-form-${ids.target}`, rankForm('Kieffer', 't8', 'b2'), INSTRUCTEUR)))
		assert.equal(data.content, 'enrôlé')
		assert.deepEqual(callsOf(features.recruitment.enrolRecruit), [[ids.requester, [ids.target, 'Kieffer', 't8', 'b2']]])
	})

	it('Recrutement ouvre le formulaire pré-rempli, et son envoi fait passer la recrue cadet', async () => {
		const { handle, features } = setup()
		const response = await handle(command(COMMAND_NAMES.ASSIGN_INITIAL_ROLES, { target_id: ids.target, resolved, roles: [ids.roles.qm2] }))
		assert.equal(response.body.data.custom_id, `cadet-form-${ids.target}`)
		assert.equal(callsOf(features.recruitment.openCadetForm)[0][2].nick, 'Recrue.Kieffer-8Fsl')

		replyOf(await handle(submit(`cadet-form-${ids.target}`, rankForm('Kieffer', 't1', 'b1'), EM)))
		assert.deepEqual(callsOf(features.recruitment.assignInitialRoles), [[ids.requester, [ids.target, 'Kieffer', 't1', 'b1']]])
	})

	it('affiche le refus au lieu du formulaire (membre protégé)', async () => {
		const { handle, features } = setup()
		features.recruitment.openCadetForm.mock.mockImplementation(() => ({ status: 200, message: '**Action prohibée**' }))
		const response = await handle(command(COMMAND_NAMES.ASSIGN_INITIAL_ROLES, { target_id: ids.protected, roles: EM }))
		assert.equal(replyOf(response).content, '**Action prohibée**')
	})

	it('Enrôler fonctionne sans données sur le membre ciblé', async () => {
		const { handle, features } = setup()
		await handle(command(COMMAND_NAMES.ENROL, { target_id: ids.target, roles: INSTRUCTEUR }))
		assert.deepEqual(callsOf(features.recruitment.openEnrolForm)[0][2], { user: undefined })
	})

	it('les formulaires Enrôler et Recrutement vérifient les droits et le membre à l\'envoi', async () => {
		const { handle, features } = setup()
		const cadet = [ids.roles.cadet]
		const denied = "Vous n'avez pas la permission d'éxécuter cette commande."
		assert.equal(replyOf(await handle(submit(`enrol-form-${ids.target}`, rankForm('Kieffer', 't1', 'b1'), cadet))).content, denied)
		assert.equal(replyOf(await handle(submit(`cadet-form-${ids.target}`, rankForm('Kieffer', 't1', 'b1'), cadet))).content, denied)
		assert.equal(replyOf(await handle(submit('cadet-form-12', rankForm('Kieffer', 't1', 'b1'), EM))).content, UNKNOWN_MEMBER_MESSAGE)
		assert.equal(features.recruitment.enrolRecruit.mock.callCount(), 0)
		assert.equal(features.recruitment.assignInitialRoles.mock.callCount(), 0)
	})

	it('Radier est réservé à l\'État-Major', async () => {
		const { handle, features } = setup()
		assert.equal(
			replyOf(await handle(command(COMMAND_NAMES.FIRE, { target_id: ids.target, roles: [ids.roles.qm1] }))).content,
			"Vous n'êtes pas membre de l'État-Major"
		)
		assert.equal(replyOf(await handle(command(COMMAND_NAMES.FIRE, { target_id: ids.target, roles: EM }))).content, 'radié')
		assert.deepEqual(callsOf(features.members.fireCommando), [[ids.requester, ids.target]])
	})

	it('les commandes d\'instructeur sont refusées aux autres membres, et le refus est logué', async () => {
		const { handle, features, logger } = setup()
		const cadet = [ids.roles.cadet]
		const cases = [
			[command(COMMAND_NAMES.LINK_MODAL, { target_id: ids.target, roles: cadet }), "Vous n'avez pas les autorisations nécessaires"],
			[command(COMMAND_NAMES.LINK, { options: [], roles: cadet }), "Vous n'avez pas les autorisations nécessaires"],
			[command(COMMAND_NAMES.CIVILS_NON_VUS, { roles: cadet }), "Vous n'avez pas la permission d'exécuter cette commande"],
			[command(COMMAND_NAMES.ENROL, { target_id: ids.target, roles: cadet }), "Vous n'avez pas la permission d'éxécuter cette commande."],
			[command(COMMAND_NAMES.ASSIGN_INITIAL_ROLES, { target_id: ids.target, roles: cadet }), "Vous n'avez pas la permission d'éxécuter cette commande."],
		]
		for (const [interaction, expected] of cases) {
			assert.equal(replyOf(await handle(interaction)).content, expected)
		}
		for (const fn of [...Object.values(features.members), ...Object.values(features.recruitment)]) {
			assert.equal(fn.mock.callCount(), 0)
		}
		assert.equal(logger.entries.filter((entry) => entry.message === 'Accès refusé').length, cases.length)
	})
})
