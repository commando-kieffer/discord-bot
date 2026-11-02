import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { InteractionResponseType, InteractionType } from 'discord-interactions'
import { COMMAND_NAMES } from '../src/commands/definitions.js'
import { createContainer } from '../src/container.js'
import { loadContent } from '../src/content.js'
import { createTestLogger, ids, testConfig } from './support/fakes.js'

describe('assemblage du bot', () => {
	it('construit un bot qui répond aux commandes sans appel extérieur', async () => {
		const container = createContainer({ config: testConfig(), content: loadContent(), logger: createTestLogger() })

		assert.equal(typeof container.registry.HasGuildCommands, 'function')
		const response = await container.handleInteraction({
			type: InteractionType.APPLICATION_COMMAND,
			guild_id: ids.guild,
			member: { user: { id: ids.requester }, roles: [] },
			data: { name: COMMAND_NAMES.INFOS_SPE },
		})

		assert.equal(response.status, 200)
		assert.equal(response.body.type, InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)
		assert.match(response.body.data.content, /spé/)
		await container.db.close()
	})
})
