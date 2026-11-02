import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DiscordApiError } from '../../src/clients/discord.js'
import { createMembersFeature } from '../../src/features/members.js'
import { LINK_FORM_PREFIX } from '../../src/forms/link-form.js'
import { buildFormerNick } from '../../src/ranks.js'
import { ForumError } from '../../src/services/forum/errors.js'
import { callsOf, createFakeDiscord, createFakeForum, createTestLogger, ids, testConfig } from '../support/fakes.js'

const config = testConfig()
const NOW = new Date('2026-11-03T12:00:00.000Z')

const setup = ({ discord = {}, users = {}, link = {} } = {}) => {
	const fakeDiscord = createFakeDiscord(discord)
	const forum = createFakeForum({ users, link })
	const logger = createTestLogger()
	const members = createMembersFeature({ discord: fakeDiscord, forum, config, logger, now: () => NOW })
	return { discord: fakeDiscord, forum, logger, members }
}

const discordError = (status = 403) =>
	new DiscordApiError({ method: 'PATCH', endpoint: 'x', status, body: { message: 'Missing Permissions', code: 50013 } })

describe('lier au forum', () => {
	it('lie le compte Discord au compte forum', async () => {
		const { forum, members, logger } = setup()
		assert.deepEqual(await members.linkCommando(ids.requester, [ids.target, '7526']), {
			status: 200,
			message: `Le commando <@${ids.target}> est lié au compte forum avec id=7526`,
		})
		assert.deepEqual(callsOf(forum.link.link), [[ids.target, 7526]])
		assert.equal(logger.entries[0].level, 'info')
	})

	it('accepte l\'ID forum en nombre (commande /lien)', async () => {
		const { forum, members } = setup()
		await members.linkCommando(ids.requester, [ids.target, 7526])
		assert.deepEqual(callsOf(forum.link.link), [[ids.target, 7526]])
	})

	it('explique pourquoi le lien a échoué', async () => {
		const { members } = setup({
			link: {
				link: async () => {
					throw new ForumError('Le compte forum 7526 est déjà lié à un autre compte Discord. CODE L31')
				},
			},
		})
		const { message } = await members.linkCommando(ids.requester, [ids.target, '7526'])
		assert.equal(
			message,
			`Le commando <@${ids.target}> n'a pas pu être lié au compte forum avec id=7526.\nLe compte forum 7526 est déjà lié à un autre compte Discord. CODE L31`
		)
	})

	it('refuse un ID forum qui n\'est pas un nombre', async () => {
		const { forum, members } = setup()
		const { message } = await members.linkCommando(ids.requester, [ids.target, '12; DROP'])
		assert.match(message, /L'ID forum doit être un nombre/)
		assert.equal(forum.link.link.mock.callCount(), 0)
	})

	it('ouvre le formulaire avec les derniers inscrits du forum', async () => {
		const { members } = setup({ users: { last: async () => [{ user_id: 7526, username: 'MoziSkync' }] } })
		const form = await members.openLinkForm(ids.target)
		assert.equal(form.custom_id, LINK_FORM_PREFIX + ids.target)
		assert.equal(form.components[1].components[0].value, 'NOM = "MoziSkync", ID = 7526')
	})

	it('ouvre le formulaire même si la liste des inscrits est indisponible', async () => {
		const { members } = setup({
			users: {
				last: async () => {
					throw new ForumError('Erreur de connexion à la base de données. CODE U52')
				},
			},
		})
		const form = await members.openLinkForm(ids.target)
		assert.equal(form.components[1].components[0].value, '')
	})
})

describe('lancer le recrutement', () => {
	it('donne le rôle de civil en recrutement', async () => {
		const { discord, members } = setup()
		assert.deepEqual(await members.startRecruitment(ids.requester, ids.target), {
			status: 200,
			message: `Démarrage du recrutement de <@${ids.target}>`,
		})
		assert.deepEqual(callsOf(discord.updateMember), [[ids.target, { roles: [ids.roles.recruiting] }]])
	})

	it('refuse pour un membre protégé', async () => {
		const { discord, members } = setup()
		const { message } = await members.startRecruitment(ids.requester, ids.protected)
		assert.match(message, /^\*\*Action prohibée\*\*/)
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('prévient si Discord refuse', async () => {
		const { members, logger } = setup({
			discord: {
				updateMember: async () => {
					throw discordError()
				},
			},
		})
		assert.deepEqual(await members.startRecruitment(ids.requester, ids.target), {
			status: 200,
			message: `Le recrutement de <@${ids.target}> n'a pas pu être lancé.`,
		})
		assert.equal(logger.entries[0].level, 'error')
	})
})

describe('radier', () => {
	const member = { nick: 'Cadet.Kieffer-1Fsl', joined_at: '2024-01-02T10:00:00.000Z', roles: [ids.roles.cadet] }

	it('renomme, retire les rôles et passe le compte forum en civil', async () => {
		const { discord, forum, members } = setup({ discord: { getMember: async () => member } })
		const nick = buildFormerNick('Kieffer', member.joined_at)

		assert.deepEqual(await members.fireCommando(ids.requester, ids.target), {
			status: 200,
			message: `Le commando <@${ids.target}> a été radié`,
		})
		assert.deepEqual(callsOf(discord.getMember), [[ids.target]])
		assert.deepEqual(callsOf(discord.updateMember), [[ids.target, { nick, roles: [ids.roles.ancienCommando] }]])
		assert.deepEqual(callsOf(forum.users.setRoles), [[ids.target, nick, '2', []]])
	})

	it('refuse de radier un membre protégé ou sans identifiant', async () => {
		const { discord, members } = setup()
		assert.equal(
			(await members.fireCommando(ids.requester, ids.protected)).message,
			`**Action prohibée** : <@${ids.requester}> a tenté de radier <@${ids.protected}>`
		)
		await members.fireCommando(ids.requester, undefined)
		assert.equal(discord.getMember.mock.callCount(), 0)
	})

	it('ne touche à rien si le nom de commando est introuvable dans le pseudo', async () => {
		const { discord, members } = setup({ discord: { getMember: async () => ({ ...member, nick: null }) } })
		const { message } = await members.fireCommando(ids.requester, ids.target)
		assert.match(message, /Impossible de retrouver le nom de commando.*aucun pseudo.*Rien n'a été modifié/)
		assert.equal(discord.updateMember.mock.callCount(), 0)
	})

	it('prévient si le membre est introuvable', async () => {
		const { members } = setup({
			discord: {
				getMember: async () => {
					throw discordError(404)
				},
			},
		})
		assert.match((await members.fireCommando(ids.requester, ids.target)).message, /Impossible de récupérer le profil Discord/)
	})

	it('ne touche pas au forum si Discord refuse', async () => {
		const { forum, members } = setup({
			discord: {
				getMember: async () => member,
				updateMember: async () => {
					throw discordError()
				},
			},
		})
		assert.match((await members.fireCommando(ids.requester, ids.target)).message, /n'a pas pu être radié sur Discord/)
		assert.equal(forum.users.setRoles.mock.callCount(), 0)
	})

	it('signale une radiation faite sur Discord mais pas sur le forum', async () => {
		const { members } = setup({
			discord: { getMember: async () => member },
			users: {
				setRoles: async () => {
					throw new ForumError("Aucun compte forum n'est lié à ce compte Discord. CODE U32")
				},
			},
		})
		assert.equal(
			(await members.fireCommando(ids.requester, ids.target)).message,
			`Le commando <@${ids.target}> a été radié sur Discord, mais pas sur le forum.\nAucun compte forum n'est lié à ce compte Discord. CODE U32`
		)
	})
})

describe('civils non vus', () => {
	const civilian = (id, joinedAt, roles = [ids.roles.civilEnAttente]) => ({
		user: { id },
		joined_at: joinedAt,
		roles,
	})

	it('liste les civils en attente depuis plus de 2 jours', async () => {
		const old = '2026-10-20T08:30:00.000Z'
		const { members, discord } = setup({
			discord: {
				listMembers: async () => [
					civilian('100000000000000010', old),
					civilian('100000000000000011', '2026-11-02T12:00:00.000Z'),
					civilian('100000000000000012', old, [ids.roles.cadet]),
				],
			},
		})
		const joinedAt = new Date(old)

		assert.deepEqual(await members.displayUnseenCivilians(), {
			status: 200,
			message: `***Liste des civils non vus (limite : 25)***\n\n<@100000000000000010> - a rejoint le Discord le **${joinedAt.toLocaleDateString('fr')}** à ${joinedAt.toLocaleTimeString('fr')}`,
		})
		assert.deepEqual(callsOf(discord.listMembers), [[1000]])
	})

	it('s\'arrête à 25 civils pour que le message passe', async () => {
		const list = Array.from({ length: 30 }, (_, i) => civilian(String(100000000000000100n + BigInt(i)), '2026-01-01T00:00:00.000Z'))
		const { members } = setup({ discord: { listMembers: async () => list } })
		const { message } = await members.displayUnseenCivilians()
		assert.equal(message.match(/a rejoint le Discord/g).length, 25)
	})

	it('le dit quand il n\'y a personne', async () => {
		const { members } = setup()
		assert.equal((await members.displayUnseenCivilians()).message, 'Aucun civil en attente depuis plus de 2 jours.')
	})

	it('prévient si la liste des membres est indisponible', async () => {
		const { members, logger } = setup({
			discord: {
				listMembers: async () => {
					throw discordError(500)
				},
			},
		})
		assert.equal((await members.displayUnseenCivilians()).message, 'Impossible de récupérer la liste des membres du serveur.')
		assert.equal(logger.entries[0].level, 'error')
	})
})
