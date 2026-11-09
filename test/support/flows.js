import { InteractionType } from 'discord-interactions'
import { createMembersFeature } from '../../src/features/members.js'
import { createRecruitmentFeature } from '../../src/features/recruitment.js'
import { createInteractionHandler } from '../../src/interactions/handler.js'
import { createFakeDiscord, createFakeForum, createTestLogger, ids, testConfig } from './fakes.js'

const unused = new Proxy({}, {
	get: () => () => {
		throw new Error('fonctionnalité non utilisée dans ce test')
	},
})

// Assemble les vraies fonctionnalités de membres et de recrutement derrière le vrai aiguillage.
// Le membre ciblé est un état partagé : ce que le bot change sur Discord est vu par les étapes suivantes.
export function createFlows({ roles = [], nick = null, linkCreated = true, forumUsers = {} } = {}) {
	const config = testConfig()
	const logger = createTestLogger()
	const member = { nick, roles }

	const discord = createFakeDiscord({
		getMember: async () => ({ ...member, joined_at: '2024-01-02T10:00:00.000Z' }),
		updateMember: async (userId, body) => {
			if (body.nick !== undefined) member.nick = body.nick
			if (body.roles !== undefined) member.roles = body.roles
			return {}
		},
	})
	const forum = createFakeForum({ link: { link: async () => linkCreated }, users: forumUsers })

	const features = {
		fun: unused,
		info: unused,
		profile: unused,
		complaints: unused,
		members: createMembersFeature({ discord, forum, config, logger }),
		recruitment: createRecruitmentFeature({ discord, forum, config, logger }),
	}
	const handler = createInteractionHandler({ config, features, logger })

	const requester = { user: { id: ids.requester, username: 'instructeur' }, roles: [ids.roles.instructeur] }

	// Clic droit sur le membre : Discord joint ses rôles et son pseudo actuels à l'interaction
	const click = (name) =>
		handler({
			type: InteractionType.APPLICATION_COMMAND,
			guild_id: ids.guild,
			member: requester,
			data: {
				name,
				target_id: ids.target,
				resolved: {
					users: { [ids.target]: { id: ids.target, username: 'mozi' } },
					members: { [ids.target]: { nick: member.nick, roles: [...member.roles] } },
				},
			},
		})

	const textRow = (customId, value) => ({ type: 1, components: [{ type: 4, custom_id: customId, value }] })
	const label = (component) => ({ type: 18, component })

	// Envoi d'un formulaire ouvert par `click` (même identifiant que celui du formulaire affiché)
	const submit = (form, components) =>
		handler({
			type: InteractionType.MODAL_SUBMIT,
			guild_id: ids.guild,
			member: requester,
			data: { custom_id: form.custom_id, components },
		})

	const rankAnswers = (nom, troop, bordee) => [
		label({ type: 4, custom_id: 'commando_name', value: nom }),
		label({ type: 3, custom_id: 'troop', values: [troop] }),
		label({ type: 3, custom_id: 'bordee', values: [bordee] }),
	]

	return { handler, handle: handler, discord, forum, logger, member, click, submit, textRow, rankAnswers, requester }
}
