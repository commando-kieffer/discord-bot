import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createComplaintsFeature } from '../../src/features/complaints.js'
import { ForumError } from '../../src/services/forum/errors.js'
import { callsOf, createFakeDiscord, createFakeForum, createTestLogger, ids } from '../support/fakes.js'

const setup = ({ discord = {}, complaints = {} } = {}) => {
	const fakeDiscord = createFakeDiscord(discord)
	const forum = createFakeForum({ complaints })
	const logger = createTestLogger()
	return {
		discord: fakeDiscord,
		forum,
		logger,
		feature: createComplaintsFeature({ discord: fakeDiscord, forum, logger }),
	}
}

describe('plaintes', () => {
	it('enregistre la plainte et en envoie une copie en message privé', async () => {
		const { discord, forum, feature } = setup()
		const result = await feature.sendComplaint(ids.requester, 'Le capitaine est méchant @everyone')

		assert.deepEqual(result, {
			status: 200,
			message: 'Votre plainte a bien été reçue. Une copie vous a été envoyée en message privé.',
		})
		assert.deepEqual(callsOf(forum.complaints.send), [[ids.requester, 'Le capitaine est méchant @everyone']])
		assert.deepEqual(callsOf(discord.openDirectMessage), [[ids.requester]])
		assert.deepEqual(callsOf(discord.sendMessage), [
			[
				'400000000000000001',
				{
					content: 'Votre plainte a bien été reçue.\n\n==== Votre message ====\n\n> Le capitaine est méchant @everyone',
					allowed_mentions: { parse: [] },
				},
			],
		])
	})

	it('prévient l\'auteur si la plainte n\'a pas pu être enregistrée', async () => {
		const { discord, feature } = setup({
			complaints: {
				send: async () => {
					throw new ForumError('Une erreur est survenue. CODE C24')
				},
			},
		})
		const expected =
			"Une erreur est survenue et votre plainte n'a pas pu être reçue. Veuillez réessayer plus tard et prévenir un membre de l'EM si le problème persiste."

		assert.deepEqual(await feature.sendComplaint(ids.requester, 'x'), { status: 200, message: expected })
		assert.equal(callsOf(discord.sendMessage)[0][1].content, expected)
	})

	it('confirme quand même la plainte si le message privé ne part pas', async () => {
		const { feature, logger } = setup({
			discord: {
				openDirectMessage: async () => {
					throw new Error('Cannot send messages to this user')
				},
			},
		})
		assert.deepEqual(await feature.sendComplaint(ids.requester, 'x'), { status: 200, message: 'Votre plainte a bien été reçue.' })
		assert.equal(logger.entries[0].level, 'error')
		assert.equal(logger.entries[0].context.requesterId, ids.requester)
	})
})
