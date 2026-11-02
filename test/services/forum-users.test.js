import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ForumError } from '../../src/services/forum/errors.js'
import { createUsersRepository } from '../../src/services/forum/users.js'
import { createFakeDb, createTestLogger, ids, sqlError } from '../support/fakes.js'

const setup = (script) => {
	const db = createFakeDb(script)
	const logger = createTestLogger()
	return { db, logger, users: createUsersRepository({ db, logger }) }
}

const rejectsWith = (promise, message) =>
	assert.rejects(promise, (err) => {
		assert.ok(err instanceof ForumError, `ForumError attendue, reçu ${err}`)
		assert.equal(err.message, message)
		return true
	})

describe('comptes forum : setRoles', () => {
	it('met à jour pseudo, groupe principal et groupes secondaires du compte lié', async () => {
		const { db, users } = setup([[/UPDATE xf_user/, { affectedRows: 1 }]])

		const message = await users.setRoles(ids.target, 'Kieffer', '5', ['30', '42', undefined, '38'])

		assert.equal(message, 'Les permissions de base ont été correctement attribuées.')
		assert.deepEqual(db.calls[0].params, ['Kieffer', '5', '30,42,38', ids.target])
	})

	it('vide les groupes secondaires quand la liste est vide', async () => {
		const { db, users } = setup([[/UPDATE xf_user/, { affectedRows: 1 }]])
		await users.setRoles(ids.target, 'Ex Kieffer 02 01 2024', '2', [])
		assert.equal(db.calls[0].params[2], '')
	})

	it('signale un compte Discord lié à aucun compte forum', async () => {
		const { users } = setup([[/UPDATE xf_user/, { affectedRows: 0 }]])
		await rejectsWith(users.setRoles(ids.target, 'x', '5', []), "Aucun compte forum n'est lié à ce compte Discord. CODE U32")
	})

	it('distingue une base injoignable d\'une requête en erreur, et logue la cause', async () => {
		const down = setup([[/UPDATE/, sqlError('ECONNREFUSED')]])
		await rejectsWith(down.users.setRoles(ids.target, 'x', '5', []), 'Erreur de connexion à la base de données. CODE U14')
		assert.equal(down.logger.entries[0].level, 'error')
		assert.equal(down.logger.entries[0].context.discordId, ids.target)

		const broken = setup([[/UPDATE/, sqlError('ER_PARSE_ERROR')]])
		await rejectsWith(broken.users.setRoles(ids.target, 'x', '5', []), 'Une erreur est survenue. CODE U29')
	})
})

describe('comptes forum : lectures', () => {
	it('last renvoie les 5 derniers inscrits', async () => {
		const rows = [{ user_id: 7526, username: 'MoziSkync' }]
		const { db, users } = setup([[/ORDER BY user_id DESC LIMIT 5/, rows]])
		assert.deepEqual(await users.last(), rows)
		assert.deepEqual(db.calls[0].params, [])
	})

	it('last signale une liste vide ou une erreur', async () => {
		await rejectsWith(setup([[/SELECT/, []]]).users.last(), 'Une erreur est survenue. CODE U60')
		await rejectsWith(setup([[/SELECT/, sqlError('ECONNREFUSED')]]).users.last(), 'Erreur de connexion à la base de données. CODE U52')
	})

	it('info renvoie le profil du compte lié, ou null', async () => {
		const profile = { user_id: 33, panel_pts: 500, medals_count: 4 }
		const { db, users } = setup([[/LEFT JOIN medal_attribut/, [profile]]])
		assert.deepEqual(await users.info(ids.requester), profile)
		assert.deepEqual(db.calls[0].params, [ids.requester])

		assert.equal(await setup([[/SELECT/, []]]).users.info(ids.requester), null)
		await rejectsWith(setup([[/SELECT/, sqlError('ER_NO_SUCH_TABLE')]]).users.info('1'), 'Une erreur est survenue. CODE U103')
		await rejectsWith(setup([[/SELECT/, sqlError('ECONNRESET')]]).users.info('1'), 'Erreur de connexion à la base de données. CODE U83')
	})

	it('getUsername renvoie le pseudo de la fiche la plus récente, ou null', async () => {
		const { db, users } = setup([[/FROM infos_recrutement[\s\S]*ORDER BY i.id DESC/, [{ platform_username: 'Pseudo#1' }]]])
		assert.deepEqual(await users.getUsername(ids.target), { platform_username: 'Pseudo#1' })
		assert.deepEqual(db.calls[0].params, [ids.target])

		assert.equal(await setup([[/SELECT/, []]]).users.getUsername(ids.target), null)
		await rejectsWith(setup([[/SELECT/, sqlError('ER_BAD_FIELD_ERROR')]]).users.getUsername('1'), 'Une erreur est survenue. CODE U150')
		await rejectsWith(setup([[/SELECT/, sqlError('ETIMEDOUT')]]).users.getUsername('1'), 'Erreur de connexion à la base de données. CODE U130')
	})

	it('n\'insère jamais les valeurs dans le texte SQL', async () => {
		const { db, users } = setup([[/SELECT/, []]])
		await users.info("1' OR '1'='1")
		assert.doesNotMatch(db.calls[0].sql, /OR '1'='1/)
	})
})
