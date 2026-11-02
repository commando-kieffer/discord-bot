import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as definitions from '../../src/commands/definitions.js'

const { COMMAND_NAMES, COMMAND_TYPE, REGISTERED_COMMANDS, REMOVED_COMMANDS } = definitions

const allCommands = Object.entries(definitions)
	.filter(([name]) => name.endsWith('_COMMAND'))
	.map(([, command]) => command)

describe('définitions des commandes', () => {
	it('chaque nom de commande a sa définition', () => {
		const defined = allCommands.map((command) => command.name).sort()
		assert.deepEqual(defined, Object.values(COMMAND_NAMES).sort())
	})

	it('respecte les règles de Discord', () => {
		for (const command of allCommands) {
			assert.ok(Object.values(COMMAND_TYPE).includes(command.type), command.name)
			assert.ok(command.name.length >= 1 && command.name.length <= 32, command.name)

			if (command.type === COMMAND_TYPE.CHAT_INPUT) {
				// commande slash : nom en minuscules sans espace, description obligatoire
				assert.match(command.name, /^[-_\p{Ll}\p{N}]{1,32}$/u, command.name)
				assert.ok(command.description.length >= 1 && command.description.length <= 100, command.name)
			} else {
				// action sur un membre : pas de description ni d'options
				assert.equal(command.description, undefined, command.name)
				assert.equal(command.options, undefined, command.name)
			}

			for (const option of command.options ?? []) {
				assert.match(option.name, /^[-_\p{Ll}\p{N}]{1,32}$/u)
				assert.ok(option.description.length <= 100)
				assert.ok((option.choices ?? []).length <= 25)
			}
		}
	})

	it('n\'enregistre pas deux fois la même commande', () => {
		const keys = REGISTERED_COMMANDS.map((command) => `${command.type}:${command.name}`)
		assert.equal(new Set(keys).size, keys.length)
	})

	it('ne supprime pas une commande encore enregistrée', () => {
		const registered = new Set(REGISTERED_COMMANDS.map((command) => `${command.type}:${command.name}`))
		for (const command of REMOVED_COMMANDS) {
			assert.ok(!registered.has(`${command.type}:${command.name}`), command.name)
		}
	})
})
