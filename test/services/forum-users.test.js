import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { XenforoApiError } from '../../src/clients/xenforo.js'
import { ForumError } from '../../src/services/forum/errors.js'
import { createUsersRepository } from '../../src/services/forum/users.js'
import { createFakeDb, createTestLogger, ids, sqlError } from '../support/fakes.js'

const createFakeXenforo = (updateUser = async (userId) => ({ user_id: userId })) => {
	const calls = []
	return {
		calls,
		updateUser: async (...args) => {
			calls.push(args)
			return updateUser(...args)
		},
	}
}

const setup = (script, xenforo = createFakeXenforo()) => {
	const db = createFakeDb(script)
	const logger = createTestLogger()
	return { db, logger, xenforo, users: createUsersRepository({ db, xenforo, logger }) }
}

const rejectsWith = (promise, message) =>
	assert.rejects(promise, (err) => {
		assert.ok(err instanceof ForumError, `ForumError attendue, reçu ${err}`)
		assert.equal(err.message, message)
		return true
	})

const LINKED = /SELECT user_id, username FROM xf_user WHERE discord_id = \? LIMIT 2/

describe('comptes forum : setRoles', () => {
	it('met à jour le compte lié via l\'API du forum, sans écrire dans xf_user', async () => {
		const { db, users, xenforo, logger } = setup([[LINKED, [{ user_id: 7526, username: 'MoziSkync' }]]])

		const message = await users.setRoles(ids.target, 'Kieffer', '5', ['30', '42', undefined, '38'])

		assert.equal(message, 'Les permissions de base ont été correctement attribuées.')
		assert.deepEqual(db.calls[0].params, [ids.target])
		assert.equal(db.calls.length, 1)
		assert.deepEqual(xenforo.calls, [[7526, { username: 'Kieffer', user_group_id: '5', secondary_group_ids: ['30', '42', '38'] }]])
		assert.equal(logger.entries.at(-1).message, 'Compte forum mis à jour')
	})

	it('vide les groupes secondaires quand la liste est vide', async () => {
		const { users, xenforo } = setup([[LINKED, [{ user_id: 7526 }]]])
		await users.setRoles(ids.target, 'Ex Kieffer 02 01 2024', '2', [])
		assert.deepEqual(xenforo.calls[0][1].secondary_group_ids, [])
	})

	it('signale un compte Discord lié à aucun compte forum', async () => {
		const { users, xenforo } = setup([[LINKED, []]])
		await rejectsWith(users.setRoles(ids.target, 'x', '5', []), "Aucun compte forum n'est lié à ce compte Discord. CODE U32")
		assert.equal(xenforo.calls.length, 0)
	})

	it('refuse de modifier quoi que ce soit si plusieurs comptes forum sont liés', async () => {
		const { users, xenforo, logger } = setup([[LINKED, [{ user_id: 1 }, { user_id: 2 }]]])
		await rejectsWith(users.setRoles(ids.target, 'x', '5', []), 'Plusieurs comptes forum sont liés à ce compte Discord. CODE U35')
		assert.equal(xenforo.calls.length, 0)
		assert.equal(logger.entries[0].level, 'error')
	})

	it('affiche la raison donnée par le forum quand il refuse la modification', async () => {
		const error = new XenforoApiError('Forum POST /users/7526 : HTTP 400 - usernames_must_be_unique', {
			status: 400,
			errors: [{ code: 'usernames_must_be_unique', message: 'Les noms d\'utilisateurs doivent être uniques.' }],
		})
		const { users, logger } = setup(
			[[LINKED, [{ user_id: 7526 }]]],
			createFakeXenforo(async () => {
				throw error
			})
		)

		await rejectsWith(
			users.setRoles(ids.target, 'Kieffer', '5', []),
			"La mise à jour du compte forum a échoué (Les noms d'utilisateurs doivent être uniques.). CODE U41"
		)
		const logged = logger.entries.find((entry) => entry.level === 'error')
		assert.equal(logged.context.forumUserId, 7526)
		assert.equal(logged.context.error, error)
	})

	it('reste vague quand l\'erreur ne vient pas du forum', async () => {
		const { users } = setup(
			[[LINKED, [{ user_id: 7526 }]]],
			createFakeXenforo(async () => {
				throw new TypeError('x')
			})
		)
		await rejectsWith(users.setRoles(ids.target, 'Kieffer', '5', []), 'La mise à jour du compte forum a échoué. CODE U41')
	})

	it('distingue une base injoignable d\'une requête en erreur, et logue la cause', async () => {
		const down = setup([[LINKED, sqlError('ECONNREFUSED')]])
		await rejectsWith(down.users.setRoles(ids.target, 'x', '5', []), 'Erreur de connexion à la base de données. CODE U14')
		assert.equal(down.logger.entries[0].level, 'error')
		assert.equal(down.logger.entries[0].context.discordId, ids.target)

		const broken = setup([[LINKED, sqlError('ER_PARSE_ERROR')]])
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

	it('findLinkedAccount renvoie le compte forum lié, ou null', async () => {
		const { db, users } = setup([[LINKED, [{ user_id: 7526, username: 'MoziSkync' }]]])
		assert.deepEqual(await users.findLinkedAccount(ids.target), { user_id: 7526, username: 'MoziSkync' })
		assert.deepEqual(db.calls[0].params, [ids.target])

		assert.equal(await setup([[/SELECT/, []]]).users.findLinkedAccount(ids.target), null)
		await rejectsWith(setup([[/SELECT/, sqlError('ECONNREFUSED')]]).users.findLinkedAccount('1'), 'Erreur de connexion à la base de données. CODE U14')
	})

	it('n\'insère jamais les valeurs dans le texte SQL', async () => {
		const { db, users } = setup([[/SELECT/, []]])
		await users.info("1' OR '1'='1")
		assert.doesNotMatch(db.calls[0].sql, /OR '1'='1/)
	})
})
