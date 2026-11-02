import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLinkRepository } from '../../src/services/forum/link.js'
import { ForumError } from '../../src/services/forum/errors.js'
import { createFakeDb, createTestLogger, ids, sqlError } from '../support/fakes.js'

const setup = (script) => {
	const db = createFakeDb(script)
	const logger = createTestLogger()
	return { db, logger, link: createLinkRepository({ db, logger }).link }
}

const rejectsWith = (promise, message) =>
	assert.rejects(promise, (err) => {
		assert.ok(err instanceof ForumError)
		assert.equal(err.message, message)
		return true
	})

const SELECT = /SELECT user_id, discord_id FROM xf_user WHERE user_id = \? OR discord_id = \?/
const UPDATE = /UPDATE xf_user SET discord_id = \? WHERE user_id = \? AND discord_id IS NULL/

describe('lien Discord / forum', () => {
	it('lie un compte forum libre', async () => {
		const { db, link } = setup([
			[SELECT, [{ user_id: 7526, discord_id: null }]],
			[UPDATE, { changedRows: 1 }],
		])

		assert.equal(await link(ids.target, 7526), true)
		assert.deepEqual(db.calls[0].params, [7526, ids.target])
		assert.deepEqual(db.calls[1].params, [ids.target, 7526])
	})

	it('ne fait rien si le lien existe déjà', async () => {
		const { db, link } = setup([[SELECT, [{ user_id: 7526, discord_id: ids.target }]]])
		assert.equal(await link(ids.target, 7526), false)
		assert.equal(db.remaining, 0)
		assert.equal(db.calls.length, 1)
	})

	it('signale un ID forum inconnu', async () => {
		const { link } = setup([[SELECT, []]])
		await rejectsWith(link(ids.target, 99999), "Aucun compte forum ne porte l'ID 99999. CODE L29")
	})

	it('refuse de lier un compte forum déjà lié à quelqu\'un d\'autre', async () => {
		const { db, link, logger } = setup([[SELECT, [{ user_id: 7526, discord_id: '100000000000000999' }]]])
		await rejectsWith(link(ids.target, 7526), 'Le compte forum 7526 est déjà lié à un autre compte Discord. CODE L31')
		assert.equal(db.calls.length, 1)
		assert.equal(logger.entries[0].level, 'warn')
	})

	it('refuse de lier un compte Discord déjà lié à un autre compte forum', async () => {
		const { link } = setup([
			[
				SELECT,
				[
					{ user_id: 7526, discord_id: null },
					{ user_id: 33, discord_id: ids.target },
				],
			],
		])
		await rejectsWith(link(ids.target, 7526), 'Ce compte Discord est déjà lié au compte forum 33. CODE L33')
	})

	it('signale une mise à jour qui n\'a rien changé', async () => {
		const { link } = setup([
			[SELECT, [{ user_id: 7526, discord_id: null }]],
			[UPDATE, { changedRows: 0 }],
		])
		await rejectsWith(link(ids.target, 7526), 'Une erreur est survenue. CODE L29')
	})

	it('signale une base injoignable ou une erreur SQL', async () => {
		await rejectsWith(setup([[SELECT, sqlError('ECONNREFUSED')]]).link(ids.target, 1), 'Connexion à la base de données impossible. CODE L15')
		await rejectsWith(setup([[SELECT, sqlError('ER_PARSE_ERROR')]]).link(ids.target, 1), 'Une erreur est survenue. CODE L24')
	})
})
