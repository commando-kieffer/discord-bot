import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COMMAND_NAMES, REGISTERED_COMMANDS } from '../../src/commands/definitions.js'
import { loadContent } from '../../src/content.js'
import { createInfoFeature } from '../../src/features/info.js'

const content = {
	game: 'Battlefield 6',
	links: {},
	websites: [
		{
			title: 'Les sites',
			groups: [
				[
					{ label: 'Le panel', url: 'https://zeus.commandokieffer.com' },
					{ label: 'La boutique', url: 'https://boutique.commandokieffer.com' },
				],
				[{ label: 'Le forum', url: 'https://forum.commandokieffer.com' }],
			],
		},
		{ title: 'Ressources', groups: [[{ label: 'Grades', url: 'https://forum.commandokieffer.com/grades' }]] },
	],
	spe: ['# __La spé__', '', '**Arme :** Fusil'],
}

describe('infos', () => {
	const info = createInfoFeature({ content })

	it('affiche les sites par section et par groupe', async () => {
		assert.deepEqual(await info.displayWebsites(), {
			status: 200,
			message:
				'\n**__Les sites__**\n\nLe panel : https://zeus.commandokieffer.com\nLa boutique : https://boutique.commandokieffer.com\n\nLe forum : https://forum.commandokieffer.com\n\n**__Ressources__**\n\nGrades : https://forum.commandokieffer.com/grades\n',
		})
	})

	it('affiche la spé ligne par ligne', async () => {
		assert.deepEqual(await info.displaySpe(), { status: 200, message: '\n# __La spé__\n\n**Arme :** Fusil\n' })
	})

	it('affiche les informations générales', async () => {
		const { status, message } = await info.displayGeneralInfos()
		assert.equal(status, 200)
		assert.match(message, /Information générales/)
	})

	it('l\'aide cite les commandes enregistrées (sauf /plainte, qui n\'y a jamais figuré)', async () => {
		const { message } = await info.help()
		for (const command of REGISTERED_COMMANDS.filter(({ name }) => name !== COMMAND_NAMES.COMPLAINT)) {
			assert.ok(message.includes(`\`${command.type === 1 ? '/' : ''}${command.name}\``), command.name)
		}
	})

	it('l\'aide ne cite que des commandes qui existent', async () => {
		const { message } = await info.help()
		const cited = [...message.matchAll(/`\/?([^`]+)`/g)].map((match) => match[1])
		const known = new Set(Object.values(COMMAND_NAMES))
		assert.ok(cited.length > 10)
		for (const name of cited) assert.ok(known.has(name), name)
	})

	it('la spé et les sites du fichier livré restent sous la limite de 2000 caractères de Discord', async () => {
		const shipped = createInfoFeature({ content: loadContent() })
		for (const result of [await shipped.displaySpe(), await shipped.displayWebsites(), await shipped.help()]) {
			assert.ok(result.message.length <= 2000, `${result.message.length} caractères`)
		}
	})
})
