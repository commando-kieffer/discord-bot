import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { XenforoApiError, createXenforoClient, encodeForm } from '../../src/clients/xenforo.js'

const API = 'https://forum.commandokieffer.com/index.php/api'

const fakeHttp = (result) => {
	const calls = []
	return {
		calls,
		request: async (config) => {
			calls.push(config)
			if (result instanceof Error) throw result
			return { data: result }
		},
	}
}

const axiosError = (status, data, headers = {}) =>
	Object.assign(new Error(`Request failed with status code ${status}`), {
		name: 'AxiosError',
		code: 'ERR_BAD_REQUEST',
		config: { headers: { 'XF-Api-Key': 'super-secret' } },
		response: { status, data, headers },
	})

describe('encodeForm', () => {
	it('encode les champs comme un formulaire', () => {
		assert.equal(encodeForm({ title: 'A & B', sticky: false }), 'title=A%20%26%20B&sticky=false')
	})

	it('encode les tableaux avec [] comme le lit PHP', () => {
		assert.equal(decodeURIComponent(encodeForm({ ids: [38, 52] })), 'ids[]=38&ids[]=52')
	})

	it('envoie un tableau vide comme une chaîne vide pour que XenForo le vide', () => {
		assert.equal(encodeForm({ ids: [] }), 'ids=')
	})
})

describe('client XenForo', () => {
	const thread = { thread_id: 12, view_url: 'https://forum/threads/12/', user_id: 7 }

	it('crée un sujet au nom du compte demandé', async () => {
		const http = fakeHttp({ success: true, thread })
		const client = createXenforoClient({ apiUrl: API, apiKey: 'key', http })

		const result = await client.createThread({ asUser: 7, node_id: 35, title: 'Titre', message: 'Texte' })

		assert.deepEqual(result, thread)
		const [call] = http.calls
		assert.equal(call.method, 'POST')
		assert.equal(call.url, `${API}/threads`)
		assert.equal(call.data, 'node_id=35&title=Titre&message=Texte')
		assert.equal(call.headers['XF-Api-Key'], 'key')
		assert.equal(call.headers['XF-Api-User'], '7')
		assert.equal(call.headers['content-type'], 'application/x-www-form-urlencoded')
		assert.equal(call.maxRedirects, 0)
		assert.ok(call.timeout > 0)
	})

	it('modifie un compte au nom du compte du bot, sans contourner les permissions', async () => {
		const http = fakeHttp({ success: true, user: { user_id: 7526, username: 'Kieffer' } })
		const client = createXenforoClient({ apiUrl: API, apiKey: 'key', apiUser: '8', http })

		const user = await client.updateUser(7526, { username: 'Kieffer', user_group_id: '5', secondary_group_ids: ['30', '42'] })

		assert.deepEqual(user, { user_id: 7526, username: 'Kieffer' })
		const [call] = http.calls
		assert.equal(call.method, 'POST')
		assert.equal(call.url, `${API}/users/7526`)
		assert.equal(call.headers['XF-Api-User'], '8')
		assert.equal(decodeURIComponent(call.data), 'username=Kieffer&user_group_id=5&secondary_group_ids[]=30&secondary_group_ids[]=42')
		assert.doesNotMatch(call.data, /api_bypass_permissions/)
	})

	it('vide les groupes secondaires d\'un compte', async () => {
		const http = fakeHttp({ success: true, user: {} })
		await createXenforoClient({ apiUrl: API, apiKey: 'key', apiUser: '8', http }).updateUser('7526', {
			username: 'Ex Kieffer',
			user_group_id: '2',
			secondary_group_ids: [],
		})
		assert.equal(http.calls[0].data, 'username=Ex%20Kieffer&user_group_id=2&secondary_group_ids=')
	})

	it('refuse un identifiant de compte invalide, y compris pour le compte du bot', async () => {
		const http = fakeHttp({})
		const client = createXenforoClient({ apiUrl: API, apiKey: 'key', apiUser: '8', http })
		await assert.rejects(client.updateUser('7526/../1', {}), TypeError)
		await assert.rejects(createXenforoClient({ apiUrl: API, apiKey: 'key', http }).updateUser(1, {}), TypeError)
		assert.equal(http.calls.length, 0)
	})

	it('refuse un compte forum invalide sans appeler l\'API', async () => {
		const http = fakeHttp({})
		const client = createXenforoClient({ apiUrl: API, apiKey: 'key', http })
		for (const asUser of [undefined, 0, -1, 'abc', 1.5]) {
			await assert.rejects(client.createThread({ asUser, title: 'x' }), TypeError)
		}
		assert.equal(http.calls.length, 0)
	})

	it('refuse d\'appeler l\'API si elle n\'est pas configurée', async () => {
		const http = fakeHttp({})
		for (const options of [{ apiUrl: '', apiKey: 'key' }, { apiUrl: API, apiKey: '' }]) {
			const client = createXenforoClient({ ...options, http })
			await assert.rejects(client.createThread({ asUser: 1 }), (err) => {
				assert.ok(err instanceof XenforoApiError)
				assert.match(err.message, /pas configurée/)
				return true
			})
		}
		assert.equal(http.calls.length, 0)
	})

	it('reprend les erreurs renvoyées par le forum sans exposer la clé', async () => {
		const errors = [{ code: 'usernames_must_be_unique', message: 'Les noms d\'utilisateurs doivent être uniques.' }]
		const http = fakeHttp(axiosError(400, { errors }))
		const client = createXenforoClient({ apiUrl: API, apiKey: 'super-secret', http })

		await assert.rejects(client.createThread({ asUser: 1 }), (err) => {
			assert.ok(err instanceof XenforoApiError)
			assert.equal(err.status, 400)
			assert.equal(err.path, '/threads')
			assert.equal(err.message, 'Forum POST /threads : HTTP 400 - usernames_must_be_unique')
			assert.deepEqual(err.forumMessages, ["Les noms d'utilisateurs doivent être uniques."])
			assert.equal(err.cause.config, undefined)
			assert.doesNotMatch(JSON.stringify(err, Object.getOwnPropertyNames(err)), /super-secret/)
			return true
		})
	})

	it('signale une redirection au lieu de la suivre', async () => {
		const http = fakeHttp(axiosError(301, '', { location: 'https://forum.commandokieffer.com/index.php/api/threads' }))
		const client = createXenforoClient({ apiUrl: 'http://localhost/api', apiKey: 'key', http })
		await assert.rejects(client.createThread({ asUser: 1 }), /HTTP 301 - redirection vers https:\/\/forum/)
	})

	it('signale un forum injoignable', async () => {
		const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
		const client = createXenforoClient({ apiUrl: API, apiKey: 'key', http: fakeHttp(err) })
		await assert.rejects(client.createThread({ asUser: 1 }), (error) => {
			assert.equal(error.status, 0)
			assert.equal(error.cause.code, 'ECONNREFUSED')
			assert.match(error.message, /forum injoignable \(ECONNREFUSED\)/)
			assert.deepEqual(error.forumMessages, [])
			return true
		})
	})

	it('accepte une erreur HTTP sans liste d\'erreurs', async () => {
		const client = createXenforoClient({ apiUrl: API, apiKey: 'key', http: fakeHttp(axiosError(500, 'oops')) })
		await assert.rejects(client.createThread({ asUser: 1 }), { message: 'Forum POST /threads : HTTP 500' })
	})
})
