import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { createServer } from '../src/server.js'
import { createTestLogger } from './support/fakes.js'

const SIGNATURE = 'a'.repeat(128)
const TIMESTAMP = '1700000000'

describe('serveur HTTP', () => {
	let server
	let baseUrl
	const received = []
	const verified = []
	const logger = createTestLogger()

	before(async () => {
		const app = createServer({
			publicKey: 'cle-publique',
			logger,
			verify: (rawBody, signature, timestamp, key) => {
				verified.push({ rawBody: rawBody.toString(), signature, timestamp, key })
				return signature === SIGNATURE
			},
			handleInteraction: async (body) => {
				received.push(body)
				if (body.type === 99) throw new Error('boom')
				return { status: 200, body: { type: 1 } }
			},
		})
		server = app.listen(0)
		await new Promise((resolve) => server.once('listening', resolve))
		baseUrl = `http://127.0.0.1:${server.address().port}`
	})

	after(() => new Promise((resolve) => server.close(resolve)))

	const post = (body, headers = {}) =>
		fetch(`${baseUrl}/interactions`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'X-Signature-Ed25519': SIGNATURE,
				'X-Signature-Timestamp': TIMESTAMP,
				...headers,
			},
			body,
		})

	it('transmet une interaction signée et renvoie la réponse', async () => {
		const res = await post('{"type":1}')
		assert.equal(res.status, 200)
		assert.deepEqual(await res.json(), { type: 1 })
		assert.deepEqual(received.at(-1), { type: 1 })
		assert.deepEqual(verified.at(-1), { rawBody: '{"type":1}', signature: SIGNATURE, timestamp: TIMESTAMP, key: 'cle-publique' })
	})

	it('refuse une interaction mal signée sans la traiter', async () => {
		const count = received.length
		const res = await post('{"type":1}', { 'X-Signature-Ed25519': 'b'.repeat(128) })
		assert.equal(res.status, 401)
		assert.equal(await res.text(), 'Bad request signature')
		assert.equal(received.length, count)
	})

	it('refuse une interaction qui n\'est pas du JSON', async () => {
		const res = await post('type=1', { 'content-type': 'application/x-www-form-urlencoded' })
		assert.equal(res.status, 401)
	})

	it('répond 400 à un JSON invalide', async () => {
		const res = await post('{"type":')
		assert.equal(res.status, 400)
		assert.deepEqual(await res.json(), { error: 'bad request' })
	})

	it('répond 413 à un corps trop gros', async () => {
		const res = await post(JSON.stringify({ type: 1, data: 'x'.repeat(200 * 1024) }))
		assert.equal(res.status, 413)
	})

	it('répond 500 si le traitement plante, sans détail', async () => {
		const res = await post('{"type":99}')
		assert.equal(res.status, 500)
		assert.deepEqual(await res.json(), { error: 'internal error' })
		assert.ok(logger.entries.some((entry) => entry.level === 'error' && entry.message === 'Interaction non traitée'))
	})

	it('sert les images de la pièce', async () => {
		const res = await fetch(`${baseUrl}/public/pictures/piece-ck-head.jpeg`)
		assert.equal(res.status, 200)
		assert.equal(res.headers.get('content-type'), 'image/jpeg')
	})

	it('ne sert rien en dehors du dossier public', async () => {
		const res = await fetch(`${baseUrl}/public/..%2F.env`)
		assert.equal(res.status, 404)
	})

	it('répond à /redirect sans loguer les valeurs reçues', async () => {
		const res = await fetch(`${baseUrl}/redirect?code=secret-oauth-code`)
		assert.equal(res.status, 200)
		assert.deepEqual(await res.json(), {})
		const entry = logger.entries.find((e) => e.message === 'GET /redirect')
		assert.deepEqual(entry.context, { query: ['code'] })
	})

	it('ne dit pas qu\'il tourne sous Express', async () => {
		const res = await fetch(`${baseUrl}/redirect`)
		assert.equal(res.headers.get('x-powered-by'), null)
	})
})
