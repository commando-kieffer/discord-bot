import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { InteractionResponseType, InteractionType } from 'discord-interactions'
import { COMMAND_NAMES } from '../src/commands/definitions.js'
import { createFlows } from './support/flows.js'
import { callsOf, ids } from './support/fakes.js'

const { roles } = ids
const contentOf = (response) => response.body.data.content

// Les vraies fonctions du bot, de l'aiguillage des interactions jusqu'aux appels à Discord et au forum.
// Seuls Discord et le forum sont remplacés.
describe('parcours complet : civil, recrue, cadet', () => {
	it('suit un civil jusqu\'à cadet, avec les rôles qui changent à chaque étape', async () => {
		const flow = createFlows({ roles: [roles.civilEnAttente] })

		// 1. Un civil vient pour un test : Enrôler (recrue), sur Discord uniquement
		const enrolForm = await flow.click(COMMAND_NAMES.ENROL)
		assert.equal(enrolForm.body.type, InteractionResponseType.MODAL)
		assert.equal(enrolForm.body.data.title, 'Enrôler en recrue : mozi')
		const enrolled = await flow.submit(enrolForm.body.data, flow.rankAnswers('Kieffer', 't8', 'b2'))

		assert.equal(contentOf(enrolled), `La recrue <@${ids.target}> est assignée à la t8-b2`)
		assert.equal(flow.member.nick, 'Recrue.Kieffer-8Fsl')
		assert.deepEqual(flow.member.roles, [roles.recrue, roles.membreEquipage, roles.t8, roles.t8b2])
		assert.equal(flow.forum.link.link.mock.callCount(), 0)
		assert.equal(flow.forum.users.setRoles.mock.callCount(), 0)

		// 2. Le test lui a plu : il crée son compte forum, Lier au forum donne accès aux questionnaires
		const linkForm = await flow.click(COMMAND_NAMES.LINK_MODAL)
		assert.equal(linkForm.body.type, InteractionResponseType.MODAL)
		const linked = await flow.submit(linkForm.body.data, [flow.textRow('forum-id', '7526')])

		assert.match(contentOf(linked), /est lié au compte forum avec id=7526\nDémarrage du recrutement/)
		assert.deepEqual(callsOf(flow.forum.link.link), [[ids.target, 7526]])
		assert.deepEqual(flow.member.roles, [roles.recrue, roles.membreEquipage, roles.t8, roles.t8b2, roles.recruiting])

		// 3. Recruter (cadet) : le formulaire reprend ce que l'enrôlement a fixé
		const cadetForm = await flow.click(COMMAND_NAMES.ASSIGN_INITIAL_ROLES)
		assert.equal(cadetForm.body.type, InteractionResponseType.MODAL)
		const [name, troop, bordee] = cadetForm.body.data.components.map((row) => row.component)
		assert.equal(name.value, 'Kieffer')
		assert.equal(troop.options.find((option) => option.default).value, 't8')
		assert.equal(bordee.options.find((option) => option.default).value, 'b2')

		const recruited = await flow.submit(cadetForm.body.data, flow.rankAnswers('Kieffer', 't8', 'b2'))

		assert.equal(contentOf(recruited), `Le commando <@${ids.target}> est assigné à la t8-b2`)
		assert.equal(flow.member.nick, 'Cadet.Kieffer-8Fsl')
		assert.deepEqual(flow.member.roles, [roles.cadet, roles.membreEquipage, roles.t8, roles.t8b2])
		assert.deepEqual(callsOf(flow.forum.users.setRoles), [[ids.target, 'Kieffer', '5', ['30', '42', '39', '53']]])
	})

	it('refuse chaque étape quand le membre n\'est pas au bon stade', async () => {
		const civil = createFlows({ roles: [roles.civilEnAttente] })
		const recrue = createFlows({ roles: [roles.recrue, roles.membreEquipage, roles.t1, roles.t1b1] })
		const cadet = createFlows({ roles: [roles.cadet, roles.membreEquipage, roles.t1, roles.t1b1], nick: 'Cadet.Kieffer-1Fsl' })

		const notRecrue = `<@${ids.target}> n'est pas encore une recrue. Enrôlez-le d'abord avec « Enrôler (recrue) ».`
		assert.equal(contentOf(await civil.click(COMMAND_NAMES.LINK_MODAL)), notRecrue)
		assert.equal(contentOf(await civil.click(COMMAND_NAMES.ASSIGN_INITIAL_ROLES)), notRecrue)

		assert.equal(contentOf(await recrue.click(COMMAND_NAMES.ENROL)), `<@${ids.target}> est déjà une recrue.`)

		const alreadyCadet = `<@${ids.target}> est déjà cadet ou plus, ce n'est pas une recrue.`
		assert.equal(contentOf(await cadet.click(COMMAND_NAMES.LINK_MODAL)), alreadyCadet)
		assert.equal(contentOf(await cadet.click(COMMAND_NAMES.ASSIGN_INITIAL_ROLES)), alreadyCadet)
		assert.equal(
			contentOf(await cadet.click(COMMAND_NAMES.ENROL)),
			`<@${ids.target}> fait déjà partie du CK : seul un civil peut être enrôlé.`
		)

		for (const flow of [civil, recrue, cadet]) {
			assert.equal(flow.discord.updateMember.mock.callCount(), 0)
		}
	})

	it('relit les rôles à l\'envoi : un cadet ne peut pas être rétrogradé par un formulaire ouvert avant', async () => {
		const flow = createFlows({ roles: [roles.civilEnAttente] })
		const enrolForm = await flow.click(COMMAND_NAMES.ENROL)

		// entre l'ouverture et l'envoi, quelqu'un d'autre en a fait un cadet
		flow.member.roles = [roles.cadet, roles.membreEquipage]
		flow.member.nick = 'Cadet.Kieffer-1Fsl'

		const result = await flow.submit(enrolForm.body.data, flow.rankAnswers('Kieffer', 't1', 'b1'))
		assert.equal(contentOf(result), `<@${ids.target}> fait déjà partie du CK : seul un civil peut être enrôlé.`)
		assert.equal(flow.discord.updateMember.mock.callCount(), 0)
		assert.equal(flow.member.nick, 'Cadet.Kieffer-1Fsl')
	})
})

