import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ROLE, hasAccess } from '../src/security/access.js'
import { isProtected, protectedIds } from '../src/security/protected-members.js'
import { keepRawBody, verifyDiscordRequest } from '../src/security/signature.js'
import { assertSnowflake, isSnowflake, parseForumId } from '../src/security/validation.js'
import { createTestLogger, ids, testConfig } from './support/fakes.js'

const { roles } = testConfig()

describe('hasAccess', () => {
	const cases = [
		// [rôles du membre, ALL, RECRUIT, INSTRUCTEURS, QM, EM]
		[[], true, false, false, false, false],
		[[ids.roles.recruiting], true, true, false, false, false],
		[[ids.roles.instructeur], true, false, true, false, false],
		[[ids.roles.recruteur], true, false, true, false, false],
		[[ids.roles.qm1], true, false, true, true, false],
		[[ids.roles.qm2], true, false, true, true, false],
		[[ids.roles.em], true, false, true, true, true],
		[[ids.roles.cadet, ids.roles.membreEquipage], true, false, false, false, false],
	]

	for (const [memberRoles, ...expected] of cases) {
		it(`droits pour les rôles [${memberRoles.join(', ')}]`, () => {
			const levels = [ROLE.ALL, ROLE.RECRUIT, ROLE.INSTRUCTEURS, ROLE.QM, ROLE.EM]
			assert.deepEqual(
				levels.map((level) => hasAccess(level, memberRoles, roles)),
				expected
			)
		})
	}

	it('refuse un niveau inconnu', () => {
		assert.equal(hasAccess(0b11111, [ids.roles.em], roles), false)
	})

	it('ne donne aucun droit si le rôle n\'est pas configuré', () => {
		assert.equal(hasAccess(ROLE.EM, [undefined, ''], { ...roles, em: undefined }), false)
		assert.equal(hasAccess(ROLE.EM, [''], { ...roles, em: '' }), false)
	})

	it('accepte une liste de rôles absente', () => {
		assert.equal(hasAccess(ROLE.EM, undefined, roles), false)
		assert.equal(hasAccess(ROLE.ALL, undefined, roles), true)
	})
})

describe('membres protégés', () => {
	it('protège les membres listés et les identifiants vides', () => {
		assert.ok(isProtected(protectedIds[0]))
		assert.ok(isProtected(undefined))
		assert.ok(isProtected(''))
		assert.ok(!isProtected(ids.target))
	})
})

describe('validation des identifiants', () => {
	it('reconnaît les snowflakes Discord', () => {
		assert.ok(isSnowflake('224193244555116545'))
		assert.ok(isSnowflake('12345678901234567'))
		assert.ok(!isSnowflake('1234'))
		assert.ok(!isSnowflake('224193244555116545/../roles'))
		assert.ok(!isSnowflake(224193244555116545))
		assert.ok(!isSnowflake(undefined))
	})

	it('lève une erreur explicite sur un identifiant invalide', () => {
		assert.equal(assertSnowflake(ids.target), ids.target)
		assert.throws(() => assertSnowflake('../x', 'membre'), /membre Discord invalide : "..\/x"/)
	})

	it('lit un ID forum en texte ou en nombre', () => {
		assert.equal(parseForumId('7526'), 7526)
		assert.equal(parseForumId(' 42 '), 42)
		assert.equal(parseForumId(42), 42)
		assert.equal(parseForumId('0'), null)
		assert.equal(parseForumId('-3'), null)
		assert.equal(parseForumId('12a'), null)
		assert.equal(parseForumId('1 OR 1=1'), null)
		assert.equal(parseForumId(''), null)
		assert.equal(parseForumId(undefined), null)
	})
})

describe('vérification de la signature Discord', () => {
	const signature = 'a'.repeat(128)
	const timestamp = '1700000000'

	const run = async ({ headers = {}, rawBody = Buffer.from('{"type":1}'), verify } = {}) => {
		const logger = createTestLogger()
		const req = { rawBody, ip: '1.2.3.4', path: '/interactions', get: (name) => headers[name] }
		const res = {
			statusCode: 200,
			body: undefined,
			status(code) {
				this.statusCode = code
				return this
			},
			send(body) {
				this.body = body
				return this
			},
		}
		let nextCalled = false
		await verifyDiscordRequest('publickey', { verify, logger })(req, res, () => (nextCalled = true))
		return { res, nextCalled, logger }
	}

	const validHeaders = { 'X-Signature-Ed25519': signature, 'X-Signature-Timestamp': timestamp }

	it('laisse passer une requête signée', async () => {
		const calls = []
		const verify = (...args) => {
			calls.push(args)
			return true
		}
		const { nextCalled, res } = await run({ headers: validHeaders, verify })
		assert.ok(nextCalled)
		assert.equal(res.statusCode, 200)
		assert.deepEqual(calls[0].slice(1), [signature, timestamp, 'publickey'])
	})

	it('accepte une vérification asynchrone (discord-interactions v4)', async () => {
		const { nextCalled } = await run({ headers: validHeaders, verify: async () => true })
		assert.ok(nextCalled)
	})

	it('refuse une promesse qui renvoie false au lieu de la prendre pour un succès', async () => {
		const { nextCalled, res } = await run({ headers: validHeaders, verify: async () => false })
		assert.ok(!nextCalled)
		assert.equal(res.statusCode, 401)
	})

	it('refuse une signature invalide', async () => {
		const { nextCalled, res, logger } = await run({ headers: validHeaders, verify: () => false })
		assert.ok(!nextCalled)
		assert.equal(res.statusCode, 401)
		assert.equal(res.body, 'Bad request signature')
		assert.equal(logger.entries[0].level, 'warn')
	})

	it('refuse sans appeler la vérification si les en-têtes manquent ou sont mal formés', async () => {
		let called = false
		const verify = () => (called = true)
		for (const headers of [
			{},
			{ 'X-Signature-Ed25519': signature },
			{ 'X-Signature-Ed25519': 'zz', 'X-Signature-Timestamp': timestamp },
			{ 'X-Signature-Ed25519': signature, 'X-Signature-Timestamp': 'hier' },
		]) {
			const { res, nextCalled } = await run({ headers, verify })
			assert.equal(res.statusCode, 401)
			assert.ok(!nextCalled)
		}
		assert.ok(!called)
	})

	it('refuse une requête sans corps JSON', async () => {
		const { res } = await run({ headers: validHeaders, rawBody: null, verify: () => true })
		assert.equal(res.statusCode, 401)
	})

	it('refuse si la vérification plante', async () => {
		const { res, logger } = await run({
			headers: validHeaders,
			verify: () => {
				throw new Error('clé invalide')
			},
		})
		assert.equal(res.statusCode, 401)
		assert.ok(logger.entries.some((entry) => entry.message.includes('impossible')))
	})

	it('garde le corps brut de la requête', () => {
		const req = {}
		keepRawBody(req, {}, Buffer.from('abc'))
		assert.equal(req.rawBody.toString(), 'abc')
	})
})
