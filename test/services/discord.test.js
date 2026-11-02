import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDiscordService } from '../../src/services/discord.js'
import { ids } from '../support/fakes.js'

const fakeClient = () => {
	const calls = []
	const record = (kind) => async (endpoint, options) => {
		calls.push({ kind, endpoint, options })
		return { ok: true }
	}
	return { calls, requestJson: record('json'), request: record('raw') }
}

describe('service Discord', () => {
	const setup = () => {
		const client = fakeClient()
		const discord = createDiscordService({ client, appId: ids.app, guildId: ids.guild })
		return { client, discord }
	}

	it('appelle les bonnes routes de l\'API', async () => {
		const { client, discord } = setup()
		const command = { name: 'flip' }

		await discord.getMember(ids.target)
		await discord.updateMember(ids.target, { nick: 'x' })
		await discord.listMembers()
		await discord.sendMessage(ids.homeChannel, { content: 'Salut' })
		await discord.openDirectMessage(ids.target)
		await discord.listCommands()
		await discord.createCommand(command)
		await discord.editCommand('500000000000000001', command)
		await discord.deleteCommand('500000000000000001')

		assert.deepEqual(client.calls, [
			{ kind: 'json', endpoint: `guilds/${ids.guild}/members/${ids.target}`, options: undefined },
			{ kind: 'json', endpoint: `guilds/${ids.guild}/members/${ids.target}`, options: { method: 'PATCH', body: { nick: 'x' } } },
			{ kind: 'json', endpoint: `guilds/${ids.guild}/members?limit=1000`, options: undefined },
			{ kind: 'json', endpoint: `channels/${ids.homeChannel}/messages`, options: { method: 'POST', body: { content: 'Salut' } } },
			{ kind: 'json', endpoint: 'users/@me/channels', options: { method: 'POST', body: { recipient_id: ids.target } } },
			{ kind: 'json', endpoint: `applications/${ids.app}/commands`, options: undefined },
			{ kind: 'json', endpoint: `applications/${ids.app}/commands`, options: { method: 'POST', body: command } },
			{ kind: 'json', endpoint: `applications/${ids.app}/commands/500000000000000001`, options: { method: 'PATCH', body: command } },
			{ kind: 'raw', endpoint: `applications/${ids.app}/commands/500000000000000001`, options: { method: 'DELETE' } },
		])
	})

	it('refuse les identifiants qui pourraient détourner l\'URL', () => {
		const { client, discord } = setup()
		assert.throws(() => discord.getMember('../../channels/1'), TypeError)
		assert.throws(() => discord.updateMember('1/roles/2', {}), TypeError)
		assert.throws(() => discord.sendMessage(undefined, {}), /salon Discord invalide/)
		assert.throws(() => discord.openDirectMessage('abc'), TypeError)
		assert.throws(() => discord.deleteCommand('x'), TypeError)
		assert.equal(client.calls.length, 0)
	})

	it('refuse un serveur ou une application mal configurés', () => {
		const discord = createDiscordService({ client: fakeClient(), appId: '1', guildId: '' })
		assert.throws(() => discord.listMembers(), /serveur Discord invalide/)
		assert.throws(() => discord.listCommands(), /application Discord invalide/)
	})
})