describe('Lier au forum, de bout en bout', () => {
	const recrueRoles = [roles.recrue, roles.membreEquipage, roles.t8, roles.t8b2]

	const linkSubmission = (forumId) => ({
		type: InteractionType.MODAL_SUBMIT,
		guild_id: ids.guild,
		member: { user: { id: ids.requester, username: 'instructeur' }, roles: [roles.instructeur] },
		data: {
			custom_id: `link-form-${ids.target}`,
			components: [
				{ type: 1, components: [{ type: 4, custom_id: 'forum-id', value: forumId }] },
				{ type: 1, components: [{ type: 4, custom_id: 'last-users', value: 'NOM = "Mozi", ID = 7526' }] },
			],
		},
	})

	it('donne le rôle de civil en recrutement à une recrue, sans lui retirer ses rôles', async () => {
		const flow = createFlows({ roles: recrueRoles })
		const { status, body } = await flow.handle(linkSubmission('7526'))

		assert.equal(status, 200)
		assert.deepEqual(callsOf(flow.forum.link.link), [[ids.target, 7526]])
		assert.deepEqual(callsOf(flow.discord.updateMember), [[ids.target, { roles: [...recrueRoles, roles.recruiting] }]])
		assert.match(body.data.content, /Démarrage du recrutement/)
	})

	it('donne le rôle même si les comptes étaient déjà liés', async () => {
		const flow = createFlows({ roles: recrueRoles, linkCreated: false })
		const { body } = await flow.handle(linkSubmission('7526'))
		assert.equal(flow.discord.updateMember.mock.callCount(), 1)
		assert.match(body.data.content, /était déjà lié au compte forum avec id=7526\nDémarrage du recrutement/)
	})

	it('ne lie rien pour un civil', async () => {
		const flow = createFlows({ roles: [roles.civilEnAttente] })
		const { body } = await flow.handle(linkSubmission('7526'))
		assert.match(body.data.content, /n'est pas encore une recrue/)
		assert.equal(flow.forum.link.link.mock.callCount(), 0)
		assert.equal(flow.discord.updateMember.mock.callCount(), 0)
	})
})
