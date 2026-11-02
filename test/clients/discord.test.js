import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DISCORD_API_URL, DiscordApiError, USER_AGENT, createDiscordClient } from '../../src/clients/discord.js'
import { VERSION } from '../../src/version.js'

const fakeFetch = (response) => {
	const calls = []
	const fetch = async (url, init) => {
		calls.push({ url, init })
		if (response instanceof Error) throw response
		return typeof response === 'function' ? response(url, init) : response
	}
	return { fetch, calls }
}

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('client Discord', () => {
	it('envoie la requête authentifiée avec le corps en JSON', async () => {
		const { fetch, calls } = fakeFetch(json({ id: '1' }))
		const client = createDiscordClient({ token: 'tok', fetch })
		const options = { method: 'PATCH', body: { nick: 'Cadet.Kieffer-1Fsl' } }

		const res = await client.request('guilds/1/members/2', options)

		assert.equal(res.status, 200)
		assert.equal(calls[0].url, `${DISCORD_API_URL}guilds/1/members/2`)
		assert.equal(calls[0].init.method, 'PATCH')
		assert.equal(calls[0].init.body, '{"nick":"Cadet.Kieffer-1Fsl"}')
		assert.equal(calls[0].init.headers.Authorization, 'Bot tok')
		assert.equal(calls[0].init.headers['User-Agent'], USER_AGENT)
		assert.ok(calls[0].init.signal instanceof AbortSignal)
		// les options de l'appelant ne sont pas modifiées
		assert.deepEqual(options.body, { nick: 'Cadet.Kieffer-1Fsl' })
	})

	it('fait un GET sans corps par défaut', async () => {
		const { fetch, calls } = fakeFetch(json([]))
		await createDiscordClient({ token: 'tok', fetch }).request('applications/1/commands')
		assert.equal(calls[0].init.method, 'GET')
		assert.equal(calls[0].init.body, undefined)
	})

	it('met la version du bot dans le User-Agent', () => {
		assert.match(USER_AGENT, new RegExp(`, ${VERSION.replaceAll('.', '\\.')}\\)$`))
	})

	it('lève une DiscordApiError avec le détail renvoyé par Discord', async () => {
		const { fetch } = fakeFetch(json({ message: 'Missing Permissions', code: 50013 }, 403))
		const client = createDiscordClient({ token: 'tok', fetch })

		await assert.rejects(client.request('guilds/1/members/2', { method: 'PATCH', body: {} }), (err) => {
			assert.ok(err instanceof DiscordApiError)
			assert.equal(err.status, 403)
			assert.equal(err.method, 'PATCH')
			assert.equal(err.endpoint, 'guilds/1/members/2')
			assert.deepEqual(err.details, { message: 'Missing Permissions', code: 50013 })
			assert.equal(err.message, 'Discord PATCH guilds/1/members/2 : HTTP 403 - Missing Permissions, code 50013')
			return true
		})
	})

	it('accepte une réponse d\'erreur qui n\'est pas du JSON', async () => {
		const { fetch } = fakeFetch(new Response('<html>502 Bad Gateway</html>', { status: 502 }))
		await assert.rejects(createDiscordClient({ token: 'tok', fetch }).request('x'), (err) => {
			assert.equal(err.status, 502)
			assert.equal(err.details, '<html>502 Bad Gateway</html>')
			return true
		})
	})

	it('accepte une réponse d\'erreur vide', async () => {
		const { fetch } = fakeFetch(new Response(null, { status: 500 }))
		await assert.rejects(createDiscordClient({ token: 'tok', fetch }).request('x'), {
			message: 'Discord GET x : HTTP 500',
		})
	})

	it('transforme une erreur réseau ou un délai dépassé en DiscordApiError', async () => {
		const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
		const { fetch } = fakeFetch(timeout)
		await assert.rejects(createDiscordClient({ token: 'tok', fetch }).request('users/@me/channels'), (err) => {
			assert.ok(err instanceof DiscordApiError)
			assert.equal(err.status, 0)
			assert.equal(err.cause, timeout)
			assert.match(err.message, /requête impossible \(TimeoutError\)/)
			return true
		})
	})

	it('requestJson renvoie le corps, ou null pour une réponse 204', async () => {
		const client = createDiscordClient({ token: 'tok', fetch: fakeFetch(json({ id: '9' })).fetch })
		assert.deepEqual(await client.requestJson('x'), { id: '9' })

		const empty = createDiscordClient({ token: 'tok', fetch: fakeFetch(new Response(null, { status: 204 })).fetch })
		assert.equal(await empty.requestJson('x', { method: 'DELETE' }), null)
	})
})
