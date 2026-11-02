import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCommandRegistry, needsUpdate } from '../../src/commands/registry.js'
import { callsOf, createFakeDiscord, createTestLogger, ids } from '../support/fakes.js'

const flip = { name: 'flip', description: 'Pile ou face', type: 1 }
const radier = { name: 'Radier', type: 2 }
const lien = {
	name: 'lien',
	description: 'Lien',
	type: 1,
	options: [{ type: 6, name: 'commando', description: 'Commando', required: true }],
}

// Ce que Discord renvoie pour une commande installée : nos champs, plus les siens
const installed = (command, id) => ({
	id,
	application_id: ids.app,
	version: '1',
	default_member_permissions: null,
	dm_permission: true,
	description: '',
	...command,
	options: command.options?.map((option) => ({ ...option, required: option.required ?? undefined })),
})

const setup = (existing = [], overrides = {}) => {
	const discord = createFakeDiscord({ listCommands: async () => existing, ...overrides })
	const logger = createTestLogger()
	return { discord, logger, registry: createCommandRegistry({ discord, logger }) }
}

describe('needsUpdate', () => {
	it('ignore les champs ajoutés par Discord', () => {
		assert.equal(needsUpdate(installed(flip, '1'), flip), false)
		assert.equal(needsUpdate(installed(radier, '2'), radier), false)
		assert.equal(needsUpdate(installed(lien, '3'), lien), false)
	})

	it('détecte un changement de description, de type ou d\'options', () => {
		assert.equal(needsUpdate(installed(flip, '1'), { ...flip, description: 'Pile ou face ?' }), true)
		assert.equal(needsUpdate(installed(radier, '2'), { ...radier, type: 1 }), true)
		const withChoice = { ...lien, options: [{ ...lien.options[0], choices: [{ name: 'T1', value: 't1' }] }] }
		assert.equal(needsUpdate(installed(lien, '3'), withChoice), true)
		assert.equal(needsUpdate(installed(lien, '3'), { ...lien, options: [] }), true)
	})

	it('considère required absent comme false', () => {
		const optional = { ...lien, options: [{ ...lien.options[0], required: false }] }
		const fromDiscord = { ...lien, options: [{ type: 6, name: 'commando', description: 'Commando' }] }
		assert.equal(needsUpdate(fromDiscord, optional), false)
	})
})

describe('enregistrement des commandes', () => {
	it('installe uniquement les commandes manquantes', async () => {
		const { discord, registry } = setup([installed(flip, '500000000000000001')])
		await registry.HasGuildCommands(ids.app, ids.guild, [flip, radier])
		assert.deepEqual(callsOf(discord.createCommand), [[radier]])
		assert.equal(discord.editCommand.mock.callCount(), 0)
	})

	it('met à jour une commande dont la définition a changé', async () => {
		const { discord, registry } = setup([installed(flip, '500000000000000001')])
		const changed = { ...flip, description: 'Pile ou face, au hasard' }
		await registry.HasGuildCommands(ids.app, ids.guild, [changed])
		assert.deepEqual(callsOf(discord.editCommand), [['500000000000000001', changed]])
	})

	it('distingue une commande slash d\'une action portant le même nom', async () => {
		const slash = { name: 'recrutement', description: 'x', type: 1 }
		const action = { name: 'recrutement', type: 2 }
		const { discord, registry } = setup([installed(slash, '500000000000000001')])
		await registry.HasGuildCommands(ids.app, ids.guild, [action], [slash])
		assert.deepEqual(callsOf(discord.createCommand), [[action]])
		assert.deepEqual(callsOf(discord.deleteCommand), [['500000000000000001']])
	})

	it('supprime les commandes retirées, seulement si elles sont installées', async () => {
		const { discord, registry } = setup([installed(radier, '500000000000000002')])
		await registry.HasGuildCommands(ids.app, ids.guild, [], [radier, { name: 'Absente', type: 2 }])
		assert.deepEqual(callsOf(discord.deleteCommand), [['500000000000000002']])
	})

	it('continue après l\'échec d\'une commande et logue l\'erreur', async () => {
		let calls = 0
		const { discord, registry, logger } = setup([], {
			createCommand: async () => {
				if (calls++ === 0) throw new Error('rate limited')
				return {}
			},
		})
		await registry.HasGuildCommands(ids.app, ids.guild, [flip, radier])
		assert.equal(discord.createCommand.mock.callCount(), 2)
		const errors = logger.entries.filter((entry) => entry.level === 'error')
		assert.equal(errors.length, 1)
		assert.match(errors[0].message, /flip/)
	})

	it('logue l\'échec d\'une suppression sans s\'arrêter', async () => {
		const { registry, logger } = setup([installed(radier, '500000000000000002')], {
			deleteCommand: async () => {
				throw new Error('boom')
			},
		})
		await registry.HasGuildCommands(ids.app, ids.guild, [], [radier])
		assert.match(logger.entries.find((entry) => entry.level === 'error').message, /Radier/)
	})

	it('abandonne si la liste des commandes installées est inaccessible', async () => {
		const { discord, registry, logger } = setup([], {
			listCommands: async () => {
				throw new Error('401 Unauthorized')
			},
		})
		await registry.HasGuildCommands(ids.app, ids.guild, [flip])
		assert.equal(discord.createCommand.mock.callCount(), 0)
		assert.equal(logger.entries[0].level, 'error')
	})

	it('ne fait rien sans application ou sans serveur', async () => {
		const { discord, registry } = setup()
		await registry.HasGuildCommands('', ids.guild, [flip])
		await registry.HasGuildCommands(ids.app, '', [flip])
		assert.equal(discord.listCommands.mock.callCount(), 0)
	})
})
